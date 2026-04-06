package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyloks.churchRegistry.config.IntegrationTestMailConfig;
import com.wyloks.churchRegistry.dto.ForgotPasswordResponse;
import com.wyloks.churchRegistry.entity.PasswordResetToken;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.PasswordResetTokenRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Verifies that API is protected by JWT: unauthenticated requests get 401,
 * login returns token, and authenticated requests with token succeed.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(IntegrationTestMailConfig.class)
class ApiSecurityIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    AppUserRepository appUserRepository;

    @Autowired
    PasswordResetTokenRepository passwordResetTokenRepository;

    @Test
    void getDioceses_withoutToken_returns401() throws Exception {
        mvc.perform(get("/api/dioceses"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_withValidCredentials_returns200AndToken() throws Exception {
        String body = "{\"username\":\"admin\",\"password\":\"password\"}";
        ResultActions result = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.username").value("admin"));
        String token = objectMapper.readTree(result.andReturn().getResponse().getContentAsString()).get("token").asText();

        mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void getDioceses_withInvalidToken_returns401() throws Exception {
        mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer invalid-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_withInvalidCredentials_returns401() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_returnsRefreshToken() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"password\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refreshToken").exists());
    }

    @Test
    void refresh_returnsNewAccessToken_andNewTokenWorksForApi() throws Exception {
        String loginBody = "{\"username\":\"admin\",\"password\":\"password\"}";
        String loginResponse = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String refreshToken = objectMapper.readTree(loginResponse).get("refreshToken").asText();

        ResultActions refreshResult = mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.username").value("admin"));
        String newAccessToken = objectMapper.readTree(refreshResult.andReturn().getResponse().getContentAsString()).get("token").asText();

        mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer " + newAccessToken))
                .andExpect(status().isOk());
    }

    @Test
    void refresh_withInvalidToken_returns401() throws Exception {
        mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"invalid-or-expired\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_invalidatesRefreshToken_thenRefreshReturns401() throws Exception {
        String loginResponse = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"password\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String refreshToken = objectMapper.readTree(loginResponse).get("refreshToken").asText();

        mvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void resetPassword_withValidJwt_returns204_andNewPasswordWorks() throws Exception {
        String loginResponse = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"password\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(loginResponse).get("token").asText();

        mvc.perform(post("/api/auth/reset-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPassword\":\"newpass123\"}"))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"password\"}"))
                .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"newpass123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists());
    }

    @Test
    void resetPassword_withoutToken_returns401() throws Exception {
        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newPassword\":\"newpass123\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    @Sql(
            statements = "UPDATE app_user SET email = 'admin-forgot-test@example.com' WHERE username = 'admin'",
            executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
    @Sql(
            statements = "UPDATE app_user SET email = 'admin@church_registry.com' WHERE username = 'admin'",
            executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
    void forgotPassword_createsToken_whenEmailExists_responseHasNoToken() throws Exception {
        // Seed data uses admin@church_registry.com; Jakarta Mail rejects underscores in the domain part.
        mvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"admin\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(ForgotPasswordResponse.MESSAGE))
                .andExpect(jsonPath("$.token").doesNotExist());

        var admin = appUserRepository.findByUsernameIgnoreCase("admin").orElseThrow();
        PasswordResetToken stored = passwordResetTokenRepository.findAll().stream()
                .filter(t -> t.getUser().getId().equals(admin.getId()))
                .findFirst()
                .orElseThrow();
        String token = stored.getTokenValue();

        mvc.perform(post("/api/auth/reset-password-by-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\",\"newPassword\":\"forgotpass123\"}"))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"password\"}"))
                .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"forgotpass123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists());
    }

    @Test
    @Transactional
    void forgotPassword_withUnknownEmail_returns200AndGenericMessage() throws Exception {
        long tokenCountBefore = passwordResetTokenRepository.count();

        mvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"unknown@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(ForgotPasswordResponse.MESSAGE))
                .andExpect(jsonPath("$.token").doesNotExist());

        assertThat(passwordResetTokenRepository.count()).isEqualTo(tokenCountBefore);
    }

    @Test
    void resetPasswordByToken_withoutAuth_works() throws Exception {
        mvc.perform(post("/api/auth/reset-password-by-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"invalid-token\",\"newPassword\":\"newpass123\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void inviteProfile_withoutAuth_isPublicAndReturnsDomainError() throws Exception {
        mvc.perform(get("/api/auth/invite-profile")
                        .param("token", "invalid-token"))
                .andExpect(status().isBadRequest());
    }
}
