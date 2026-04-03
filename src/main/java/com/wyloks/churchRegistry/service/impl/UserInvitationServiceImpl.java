package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.dto.IssueUserInvitationResponse;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.UserInvitation;
import com.wyloks.churchRegistry.entity.UserInvitationStatus;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.UserInvitationRepository;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import com.wyloks.churchRegistry.service.UserInvitationService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserInvitationServiceImpl implements UserInvitationService {

    private final UserInvitationRepository userInvitationRepository;
    private final AppUserRepository appUserRepository;
    private final CurrentUserAccessService currentUserAccessService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.user-invitation.expiration-ms:604800000}")
    private long invitationExpirationMs;

    @Override
    @Transactional
    public IssueUserInvitationResponse issueInvitation(Long userId) {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        if (!currentUser.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
        }

        AppUser createdByUser = appUserRepository.findByUsername(currentUser.username())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Current user not found"));

        AppUser targetUser = appUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + userId));

        String invitedEmail = targetUser.getEmail();
        if (invitedEmail == null || invitedEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User must have an email address to receive an invitation");
        }

        Instant now = Instant.now();
        revokePendingInvitations(targetUser.getId(), now);

        String rawToken = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        UserInvitation invitation = UserInvitation.builder()
                .appUser(targetUser)
                .tokenHash(hashToken(rawToken))
                .invitedEmail(invitedEmail.trim())
                .status(UserInvitationStatus.PENDING)
                .expiresAt(now.plusMillis(invitationExpirationMs))
                .createdByUser(createdByUser)
                .createdAt(now)
                .updatedAt(now)
                .build();
        userInvitationRepository.save(invitation);

        targetUser.setMustResetPassword(true);
        appUserRepository.save(targetUser);

        return IssueUserInvitationResponse.builder()
                .invitationId(invitation.getId())
                .userId(targetUser.getId())
                .invitedEmail(invitation.getInvitedEmail())
                .token(rawToken)
                .expiresAt(invitation.getExpiresAt())
                .build();
    }

    @Override
    @Transactional
    public IssueUserInvitationResponse resendInvitation(Long invitationId) {
        UserInvitation invitation = userInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found: " + invitationId));
        AppUser appUser = invitation.getAppUser();
        if (appUser == null || appUser.getId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation user does not exist");
        }
        return issueInvitation(appUser.getId());
    }

    @Override
    @Transactional
    public void revokeInvitation(Long invitationId) {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        if (!currentUser.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role required");
        }
        UserInvitation invitation = userInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found: " + invitationId));
        if (invitation.getStatus() != UserInvitationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only pending invitations can be revoked");
        }
        Instant now = Instant.now();
        invitation.setStatus(UserInvitationStatus.REVOKED);
        invitation.setRevokedAt(now);
        invitation.setUpdatedAt(now);
        userInvitationRepository.save(invitation);
    }

    @Override
    @Transactional
    public void acceptInvitation(String token, String newPassword, String firstName, String lastName, String title,
                                 String acceptedIpAddress, String acceptedUserAgent) {
        Instant now = Instant.now();
        expirePendingInvitations(now);

        String normalizedToken = token != null ? token.trim() : "";
        if (normalizedToken.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation token is required");
        }

        UserInvitation invitation = userInvitationRepository.findByTokenHash(hashToken(normalizedToken))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid invitation token"));

        if (invitation.getStatus() != UserInvitationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation is no longer active");
        }
        if (invitation.getExpiresAt().isBefore(now)) {
            invitation.setStatus(UserInvitationStatus.EXPIRED);
            invitation.setUpdatedAt(now);
            userInvitationRepository.save(invitation);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation has expired");
        }

        AppUser user = invitation.getAppUser();
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation user does not exist");
        }
        String userEmail = user.getEmail() != null ? user.getEmail().trim() : "";
        String invitedEmail = invitation.getInvitedEmail() != null ? invitation.getInvitedEmail().trim() : "";
        if (!userEmail.equalsIgnoreCase(invitedEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation email mismatch");
        }

        String normalizedFirstName = firstName != null ? firstName.trim() : "";
        String normalizedLastName = lastName != null ? lastName.trim() : "";
        String normalizedTitle = title != null && !title.isBlank() ? title.trim() : null;

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setFirstName(normalizedFirstName);
        user.setLastName(normalizedLastName);
        user.setTitle(normalizedTitle);
        user.setDisplayName(buildDisplayName(normalizedTitle, normalizedFirstName, normalizedLastName, user.getUsername()));
        user.setMustResetPassword(false);
        appUserRepository.save(user);

        invitation.setStatus(UserInvitationStatus.ACCEPTED);
        invitation.setAcceptedAt(now);
        invitation.setAcceptedIpAddress(normalizeAcceptedIpAddress(acceptedIpAddress));
        invitation.setAcceptedUserAgent(normalizeAcceptedUserAgent(acceptedUserAgent));
        invitation.setUpdatedAt(now);
        userInvitationRepository.save(invitation);
    }

    private void revokePendingInvitations(Long userId, Instant now) {
        List<UserInvitation> pendingInvitations =
                userInvitationRepository.findByAppUserIdAndStatus(userId, UserInvitationStatus.PENDING);
        for (UserInvitation invitation : pendingInvitations) {
            invitation.setStatus(UserInvitationStatus.REVOKED);
            invitation.setRevokedAt(now);
            invitation.setUpdatedAt(now);
        }
        if (!pendingInvitations.isEmpty()) {
            userInvitationRepository.saveAll(pendingInvitations);
        }
    }

    private void expirePendingInvitations(Instant now) {
        List<UserInvitation> expiredPendingInvitations =
                userInvitationRepository.findByStatusAndExpiresAtBefore(UserInvitationStatus.PENDING, now);
        for (UserInvitation invitation : expiredPendingInvitations) {
            invitation.setStatus(UserInvitationStatus.EXPIRED);
            invitation.setUpdatedAt(now);
        }
        if (!expiredPendingInvitations.isEmpty()) {
            userInvitationRepository.saveAll(expiredPendingInvitations);
        }
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private String buildDisplayName(String title, String firstName, String lastName, String username) {
        StringBuilder sb = new StringBuilder();
        if (title != null && !title.isBlank()) {
            sb.append(title.trim()).append(" ");
        }
        if (firstName != null && !firstName.isBlank()) {
            sb.append(firstName.trim()).append(" ");
        }
        if (lastName != null && !lastName.isBlank()) {
            sb.append(lastName.trim());
        }
        String result = sb.toString().trim();
        return result.isEmpty() ? username : result;
    }

    private String normalizeAcceptedIpAddress(String acceptedIpAddress) {
        if (acceptedIpAddress == null || acceptedIpAddress.isBlank()) {
            return null;
        }
        String trimmed = acceptedIpAddress.trim();
        return trimmed.length() > 64 ? trimmed.substring(0, 64) : trimmed;
    }

    private String normalizeAcceptedUserAgent(String acceptedUserAgent) {
        if (acceptedUserAgent == null || acceptedUserAgent.isBlank()) {
            return null;
        }
        String trimmed = acceptedUserAgent.trim();
        return trimmed.length() > 512 ? trimmed.substring(0, 512) : trimmed;
    }
}
