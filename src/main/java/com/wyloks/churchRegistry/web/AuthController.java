package com.wyloks.churchRegistry.web;

import com.wyloks.churchRegistry.dto.ForgotPasswordRequest;
import com.wyloks.churchRegistry.dto.ForgotPasswordResponse;
import com.wyloks.churchRegistry.dto.InviteProfileResponse;
import com.wyloks.churchRegistry.dto.LoginRequest;
import com.wyloks.churchRegistry.dto.LoginResponse;
import com.wyloks.churchRegistry.dto.RefreshRequest;
import com.wyloks.churchRegistry.dto.AcceptInviteRequest;
import com.wyloks.churchRegistry.dto.ResetPasswordByTokenRequest;
import com.wyloks.churchRegistry.dto.ResetPasswordRequest;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import com.wyloks.churchRegistry.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final CurrentUserAccessService currentUserAccessService;

    @Operation(summary = "Login", description = "Authenticate with username and password. Returns access token (JWT) and refresh token. Use the access token in Authorization header for other API calls.")
    @ApiResponse(responseCode = "401", description = "Invalid credentials")
    @SecurityRequirements
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request.getUsername(), request.getPassword());
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Refresh token", description = "Exchange a valid refresh token for a new access token and a new refresh token. The previous refresh token is invalidated.")
    @ApiResponse(responseCode = "401", description = "Invalid or expired refresh token")
    @SecurityRequirements
    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        LoginResponse response = authService.refresh(request.getRefreshToken());
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Logout", description = "Invalidate the given refresh token. After logout, that token cannot be used for refresh. Idempotent.")
    @SecurityRequirements
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest request) {
        authService.logout(request.getRefreshToken());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Reset password", description = "Set a new password for the authenticated user. Clears must_reset_password (first-login flow). Requires valid JWT in Authorization header.")
    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        String username = currentUserAccessService.getCurrentUsername();
        authService.resetPassword(username, request.getNewPassword());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Forgot password", description = "Request password reset instructions by email or username. Returns the same JSON for any non-empty identifier to prevent account enumeration. When a matching account has an email on file, a reset token is created server-side and the user completes reset via the link (POST /api/auth/reset-password-by-token).")
    @ApiResponse(responseCode = "400", description = "Validation error (e.g. missing or blank identifier)")
    @SecurityRequirements
    @PostMapping("/forgot-password")
    public ResponseEntity<ForgotPasswordResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authService.forgotPassword(request.getIdentifier()));
    }

    @Operation(summary = "Reset password by token", description = "Set a new password using a valid password reset token from forgot-password. Token is invalidated after use.")
    @ApiResponse(responseCode = "401", description = "Invalid or expired reset token")
    @SecurityRequirements
    @PostMapping("/reset-password-by-token")
    public ResponseEntity<Void> resetPasswordByToken(@Valid @RequestBody ResetPasswordByTokenRequest request) {
        authService.resetPasswordByToken(request.getToken(), request.getNewPassword());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Accept invite", description = "Accept a one-time invitation token, set password/profile details and activate the account for normal login.")
    @ApiResponse(responseCode = "400", description = "Invalid, expired, revoked or already used invitation")
    @SecurityRequirements
    @GetMapping("/invite-profile")
    public ResponseEntity<InviteProfileResponse> getInviteProfile(@RequestParam String token) {
        return ResponseEntity.ok(authService.getInviteProfile(token));
    }

    @Operation(summary = "Accept invite", description = "Accept a one-time invitation token, set password/profile details and activate the account for normal login.")
    @ApiResponse(responseCode = "400", description = "Invalid, expired, revoked or already used invitation")
    @SecurityRequirements
    @PostMapping("/accept-invite")
    public ResponseEntity<Void> acceptInvite(@Valid @RequestBody AcceptInviteRequest request, HttpServletRequest servletRequest) {
        authService.acceptInvite(
                request.getToken(),
                request.getNewPassword(),
                request.getFirstName(),
                request.getLastName(),
                request.getTitle(),
                extractClientIp(servletRequest),
                servletRequest.getHeader("User-Agent")
        );
        return ResponseEntity.noContent().build();
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            int commaIndex = forwardedFor.indexOf(',');
            return commaIndex >= 0 ? forwardedFor.substring(0, commaIndex).trim() : forwardedFor.trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return remoteAddr != null && !remoteAddr.isBlank() ? remoteAddr.trim() : null;
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Void> handleBadCredentials() {
        return ResponseEntity.status(401).build();
    }
}
