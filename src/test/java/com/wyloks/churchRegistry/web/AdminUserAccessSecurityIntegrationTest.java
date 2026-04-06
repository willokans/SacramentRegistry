package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AdminUserAccessSecurityIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void adminUser_canAccessAdminUserParishEndpoints() throws Exception {
        String superToken = loginAndGetToken("superadmin", "password");
        String adminToken = loginAndGetToken("admin", "password");

        List<Long> parishIds = ensureAtLeastTwoParishIds();
        Long parishId = parishIds.get(0);
        JsonNode allUsers = listUsersWithParishAccess(superToken);
        Long adminUserId = findUserIdByUsername(allUsers, "admin");
        String assignAdmin = objectMapper.writeValueAsString(
                new ReplaceUserParishAccessPayload(Set.of(parishId), parishId)
        );
        mvc.perform(put("/api/admin/users/{id}/parish-access", adminUserId)
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(assignAdmin))
                .andExpect(status().isOk());

        String listResponse = mvc.perform(get("/api/admin/users/parish-access")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode listed = objectMapper.readTree(listResponse);
        assertFalse(listed.isEmpty());
        Long firstUserId = listed.get(0).get("userId").asLong();
        mvc.perform(get("/api/admin/users/{id}/parish-access", firstUserId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    void superAdminUser_canAccessAdminUserParishEndpoints() throws Exception {
        String superAdminToken = loginAndGetToken("superadmin", "password");

        String listResponse = mvc.perform(get("/api/admin/users/parish-access")
                        .header("Authorization", "Bearer " + superAdminToken))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode users = objectMapper.readTree(listResponse);
        if (users.size() > 0) {
            Long firstUserId = users.get(0).get("userId").asLong();
            mvc.perform(get("/api/admin/users/{id}/parish-access", firstUserId)
                            .header("Authorization", "Bearer " + superAdminToken))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void nonAdminUser_cannotAccessAdminUserParishEndpoints() throws Exception {
        String priestToken = loginAndGetToken("priest@church_registry.com", "password");

        mvc.perform(get("/api/admin/users/parish-access")
                        .header("Authorization", "Bearer " + priestToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.message").isString());

        mvc.perform(get("/api/admin/users/{id}/parish-access", 1L)
                        .header("Authorization", "Bearer " + priestToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void adminUser_getUnknownUserParishAccess_returnsStructured404() throws Exception {
        String adminToken = loginAndGetToken("admin", "password");

        mvc.perform(get("/api/admin/users/{id}/parish-access", Long.MAX_VALUE)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("User not found: " + Long.MAX_VALUE));
    }

    @Test
    void superAdminUser_canReplaceUserParishAccess_withMultipleAndSingleParishes() throws Exception {
        String superToken = loginAndGetToken("superadmin", "password");
        JsonNode users = listUsersWithParishAccess(superToken);
        Long targetUserId = users.get(0).get("userId").asLong();

        List<Long> availableParishIds = ensureAtLeastTwoParishIds();

        Long firstParishId = availableParishIds.get(0);
        Long secondParishId = availableParishIds.get(1);

        String multiParishRequest = objectMapper.writeValueAsString(
                new ReplaceUserParishAccessPayload(Set.of(firstParishId, secondParishId), firstParishId)
        );

        mvc.perform(put("/api/admin/users/{id}/parish-access", targetUserId)
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(multiParishRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(targetUserId))
                .andExpect(jsonPath("$.defaultParishId").value(firstParishId))
                .andExpect(jsonPath("$.parishAccessIds.length()").value(2));

        String singleParishRequest = objectMapper.writeValueAsString(
                new ReplaceUserParishAccessPayload(Set.of(secondParishId), null)
        );

        mvc.perform(put("/api/admin/users/{id}/parish-access", targetUserId)
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(singleParishRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(targetUserId))
                .andExpect(jsonPath("$.defaultParishId").value(secondParishId))
                .andExpect(jsonPath("$.parishAccessIds.length()").value(1))
                .andExpect(jsonPath("$.parishAccessIds[0]").value(secondParishId));
    }

    @Test
    void nonAdminUser_cannotReplaceUserParishAccess() throws Exception {
        String superToken = loginAndGetToken("superadmin", "password");
        String priestToken = loginAndGetToken("priest@church_registry.com", "password");
        JsonNode users = listUsersWithParishAccess(superToken);
        Long targetUserId = users.get(0).get("userId").asLong();
        List<Long> availableParishIds = ensureAtLeastTwoParishIds();
        Long parishId = availableParishIds.get(0);

        String request = objectMapper.writeValueAsString(
                new ReplaceUserParishAccessPayload(Set.of(parishId), parishId)
        );

        mvc.perform(put("/api/admin/users/{id}/parish-access", targetUserId)
                        .header("Authorization", "Bearer " + priestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void nonAdminUser_dioceseAndParishListings_areScopedByAssignedParishAccess() throws Exception {
        String superToken = loginAndGetToken("superadmin", "password");

        long seed = System.nanoTime();
        Long accessibleDioceseId = createDiocese(superToken, "Scoped Diocese A " + seed, "SDA" + (seed % 10000));
        Long blockedDioceseId = createDiocese(superToken, "Scoped Diocese B " + seed, "SDB" + (seed % 10000));
        Long accessibleParishId = createParish(superToken, accessibleDioceseId, "Scoped Parish A " + seed);
        createParish(superToken, blockedDioceseId, "Scoped Parish B " + seed);

        JsonNode users = listUsersWithParishAccess(superToken);
        Long priestUserId = findUserIdByUsername(users, "priest@church_registry.com");
        String replaceRequest = objectMapper.writeValueAsString(
                new ReplaceUserParishAccessPayload(Set.of(accessibleParishId), accessibleParishId)
        );

        mvc.perform(put("/api/admin/users/{id}/parish-access", priestUserId)
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(replaceRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.defaultParishId").value(accessibleParishId))
                .andExpect(jsonPath("$.parishAccessIds.length()").value(1))
                .andExpect(jsonPath("$.parishAccessIds[0]").value(accessibleParishId));

        String priestToken = loginAndGetToken("priest@church_registry.com", "password");

        mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer " + priestToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(accessibleDioceseId));

        mvc.perform(get("/api/dioceses/{dioceseId}/parishes", accessibleDioceseId)
                        .header("Authorization", "Bearer " + priestToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(accessibleParishId))
                .andExpect(jsonPath("$[0].dioceseId").value(accessibleDioceseId));

        mvc.perform(get("/api/dioceses/{dioceseId}/parishes", blockedDioceseId)
                        .header("Authorization", "Bearer " + priestToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void nonAdminUser_cannotCreateDioceseOrParish() throws Exception {
        String superToken = loginAndGetToken("superadmin", "password");
        String priestToken = loginAndGetToken("priest@church_registry.com", "password");

        String dioceseRequest = objectMapper.writeValueAsString(
                new DiocesePayload("Unauthorized Diocese " + System.nanoTime(), "UDX", "Should be forbidden")
        );
        mvc.perform(post("/api/dioceses")
                        .header("Authorization", "Bearer " + priestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(dioceseRequest))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.message").isString());

        Long existingDioceseId = createDiocese(superToken, "Authorized Diocese " + System.nanoTime(), "ADX");
        String parishRequest = objectMapper.writeValueAsString(
                new ParishPayload("Unauthorized Parish " + System.nanoTime(), existingDioceseId, "Should be forbidden")
        );
        mvc.perform(post("/api/parishes")
                        .header("Authorization", "Bearer " + priestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(parishRequest))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.message").isString());
    }

    private String loginAndGetToken(String username, String password) throws Exception {
        String response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode payload = objectMapper.readTree(response);
        return payload.get("token").asText();
    }

    private JsonNode listUsersWithParishAccess(String token) throws Exception {
        String response = mvc.perform(get("/api/admin/users/parish-access")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response);
    }

    private List<Long> listAllParishIds(String token) throws Exception {
        Set<Long> ids = new HashSet<>();
        String diocesesResponse = mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode dioceses = objectMapper.readTree(diocesesResponse);

        for (JsonNode diocese : dioceses) {
            JsonNode dioceseIdNode = diocese.get("id");
            if (dioceseIdNode == null || !dioceseIdNode.canConvertToLong()) {
                continue;
            }

            Long dioceseId = dioceseIdNode.asLong();
            String parishesResponse = mvc.perform(get("/api/dioceses/{dioceseId}/parishes", dioceseId)
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            JsonNode parishes = objectMapper.readTree(parishesResponse);

            for (JsonNode parish : parishes) {
                JsonNode parishIdNode = parish.get("id");
                if (parishIdNode != null && parishIdNode.canConvertToLong()) {
                    ids.add(parishIdNode.asLong());
                }
            }
        }
        if (ids.isEmpty()) {
            throw new IllegalStateException("Expected at least 1 parish ID in seeded data");
        }
        return new ArrayList<>(ids);
    }

    private List<Long> ensureAtLeastTwoParishIds() throws Exception {
        String superToken = loginAndGetToken("superadmin", "password");
        try {
            List<Long> existingParishIds = listAllParishIds(superToken);
            if (existingParishIds.size() >= 2) {
                return existingParishIds;
            }
        } catch (IllegalStateException ignored) {
            // Create fixture data below when there are no existing parishes.
        }
        long seed = System.nanoTime();
        String dioceseRequest = objectMapper.writeValueAsString(
                new DiocesePayload("Integration Diocese " + seed, "INT" + (seed % 10000), "Integration test diocese")
        );
        String dioceseResponse = mvc.perform(post("/api/dioceses")
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(dioceseRequest))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        Long dioceseId = objectMapper.readTree(dioceseResponse).get("id").asLong();

        String firstParishRequest = objectMapper.writeValueAsString(
                new ParishPayload("Integration Parish A " + seed, dioceseId, "Integration test parish A")
        );
        mvc.perform(post("/api/parishes")
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(firstParishRequest))
                .andExpect(status().isCreated());

        String secondParishRequest = objectMapper.writeValueAsString(
                new ParishPayload("Integration Parish B " + seed, dioceseId, "Integration test parish B")
        );
        mvc.perform(post("/api/parishes")
                        .header("Authorization", "Bearer " + superToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(secondParishRequest))
                .andExpect(status().isCreated());

        return listAllParishIds(superToken);
    }

    private Long createDiocese(String token, String name, String code) throws Exception {
        String request = objectMapper.writeValueAsString(new DiocesePayload(name, code, "Integration test diocese"));
        String response = mvc.perform(post("/api/dioceses")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private Long createParish(String token, Long dioceseId, String parishName) throws Exception {
        String request = objectMapper.writeValueAsString(
                new ParishPayload(parishName, dioceseId, "Integration test parish")
        );
        String response = mvc.perform(post("/api/parishes")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private Long findUserIdByUsername(JsonNode users, String username) {
        for (JsonNode user : users) {
            JsonNode usernameNode = user.get("username");
            if (usernameNode != null && username.equals(usernameNode.asText())) {
                return user.get("userId").asLong();
            }
        }
        throw new IllegalStateException("Could not find user: " + username);
    }

    private record ReplaceUserParishAccessPayload(Set<Long> parishIds, Long defaultParishId) {}
    private record DiocesePayload(String dioceseName, String code, String description) {}
    private record ParishPayload(String parishName, Long dioceseId, String description) {}
}
