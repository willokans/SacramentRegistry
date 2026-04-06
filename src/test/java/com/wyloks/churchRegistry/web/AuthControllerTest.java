package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyloks.churchRegistry.config.TestSecurityConfig;
import com.wyloks.churchRegistry.dto.ForgotPasswordResponse;
import com.wyloks.churchRegistry.dto.InviteProfileResponse;
import com.wyloks.churchRegistry.dto.LoginRequest;
import com.wyloks.churchRegistry.dto.LoginResponse;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import com.wyloks.churchRegistry.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = AuthController.class)
@EnableAutoConfiguration(exclude = SecurityAutoConfiguration.class)
@Import(TestSecurityConfig.class)
@ActiveProfiles("auth-slice")
class AuthControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    AuthService authService;

    @MockBean
    CurrentUserAccessService currentUserAccessService;

    @Test
    void login_returns200AndToken_whenCredentialsValid() throws Exception {
        LoginRequest request = new LoginRequest("admin", "password");
        LoginResponse response = LoginResponse.builder()
                .token("jwt-token-here")
                .refreshToken("refresh-token-here")
                .username("admin")
                .displayName("Administrator")
                .role("ADMIN")
                .mustResetPassword(false)
                .build();
        when(authService.login("admin", "password")).thenReturn(response);

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token-here"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-token-here"))
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.displayName").value("Administrator"))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.mustResetPassword").value(false));
    }

    @Test
    void login_returnsMustResetPasswordTrue_whenUserMustReset() throws Exception {
        LoginRequest request = new LoginRequest("newuser", "temp123");
        LoginResponse response = LoginResponse.builder()
                .token("jwt-token")
                .refreshToken("refresh-token")
                .username("newuser")
                .displayName("New User")
                .role("PARISH_SECRETARY")
                .mustResetPassword(true)
                .build();
        when(authService.login("newuser", "temp123")).thenReturn(response);

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mustResetPassword").value(true));
    }

    @Test
    void login_returns401_whenCredentialsInvalid() throws Exception {
        LoginRequest request = new LoginRequest("admin", "wrong");
        when(authService.login("admin", "wrong")).thenThrow(new org.springframework.security.authentication.BadCredentialsException("Invalid credentials"));

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_returns400_whenUsernameMissing() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"p\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void refresh_returns200AndNewToken_whenRefreshTokenValid() throws Exception {
        LoginResponse newTokens = LoginResponse.builder()
                .token("new-jwt-token")
                .refreshToken("new-refresh-token")
                .username("admin")
                .displayName("Administrator")
                .role("ADMIN")
                .mustResetPassword(false)
                .build();
        when(authService.refresh("valid-refresh-token")).thenReturn(newTokens);

        mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"valid-refresh-token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("new-jwt-token"))
                .andExpect(jsonPath("$.refreshToken").value("new-refresh-token"))
                .andExpect(jsonPath("$.username").value("admin"));
    }

    @Test
    void refresh_returns401_whenRefreshTokenInvalid() throws Exception {
        when(authService.refresh("invalid-refresh")).thenThrow(new org.springframework.security.authentication.BadCredentialsException("Invalid refresh token"));

        mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"invalid-refresh\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_returns400_whenRefreshTokenMissing() throws Exception {
        mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void logout_returns204_whenRefreshTokenProvided() throws Exception {
        mvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"my-refresh-token\"}"))
                .andExpect(status().isNoContent());

        verify(authService).logout("my-refresh-token");
    }

    @Test
    void logout_returns400_whenRefreshTokenMissing() throws Exception {
        mvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resetPassword_returns204_whenAuthenticated() throws Exception {
        when(currentUserAccessService.getCurrentUsername()).thenReturn("testuser");

        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPassword\":\"newpass123\"}"))
                .andExpect(status().isNoContent());

        verify(authService).resetPassword("testuser", "newpass123");
    }

    @Test
    void resetPassword_returns400_whenPasswordTooShort() throws Exception {
        when(currentUserAccessService.getCurrentUsername()).thenReturn("testuser");

        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resetPassword_returns400_whenPasswordMissing() throws Exception {
        when(currentUserAccessService.getCurrentUsername()).thenReturn("testuser");

        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void forgotPassword_returns200AndToken_whenIdentifierExists() throws Exception {
        ForgotPasswordResponse response = ForgotPasswordResponse.builder()
                .token("reset-token-abc123")
                .expiresAt(java.time.Instant.now().plusSeconds(3600))
                .build();
        when(authService.forgotPassword("user@example.com")).thenReturn(response);

        mvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"user@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("reset-token-abc123"))
                .andExpect(jsonPath("$.expiresAt").exists());

        verify(authService).forgotPassword("user@example.com");
    }

    @Test
    void forgotPassword_returns400_whenIdentifierNotFound() throws Exception {
        when(authService.forgotPassword("unknown@example.com"))
                .thenThrow(new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST, "No account found with that email address."));

        mvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"unknown@example.com\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void forgotPassword_returns400_whenIdentifierMissing() throws Exception {
        mvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resetPasswordByToken_returns204_whenTokenValid() throws Exception {
        mvc.perform(post("/api/auth/reset-password-by-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"valid-reset-token\",\"newPassword\":\"newpass123\"}"))
                .andExpect(status().isNoContent());

        verify(authService).resetPasswordByToken("valid-reset-token", "newpass123");
    }

    @Test
    void resetPasswordByToken_returns401_whenTokenInvalid() throws Exception {
        org.mockito.Mockito.doThrow(new org.springframework.security.authentication.BadCredentialsException("Invalid or expired reset token"))
                .when(authService).resetPasswordByToken("invalid-token", "newpass123");

        mvc.perform(post("/api/auth/reset-password-by-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"invalid-token\",\"newPassword\":\"newpass123\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void resetPasswordByToken_returns400_whenPasswordTooShort() throws Exception {
        mvc.perform(post("/api/auth/reset-password-by-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"valid-token\",\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void resetPasswordByToken_returns400_whenTokenOrPasswordMissing() throws Exception {
        mvc.perform(post("/api/auth/reset-password-by-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void acceptInvite_returns204_whenRequestValid() throws Exception {
        mvc.perform(post("/api/auth/accept-invite")
                        .header("X-Forwarded-For", "203.0.113.10, 10.0.0.1")
                        .header("User-Agent", "JUnit-Agent/1.0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token":"invite-token-123",
                                  "newPassword":"newpass123",
                                  "firstName":"John",
                                  "lastName":"Doe",
                                  "title":"Fr."
                                }
                                """))
                .andExpect(status().isNoContent());

        verify(authService).acceptInvite(
                eq("invite-token-123"),
                eq("newpass123"),
                eq("John"),
                eq("Doe"),
                eq("Fr."),
                eq("203.0.113.10"),
                eq("JUnit-Agent/1.0")
        );
    }

    @Test
    void acceptInvite_returns400_whenRequiredFieldsMissing() throws Exception {
        mvc.perform(post("/api/auth/accept-invite")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getInviteProfile_returns200AndPrefillData() throws Exception {
        InviteProfileResponse response = InviteProfileResponse.builder()
                .title("Fr.")
                .firstName("John")
                .lastName("Doe")
                .invitedEmail("john@example.com")
                .expiresAt(java.time.Instant.now().plusSeconds(3600))
                .build();
        when(authService.getInviteProfile("invite-token-123")).thenReturn(response);

        mvc.perform(get("/api/auth/invite-profile").param("token", "invite-token-123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Fr."))
                .andExpect(jsonPath("$.firstName").value("John"))
                .andExpect(jsonPath("$.lastName").value("Doe"))
                .andExpect(jsonPath("$.invitedEmail").value("john@example.com"))
                .andExpect(jsonPath("$.expiresAt").exists());
    }
}
