package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Diocese;
import com.wyloks.churchRegistry.entity.Parish;
import com.wyloks.churchRegistry.repository.AppUserRepository;
import com.wyloks.churchRegistry.repository.DioceseRepository;
import com.wyloks.churchRegistry.repository.ParishRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for diocese dashboard endpoint: {@code DIOCESE_ADMIN} / {@code SUPER_ADMIN} access and denial for other roles.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DioceseDashboardControllerIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    DioceseRepository dioceseRepository;

    @Autowired
    ParishRepository parishRepository;

    @Autowired
    AppUserRepository appUserRepository;

    private Diocese diocese;
    /** Diocese with no parishes assigned to test users; used for cross-diocese denial. */
    private Diocese otherDiocese;
    private Parish parish;
    private Parish otherParishInSameDiocese;
    private String parishPriestUsername;
    private String parishPriestPassword;
    private String dioceseAdminUsername;
    private String dioceseAdminPassword;
    private String parishAdminUsername;
    private String parishAdminPassword;

    @BeforeEach
    void setUp() {
        diocese = dioceseRepository.save(Diocese.builder()
                .dioceseName("Diocese Dashboard Test")
                .code("DDT")
                .description("Integration test diocese")
                .build());

        otherDiocese = dioceseRepository.save(Diocese.builder()
                .dioceseName("Other Diocese No Access")
                .code("ODNA")
                .description("Integration test diocese without test user parishes")
                .build());

        parish = parishRepository.save(Parish.builder()
                .parishName("Test Parish")
                .diocese(diocese)
                .description("Test")
                .build());

        otherParishInSameDiocese = parishRepository.save(Parish.builder()
                .parishName("Other Parish Same Diocese")
                .diocese(diocese)
                .description("No access for admin user")
                .build());

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        parishPriestUsername = "priest_" + suffix;
        parishPriestPassword = "secret123";
        dioceseAdminUsername = "diocese_admin_" + suffix;
        dioceseAdminPassword = "secret123";
        parishAdminUsername = "parish_admin_" + suffix;
        parishAdminPassword = "secret123";

        AppUser parishPriest = AppUser.builder()
                .username(parishPriestUsername)
                .passwordHash(passwordEncoder.encode(parishPriestPassword))
                .displayName("Parish Priest")
                .role("PARISH_PRIEST")
                .parish(parish)
                .build();
        parishPriest.getParishAccesses().add(parish);
        appUserRepository.save(parishPriest);

        AppUser dioceseAdmin = AppUser.builder()
                .username(dioceseAdminUsername)
                .passwordHash(passwordEncoder.encode(dioceseAdminPassword))
                .displayName("Diocese Admin")
                .role("DIOCESE_ADMIN")
                .parish(parish)
                .build();
        dioceseAdmin.getParishAccesses().clear();
        dioceseAdmin.getParishAccesses().add(parish);
        appUserRepository.save(dioceseAdmin);

        AppUser parishAdmin = AppUser.builder()
                .username(parishAdminUsername)
                .passwordHash(passwordEncoder.encode(parishAdminPassword))
                .displayName("Parish Admin")
                .role("ADMIN")
                .parish(parish)
                .build();
        parishAdmin.getParishAccesses().clear();
        parishAdmin.getParishAccesses().add(parish);
        appUserRepository.save(parishAdmin);
    }

    @Test
    void dioceseAdmin_canAccessDioceseDashboard() throws Exception {
        String token = login(dioceseAdminUsername, dioceseAdminPassword);

        String response = mvc.perform(get("/api/dioceses/{dioceseId}/dashboard", diocese.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts").exists())
                .andExpect(jsonPath("$.counts.parishes").exists())
                .andExpect(jsonPath("$.counts.baptisms").exists())
                .andExpect(jsonPath("$.counts.communions").exists())
                .andExpect(jsonPath("$.counts.confirmations").exists())
                .andExpect(jsonPath("$.counts.marriages").exists())
                .andExpect(jsonPath("$.counts.holyOrders").exists())
                .andExpect(jsonPath("$.parishActivity").exists())
                .andExpect(jsonPath("$.recentSacraments").exists())
                .andExpect(jsonPath("$.monthly").exists())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(response);
        assertThat(json.get("counts").get("parishes").asLong()).isEqualTo(1);
        assertThat(json.get("parishActivity").isArray()).isTrue();
    }

    @Test
    void dioceseAdmin_dioceseDashboard_countsOnlyAssignedParishes_whenDioceseHasMultipleParishes() throws Exception {
        String token = login(dioceseAdminUsername, dioceseAdminPassword);

        String response = mvc.perform(get("/api/dioceses/{dioceseId}/dashboard", diocese.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(response);
        JsonNode parishActivity = json.get("parishActivity");
        assertThat(otherParishInSameDiocese.getId()).isNotEqualTo(parish.getId());
        assertThat(json.get("counts").get("parishes").asLong()).isEqualTo(1);
        assertThat(parishActivity.isArray()).isTrue();
        assertThat(parishActivity.size()).isEqualTo(1);
        assertThat(parishActivity.get(0).get("parishId").asLong()).isEqualTo(parish.getId());
    }

    @Test
    void parishPriest_cannotAccessDioceseDashboard_returns403() throws Exception {
        String token = login(parishPriestUsername, parishPriestPassword);

        mvc.perform(get("/api/dioceses/{dioceseId}/dashboard", diocese.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void parishAdmin_cannotAccessDioceseDashboard_returns403() throws Exception {
        String token = login(parishAdminUsername, parishAdminPassword);

        mvc.perform(get("/api/dioceses/{dioceseId}/dashboard", diocese.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void dioceseAdmin_cannotAccessUnassignedDioceseDashboard_returns403() throws Exception {
        String token = login(dioceseAdminUsername, dioceseAdminPassword);

        mvc.perform(get("/api/dioceses/{dioceseId}/dashboard", otherDiocese.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void unauthenticated_request_returns401() throws Exception {
        mvc.perform(get("/api/dioceses/{dioceseId}/dashboard", diocese.getId()))
                .andExpect(status().isUnauthorized());
    }

    private String login(String username, String password) throws Exception {
        String body = objectMapper.writeValueAsString(
                java.util.Map.of("username", username, "password", password));
        String response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }
}
