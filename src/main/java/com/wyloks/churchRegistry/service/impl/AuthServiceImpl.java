package com.wyloks.churchRegistry.service.impl;

import com.wyloks.churchRegistry.dto.ForgotPasswordResponse;
import com.wyloks.churchRegistry.dto.InviteProfileResponse;
import com.wyloks.churchRegistry.dto.LoginResponse;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.entity.PasswordResetToken;
import com.wyloks.churchRegistry.entity.RefreshToken;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.PasswordResetTokenRepository;
import com.wyloks.churchRegistry.repository.RefreshTokenRepository;
import com.wyloks.churchRegistry.security.JwtService;
import com.wyloks.churchRegistry.service.AuthService;
import com.wyloks.churchRegistry.service.PasswordResetEmailService;
import com.wyloks.churchRegistry.service.UserInvitationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Profile("!auth-slice")
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final AppUserRepository appUserRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserInvitationService userInvitationService;
    private final PasswordResetEmailService passwordResetEmailService;

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    @Value("${app.password-reset-token.expiration-ms:3600000}")
    private long passwordResetTokenExpirationMs;

    @Override
    @Transactional
    public LoginResponse login(String username, String password) {
        String identifier = username != null ? username.trim() : "";
        final AppUser user;
        try {
            user = appUserRepository.findByUsernameOrEmailIgnoreCase(identifier)
                    .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        } catch (BadCredentialsException e) {
            throw e;
        } catch (RuntimeException e) {
            // Avoid leaking internal user-data issues through 500 responses on login.
            throw new BadCredentialsException("Invalid credentials", e);
        }

        String passwordHash = user.getPasswordHash();
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new BadCredentialsException("Invalid credentials");
        }
        final boolean passwordMatches;
        try {
            passwordMatches = passwordEncoder.matches(password, passwordHash);
        } catch (RuntimeException e) {
            throw new BadCredentialsException("Invalid credentials", e);
        }
        if (!passwordMatches) {
            throw new BadCredentialsException("Invalid credentials");
        }

        String accessToken = jwtService.generateToken(user.getUsername(), user.getRole());
        String refreshTokenValue = createRefreshTokenForUser(user);
        return LoginResponse.builder()
                .token(accessToken)
                .refreshToken(refreshTokenValue)
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole())
                .defaultParishId(user.getParish() != null ? user.getParish().getId() : null)
                .mustResetPassword(user.isMustResetPassword())
                .build();
    }

    @Override
    @Transactional
    public void logout(String refreshTokenValue) {
        refreshTokenRepository.deleteByTokenValue(refreshTokenValue);
    }

    @Override
    @Transactional
    public LoginResponse refresh(String refreshTokenValue) {
        RefreshToken refreshToken = refreshTokenRepository.findByTokenValue(refreshTokenValue)
                .orElseThrow(() -> new BadCredentialsException("Invalid refresh token"));
        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new BadCredentialsException("Refresh token expired");
        }
        AppUser user = refreshToken.getUser();
        refreshTokenRepository.delete(refreshToken);
        String newRefreshTokenValue = createRefreshTokenForUser(user);
        String newAccessToken = jwtService.generateToken(user.getUsername(), user.getRole());
        return LoginResponse.builder()
                .token(newAccessToken)
                .refreshToken(newRefreshTokenValue)
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role(user.getRole())
                .defaultParishId(user.getParish() != null ? user.getParish().getId() : null)
                .mustResetPassword(user.isMustResetPassword())
                .build();
    }

    private String createRefreshTokenForUser(AppUser user) {
        Instant now = Instant.now();
        String value = UUID.randomUUID().toString().replace("-", "");
        RefreshToken token = RefreshToken.builder()
                .user(user)
                .tokenValue(value)
                .expiresAt(now.plusMillis(refreshExpirationMs))
                .createdAt(now)
                .build();
        refreshTokenRepository.save(token);
        return value;
    }

    @Override
    @Transactional
    public void resetPassword(String username, String newPassword) {
        AppUser user = appUserRepository.findByUsernameOrEmail(username)
                .orElseThrow(() -> new BadCredentialsException("User not found"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustResetPassword(false);
        appUserRepository.save(user);
    }

    @Override
    @Transactional
    public ForgotPasswordResponse forgotPassword(String identifier) {
        String trimmed = identifier != null ? identifier.trim() : "";
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email or username is required.");
        }
        // When identifier contains @, try email first (user likely entered email; prefer user who has that email).
        // Otherwise try username first. Use case-insensitive lookups throughout.
        Optional<AppUser> userOpt = trimmed.contains("@")
                ? appUserRepository.findByEmailIgnoreCase(trimmed).or(() -> appUserRepository.findByUsernameIgnoreCase(trimmed))
                : appUserRepository.findByUsernameIgnoreCase(trimmed).or(() -> appUserRepository.findByEmailIgnoreCase(trimmed));
        if (userOpt.isEmpty()) {
            log.info("Forgot password request: no matching account");
            return ForgotPasswordResponse.builder().build();
        }
        AppUser user = userOpt.get();
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            log.info("Forgot password request: account has no email on file");
            return ForgotPasswordResponse.builder().build();
        }
        passwordResetTokenRepository.deleteByUser(user);
        Instant now = Instant.now();
        String tokenValue = UUID.randomUUID().toString().replace("-", "");
        PasswordResetToken token = PasswordResetToken.builder()
                .user(user)
                .tokenValue(tokenValue)
                .expiresAt(now.plusMillis(passwordResetTokenExpirationMs))
                .createdAt(now)
                .build();
        passwordResetTokenRepository.save(token);
        try {
            passwordResetEmailService.sendPasswordResetEmail(user.getEmail(), tokenValue, primaryParishNameForEmail(user));
        } catch (Exception ex) {
            log.error("Password reset email could not be sent; revoking token for this request", ex);
            passwordResetTokenRepository.delete(token);
        }
        return ForgotPasswordResponse.builder().build();
    }

    /**
     * Optional trust line in password-reset email; uses the user's primary parish when set.
     */
    private String primaryParishNameForEmail(AppUser user) {
        Parish parish = user.getParish();
        if (parish == null) {
            return null;
        }
        String name = parish.getParishName();
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim();
    }

    @Override
    @Transactional
    public void resetPasswordByToken(String tokenValue, String newPassword) {
        PasswordResetToken token = passwordResetTokenRepository.findByTokenValue(tokenValue)
                .orElseThrow(() -> new BadCredentialsException("Invalid or expired reset token"));
        if (token.getExpiresAt().isBefore(Instant.now())) {
            passwordResetTokenRepository.delete(token);
            throw new BadCredentialsException("Invalid or expired reset token");
        }
        AppUser user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustResetPassword(false);
        appUserRepository.save(user);
        passwordResetTokenRepository.delete(token);
    }

    @Override
    @Transactional
    public void acceptInvite(String token, String newPassword, String firstName, String lastName, String title,
                             String acceptedIpAddress, String acceptedUserAgent) {
        userInvitationService.acceptInvitation(
                token, newPassword, firstName, lastName, title, acceptedIpAddress, acceptedUserAgent
        );
    }

    @Override
    @Transactional(readOnly = true)
    public InviteProfileResponse getInviteProfile(String token) {
        return userInvitationService.getInvitationProfile(token);
    }
}
