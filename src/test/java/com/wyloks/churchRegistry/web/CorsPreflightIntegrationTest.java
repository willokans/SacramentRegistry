package com.wyloks.churchRegistry.web;

import com.wyloks.churchRegistry.config.IntegrationTestMailConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CORS preflight (OPTIONS) must succeed for browser cross-origin login. Production 403 on OPTIONS usually means
 * the {@code Origin} is not listed in allowed-origins and does not match allowed-origin-patterns (e.g. app. subdomain).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(IntegrationTestMailConfig.class)
@TestPropertySource(
        properties = {
                "app.cors.allowed-origins=https://sacramentregistry.com,https://www.sacramentregistry.com",
                "app.cors.allowed-origin-patterns=https://*.sacramentregistry.com",
        })
class CorsPreflightIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Test
    void optionsLogin_appSubdomainOrigin_returnsOkWithAllowOrigin() throws Exception {
        String origin = "https://app.sacramentregistry.com";
        mvc.perform(options("/api/auth/login")
                        .header("Origin", origin)
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", origin));
    }

    @Test
    void optionsLogin_apexOrigin_returnsOkWithAllowOrigin() throws Exception {
        String origin = "https://sacramentregistry.com";
        mvc.perform(options("/api/auth/login")
                        .header("Origin", origin)
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", origin));
    }

    @Test
    void optionsLogin_disallowedOrigin_returnsForbidden() throws Exception {
        mvc.perform(options("/api/auth/login")
                        .header("Origin", "https://malicious.example.com")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isForbidden());
    }

    @Test
    void optionsLogin_extraRequestedHeaders_stillOk() throws Exception {
        String origin = "https://app.sacramentregistry.com";
        mvc.perform(options("/api/auth/login")
                        .header("Origin", origin)
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type, baggage, sentry-trace"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", origin));
    }
}
