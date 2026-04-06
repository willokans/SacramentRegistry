package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Verifies rate limiting on login and API endpoints.
 * Uses low limits (3) via test properties for fast tests.
 * Each test uses a distinct X-Forwarded-For to avoid bucket sharing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.rate-limit.login.limit=3",
        "app.rate-limit.api.limit=3"
})
class RateLimitIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void login_exceedsLimit_returns429() throws Exception {
        String clientIp = "192.168.1.100";
        String body = "{\"username\":\"admin\",\"password\":\"wrong\"}";

        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/auth/login")
                            .header("X-Forwarded-For", clientIp)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isUnauthorized());
        }

        mvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", clientIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error").value("Too many requests. Please try again later."));
    }

    @Test
    void api_exceedsLimit_returns429() throws Exception {
        String clientIp = "192.168.1.101";

        ResultActions loginResult = mvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", clientIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"password\"}"))
                .andExpect(status().isOk());
        String token = objectMapper.readTree(loginResult.andReturn().getResponse().getContentAsString()).get("token").asText();

        for (int i = 0; i < 3; i++) {
            mvc.perform(get("/api/dioceses")
                            .header("X-Forwarded-For", clientIp)
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());
        }

        mvc.perform(get("/api/dioceses")
                        .header("X-Forwarded-For", clientIp)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isTooManyRequests())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error").value("Too many requests. Please try again later."));
    }

    @Test
    void health_isExemptFromRateLimiting() throws Exception {
        String clientIp = "192.168.1.102";

        for (int i = 0; i < 10; i++) {
            mvc.perform(get("/api/health")
                            .header("X-Forwarded-For", clientIp))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void nonApiOpenApiPath_exceedsLimit_returns429() throws Exception {
        String clientIp = "192.168.1.103";

        for (int i = 0; i < 3; i++) {
            mvc.perform(get("/v3/api-docs")
                            .header("X-Forwarded-For", clientIp))
                    .andExpect(status().isOk());
        }

        mvc.perform(get("/v3/api-docs")
                        .header("X-Forwarded-For", clientIp))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("Too many requests. Please try again later."));
    }

    @Test
    void corsPreflight_doesNotConsumeRateLimit() throws Exception {
        String clientIp = "192.168.1.104";
        for (int i = 0; i < 20; i++) {
            mvc.perform(options("/api/dioceses")
                            .header("X-Forwarded-For", clientIp)
                            .header("Origin", "http://localhost:3000")
                            .header("Access-Control-Request-Method", "GET"))
                    .andExpect(result -> {
                        int sc = result.getResponse().getStatus();
                        Assertions.assertThat(sc)
                                .as("CORS preflight should succeed (not 429)")
                                .isNotEqualTo(429);
                    });
        }

        ResultActions loginResult = mvc.perform(post("/api/auth/login")
                        .header("X-Forwarded-For", clientIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"password\"}"))
                .andExpect(status().isOk());
        String token = objectMapper.readTree(loginResult.andReturn().getResponse().getContentAsString()).get("token").asText();

        for (int i = 0; i < 3; i++) {
            mvc.perform(get("/api/dioceses")
                            .header("X-Forwarded-For", clientIp)
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());
        }
        mvc.perform(get("/api/dioceses")
                        .header("X-Forwarded-For", clientIp)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isTooManyRequests());
    }
}
