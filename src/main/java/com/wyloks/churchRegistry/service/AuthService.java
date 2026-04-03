package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.dto.ForgotPasswordResponse;
import com.wyloks.churchRegistry.dto.LoginResponse;

public interface AuthService {

    /**
     * Authenticates user and returns JWT, refresh token and user info, or throws BadCredentialsException.
     */
    LoginResponse login(String username, String password);

    /**
     * Exchanges a valid refresh token for a new access token (and new refresh token). Throws BadCredentialsException if invalid or expired.
     */
    LoginResponse refresh(String refreshToken);

    /**
     * Invalidates the given refresh token (e.g. on logout). Idempotent: safe to call if token already invalid or missing.
     */
    void logout(String refreshToken);

    /**
     * Updates the password for the given user and clears must_reset_password.
     * Used for first-login password reset (JWT identifies the user).
     */
    void resetPassword(String username, String newPassword);

    /**
     * Generates a time-limited password reset token. Accepts email or username.
     * MVP: no email sent; returns the token for Super Admin to share with the user.
     * Throws if no user exists, or if user found by username has no email attached.
     */
    ForgotPasswordResponse forgotPassword(String identifier);

    /**
     * Resets the user's password using a valid password reset token.
     * Invalidates the token after use. Throws BadCredentialsException if token is invalid or expired.
     */
    void resetPasswordByToken(String token, String newPassword);

    /**
     * Accepts an invitation token, sets password/profile fields and consumes the invitation.
     */
    void acceptInvite(String token, String newPassword, String firstName, String lastName, String title,
                      String acceptedIpAddress, String acceptedUserAgent);
}
