package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.dto.InviteProfileResponse;
import com.wyloks.churchRegistry.dto.IssueUserInvitationResponse;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.UserInvitation;
import com.wyloks.churchRegistry.entity.UserInvitationEmailDeliveryStatus;
import com.wyloks.churchRegistry.entity.UserInvitationStatus;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.UserInvitationRepository;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import com.wyloks.churchRegistry.security.ParishAccessPolicy;
import com.wyloks.churchRegistry.service.InvitationEmailService;
import com.wyloks.churchRegistry.service.UserInvitationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserInvitationServiceImpl implements UserInvitationService {

    private final UserInvitationRepository userInvitationRepository;
    private final AppUserRepository appUserRepository;
    private final CurrentUserAccessService currentUserAccessService;
    private final PasswordEncoder passwordEncoder;
    private final InvitationEmailService invitationEmailService;

    @Value("${app.user-invitation.expiration-ms:604800000}")
    private long invitationExpirationMs;

    @Value("${app.user-invitation.expose-token-in-response:false}")
    private boolean exposeTokenInResponse;

    @Value("${app.user-invitation.resend-cooldown-ms:900000}")
    private long resendCooldownMs;

    @Override
    @Transactional
    public IssueUserInvitationResponse issueInvitation(Long userId) {
        CurrentUserAccessService.CurrentUserAccess currentUser = requireAdmin();
        AppUser createdByUser = findCurrentActor(currentUser);
        AppUser targetUser = findTargetUser(userId);
        requireActorCanManageInvitedUser(currentUser, targetUser);
        return issueInvitationForUser(targetUser, createdByUser, "ISSUE", null);
    }

    @Override
    @Transactional(readOnly = true)
    public IssueUserInvitationResponse getLatestInvitationForUser(Long userId) {
        CurrentUserAccessService.CurrentUserAccess actor = requireAdmin();
        AppUser targetUser = findTargetUser(userId);
        requireActorCanManageInvitedUser(actor, targetUser);
        UserInvitation invitation = userInvitationRepository.findFirstByAppUserIdOrderByCreatedAtDescIdDesc(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found for user: " + userId));
        return buildInvitationResponse(invitation, null);
    }

    @Override
    @Transactional
    public InviteProfileResponse getInvitationProfile(String token) {
        Instant now = Instant.now();
        expirePendingInvitations(now);
        UserInvitation invitation = findActiveInvitationByToken(token, now);
        AppUser user = invitation.getAppUser();
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation user does not exist");
        }
        return InviteProfileResponse.builder()
                .title(user.getTitle())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .invitedEmail(invitation.getInvitedEmail())
                .expiresAt(invitation.getExpiresAt())
                .build();
    }

    @Override
    @Transactional
    public IssueUserInvitationResponse resendInvitation(Long invitationId) {
        CurrentUserAccessService.CurrentUserAccess currentUser = requireAdmin();
        AppUser actor = findCurrentActor(currentUser);
        UserInvitation invitation = userInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found: " + invitationId));
        AppUser appUser = invitation.getAppUser();
        if (appUser == null || appUser.getId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation user does not exist");
        }
        AppUser targetScoped = appUserRepository.findWithParishAccessesById(appUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + appUser.getId()));
        requireActorCanManageInvitedUser(currentUser, targetScoped);
        log.info(
                "Invitation resend requested: invitationId={}, actorId={}, actorUsername={}, userId={}, invitedEmail={}",
                invitationId, actor.getId(), actor.getUsername(), appUser.getId(), safeEmail(invitation.getInvitedEmail()));
        enforceResendCooldown(invitation, actor, appUser);

        try {
            IssueUserInvitationResponse response = issueInvitationForUser(appUser, actor, "RESEND", invitationId);
            log.info(
                    "Invitation resend succeeded: sourceInvitationId={}, newInvitationId={}, actorId={}, actorUsername={}, userId={}, invitedEmail={}, deliveryStatus={}",
                    invitationId,
                    response.getInvitationId(),
                    actor.getId(),
                    actor.getUsername(),
                    appUser.getId(),
                    safeEmail(invitation.getInvitedEmail()),
                    response.getEmailDeliveryStatus());
            return response;
        } catch (ResponseStatusException ex) {
            log.warn(
                    "Invitation resend failed: invitationId={}, actorId={}, actorUsername={}, userId={}, invitedEmail={}, error={}",
                    invitationId,
                    actor.getId(),
                    actor.getUsername(),
                    appUser.getId(),
                    safeEmail(invitation.getInvitedEmail()),
                    sanitizeErrorMessage(ex.getReason()));
            throw ex;
        } catch (RuntimeException ex) {
            log.warn(
                    "Invitation resend failed: invitationId={}, actorId={}, actorUsername={}, userId={}, invitedEmail={}, error={}",
                    invitationId,
                    actor.getId(),
                    actor.getUsername(),
                    appUser.getId(),
                    safeEmail(invitation.getInvitedEmail()),
                    sanitizeErrorMessage(ex.getMessage()));
            throw ex;
        }
    }

    @Override
    @Transactional
    public void revokeInvitation(Long invitationId) {
        CurrentUserAccessService.CurrentUserAccess currentUser = requireAdmin();
        UserInvitation invitation = userInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found: " + invitationId));
        AppUser invited = invitation.getAppUser();
        if (invited == null || invited.getId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invitation user does not exist");
        }
        AppUser targetScoped = appUserRepository.findWithParishAccessesById(invited.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + invited.getId()));
        requireActorCanManageInvitedUser(currentUser, targetScoped);
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
        UserInvitation invitation = findActiveInvitationByToken(token, now);

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
            log.info("Revoking {} pending invitation(s) for userId={}", pendingInvitations.size(), userId);
            userInvitationRepository.saveAll(pendingInvitations);
        }
    }

    private UserInvitation findActiveInvitationByToken(String token, Instant now) {
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
        return invitation;
    }

    private CurrentUserAccessService.CurrentUserAccess requireAdmin() {
        CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
        if (!currentUser.isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Administrator access required (parish admin, diocese admin, or super admin)");
        }
        return currentUser;
    }

    private AppUser findCurrentActor(CurrentUserAccessService.CurrentUserAccess currentUser) {
        return appUserRepository.findByUsername(currentUser.username())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Current user not found"));
    }

    private AppUser findTargetUser(Long userId) {
        return appUserRepository.findWithParishAccessesById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + userId));
    }

    private void requireActorCanManageInvitedUser(
            CurrentUserAccessService.CurrentUserAccess actor,
            AppUser targetUser
    ) {
        if (actor.isSuperAdmin()) {
            return;
        }
        if (!ParishAccessPolicy.sharesParishWithActor(actor.parishIds(), targetUser)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + targetUser.getId());
        }
    }

    private IssueUserInvitationResponse issueInvitationForUser(
            AppUser targetUser,
            AppUser actor,
            String flowType,
            Long sourceInvitationId
    ) {
        String invitedEmail = requireInvitedEmail(targetUser);
        Instant now = Instant.now();

        String rawToken = generateRawToken();
        revokePendingInvitations(targetUser.getId(), now);
        UserInvitation invitation = createPendingInvitation(targetUser, actor, invitedEmail, rawToken, now);

        userInvitationRepository.save(invitation);
        auditIssueOrResend(flowType, sourceInvitationId, actor, targetUser, invitation);

        targetUser.setMustResetPassword(true);
        appUserRepository.save(targetUser);

        attemptInvitationEmailSend(invitation, rawToken, actor, flowType, sourceInvitationId);
        return buildInvitationResponse(invitation, exposeTokenInResponse ? rawToken : null);
    }

    private UserInvitation createPendingInvitation(
            AppUser targetUser,
            AppUser actor,
            String invitedEmail,
            String rawToken,
            Instant now
    ) {
        return UserInvitation.builder()
                .appUser(targetUser)
                .tokenHash(hashToken(rawToken))
                .invitedEmail(invitedEmail.trim())
                .status(UserInvitationStatus.PENDING)
                .emailDeliveryStatus(UserInvitationEmailDeliveryStatus.PENDING)
                .expiresAt(now.plusMillis(invitationExpirationMs))
                .createdByUser(actor)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private void auditIssueOrResend(
            String flowType,
            Long sourceInvitationId,
            AppUser actor,
            AppUser targetUser,
            UserInvitation invitation
    ) {
        log.info(
                "Invitation {} created: invitationId={}, sourceInvitationId={}, actorId={}, actorUsername={}, userId={}, invitedEmail={}",
                flowType,
                invitation.getId(),
                sourceInvitationId,
                actor.getId(),
                actor.getUsername(),
                targetUser.getId(),
                safeEmail(invitation.getInvitedEmail()));
    }

    private void attemptInvitationEmailSend(
            UserInvitation invitation,
            String rawToken,
            AppUser actor,
            String flowType,
            Long sourceInvitationId
    ) {
        Instant attemptedAt = Instant.now();
        invitation.setLastEmailAttemptAt(attemptedAt);
        invitation.setUpdatedAt(attemptedAt);
        try {
            invitationEmailService.sendInvitationEmail(invitation, rawToken);
            invitation.setEmailDeliveryStatus(UserInvitationEmailDeliveryStatus.SENT);
            invitation.setEmailSentAt(attemptedAt);
            invitation.setLastEmailError(null);
            log.info(
                    "Invitation {} email sent: invitationId={}, sourceInvitationId={}, actorId={}, invitedEmail={}",
                    flowType,
                    invitation.getId(),
                    sourceInvitationId,
                    actor.getId(),
                    safeEmail(invitation.getInvitedEmail()));
        } catch (Exception ex) {
            String sanitizedError = sanitizeEmailError(ex);
            invitation.setEmailDeliveryStatus(UserInvitationEmailDeliveryStatus.FAILED);
            invitation.setLastEmailError(sanitizedError);
            log.warn(
                    "Invitation {} email failed: invitationId={}, sourceInvitationId={}, actorId={}, invitedEmail={}, error={}",
                    flowType,
                    invitation.getId(),
                    sourceInvitationId,
                    actor.getId(),
                    safeEmail(invitation.getInvitedEmail()),
                    sanitizedError);
        }
        userInvitationRepository.save(invitation);
    }

    private IssueUserInvitationResponse buildInvitationResponse(UserInvitation invitation, String rawToken) {
        UserInvitationEmailDeliveryStatus deliveryStatus = invitation.getEmailDeliveryStatus();
        String deliveryMessage = switch (deliveryStatus) {
            case FAILED -> "Invitation created, but email delivery failed. Please use resend to try again.";
            case SENT -> "Invitation email sent.";
            case PENDING -> "Invitation created and pending email delivery.";
        };

        return IssueUserInvitationResponse.builder()
                .invitationId(invitation.getId())
                .userId(invitation.getAppUser().getId())
                .invitedEmail(invitation.getInvitedEmail())
                .token(rawToken)
                .expiresAt(invitation.getExpiresAt())
                .invitationStatus(invitation.getStatus())
                .emailDeliveryStatus(deliveryStatus)
                .lastEmailAttemptAt(invitation.getLastEmailAttemptAt())
                .lastEmailError(invitation.getLastEmailError())
                .emailSentAt(invitation.getEmailSentAt())
                .deliveryMessage(deliveryMessage)
                .build();
    }

    private String requireInvitedEmail(AppUser targetUser) {
        String invitedEmail = targetUser.getEmail();
        if (invitedEmail == null || invitedEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User must have an email address to receive an invitation");
        }
        return invitedEmail.trim();
    }

    private String generateRawToken() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
    }

    private void enforceResendCooldown(UserInvitation invitation, AppUser actor, AppUser targetUser) {
        if (resendCooldownMs <= 0) {
            return;
        }

        Instant resendReference = resolveResendReference(invitation);
        if (resendReference == null) {
            return;
        }

        Instant now = Instant.now();
        Instant nextAllowedAt = resendReference.plusMillis(resendCooldownMs);
        if (!nextAllowedAt.isAfter(now)) {
            return;
        }

        long remainingMs = Duration.between(now, nextAllowedAt).toMillis();
        String waitTime = formatWaitTime(remainingMs);
        log.warn(
                "Invitation resend denied by cooldown: invitationId={}, actorId={}, actorUsername={}, userId={}, invitedEmail={}, retryAfterMs={}",
                invitation.getId(),
                actor.getId(),
                actor.getUsername(),
                targetUser.getId(),
                safeEmail(invitation.getInvitedEmail()),
                remainingMs);
        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Resend allowed in " + waitTime + ". Please try again later.");
    }

    private Instant resolveResendReference(UserInvitation invitation) {
        if (invitation.getLastEmailAttemptAt() != null) {
            return invitation.getLastEmailAttemptAt();
        }
        if (invitation.getCreatedAt() != null) {
            return invitation.getCreatedAt();
        }
        return invitation.getUpdatedAt();
    }

    private String formatWaitTime(long remainingMs) {
        long safeMs = Math.max(0L, remainingMs);
        long totalSeconds = Math.max(1L, (safeMs + 999L) / 1000L);
        long minutes = totalSeconds / 60L;
        long seconds = totalSeconds % 60L;
        if (minutes > 0 && seconds > 0) {
            return minutes + "m " + seconds + "s";
        }
        if (minutes > 0) {
            return minutes + "m";
        }
        return seconds + "s";
    }

    private String sanitizeEmailError(Exception ex) {
        return sanitizeErrorMessage(ex.getMessage(), ex.getClass().getSimpleName());
    }

    private String sanitizeErrorMessage(String message) {
        return sanitizeErrorMessage(message, "unknown_error");
    }

    private String sanitizeErrorMessage(String message, String fallback) {
        String normalizedMessage = message;
        if (normalizedMessage == null || normalizedMessage.isBlank()) {
            normalizedMessage = fallback;
        }
        String sanitized = normalizedMessage.replaceAll("[\\r\\n]+", " ").trim();
        return sanitized.length() > 1024 ? sanitized.substring(0, 1024) : sanitized;
    }

    private String safeEmail(String email) {
        if (email == null || email.isBlank()) {
            return "unknown";
        }
        return email.trim();
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
