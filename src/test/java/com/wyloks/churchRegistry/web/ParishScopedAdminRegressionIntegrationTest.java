package com.wyloks.churchRegistry.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wyloks.churchRegistry.config.CacheConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression tests for parish-scoped {@code ADMIN} vs {@code SUPER_ADMIN}: directory IDOR, escalation,
 * invitation scope, diocese/parish list cache isolation, country-scoped search, and absence of an unscoped
 * {@code /api/dioceses/countries} listing (see plan: security isolation).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ParishScopedAdminRegressionIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    CacheManager cacheManager;

    private String superToken;
    private Long diocese1Id;
    private Long diocese2Id;
    private Long parish1Id;
    private Long parish2Id;

    @BeforeEach
    void setUp() throws Exception {
        superToken = login("superadmin", "password");
        long seed = System.nanoTime();
        diocese1Id = createDiocese(superToken, "Reg Diocese One " + seed, "R1" + (seed % 10000), "US", "United States");
        diocese2Id = createDiocese(superToken, "Reg Diocese Two " + seed, "R2" + (seed % 10000), "US", "United States");
        parish1Id = createParish(superToken, diocese1Id, "Reg Parish One " + seed);
        parish2Id = createParish(superToken, diocese2Id, "Reg Parish Two " + seed);
    }

    @Test
    void superAdmin_canListBaptisms_scopedAdminGets403_onForeignParish() throws Exception {
        mvc.perform(get("/api/parishes/{parishId}/baptisms", parish2Id)
                        .header("Authorization", bearer(superToken)))
                .andExpect(status().isOk());

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        createUser(superToken, Map.of(
                "username", "scoped_bap_" + suffix,
                "email", "scoped_bap_" + suffix + "@test.local",
                "firstName", "Bap",
                "lastName", "Scoped" + suffix,
                "title", "Mr",
                "role", "ADMIN",
                "defaultParishId", parish1Id,
                "parishIds", Set.of(parish1Id),
                "defaultPassword", "secret12345"
        ));

        String scopedToken = login("scoped_bap_" + suffix, "secret12345");

        mvc.perform(get("/api/parishes/{parishId}/baptisms", parish2Id)
                        .header("Authorization", bearer(scopedToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void superAdmin_canGetParishById_scopedAdminGets403_onForeignParish() throws Exception {
        assertThat(mvc.perform(get("/api/parishes/{id}", parish2Id)
                        .header("Authorization", bearer(superToken)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).contains("Reg Parish Two");

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        createUser(superToken, Map.of(
                "username", "scoped_p1_" + suffix,
                "email", "scoped_p1_" + suffix + "@test.local",
                "firstName", "Scoped",
                "lastName", "POne" + suffix,
                "title", "Mr",
                "role", "ADMIN",
                "defaultParishId", parish1Id,
                "parishIds", Set.of(parish1Id),
                "defaultPassword", "secret12345"
        ));

        String scopedToken = login("scoped_p1_" + suffix, "secret12345");

        mvc.perform(get("/api/parishes/{id}", parish2Id)
                        .header("Authorization", bearer(scopedToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void scopedAdmin_getDioceseById_returns404_whenNoParishInThatDiocese() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        createUser(superToken, Map.of(
                "username", "scoped_d1_" + suffix,
                "email", "scoped_d1_" + suffix + "@test.local",
                "firstName", "Diocese",
                "lastName", "Scoped" + suffix,
                "title", "Mr",
                "role", "ADMIN",
                "defaultParishId", parish1Id,
                "parishIds", Set.of(parish1Id),
                "defaultPassword", "secret12345"
        ));

        String scopedToken = login("scoped_d1_" + suffix, "secret12345");

        mvc.perform(get("/api/dioceses/{id}", diocese2Id)
                        .header("Authorization", bearer(scopedToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void scopedAdmin_cannotGrantParishAccessOutsideOwnScope_returns403() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        createUser(superToken, Map.of(
                "username", "scoped_esc_" + suffix,
                "email", "scoped_esc_" + suffix + "@test.local",
                "firstName", "Esc",
                "lastName", "Admin" + suffix,
                "title", "Mr",
                "role", "ADMIN",
                "defaultParishId", parish1Id,
                "parishIds", Set.of(parish1Id),
                "defaultPassword", "secret12345"
        ));
        JsonNode victim = createUser(superToken, Map.of(
                "username", "victim_esc_" + suffix,
                "email", "victim_esc_" + suffix + "@test.local",
                "firstName", "Vict",
                "lastName", "Tim" + suffix,
                "title", "Mr",
                "role", "PARISH_VIEWER",
                "defaultParishId", parish1Id,
                "parishIds", Set.of(parish1Id),
                "defaultPassword", "secret12345"
        ));

        String scopedToken = login("scoped_esc_" + suffix, "secret12345");
        long victimId = victim.get("userId").asLong();

        String body = objectMapper.writeValueAsString(Map.of(
                "parishIds", Set.of(parish1Id, parish2Id),
                "defaultParishId", parish1Id
        ));

        mvc.perform(put("/api/admin/users/{id}/parish-access", victimId)
                        .header("Authorization", bearer(scopedToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Cannot assign parishes outside your scope"));
    }

    @Test
    void scopedAdmin_cannotIssueInvitationForUserWithoutSharedParish_returns404() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        createUser(superToken, Map.of(
                "username", "scoped_inv_" + suffix,
                "email", "scoped_inv_" + suffix + "@test.local",
                "firstName", "Inv",
                "lastName", "Admin" + suffix,
                "title", "Mr",
                "role", "ADMIN",
                "defaultParishId", parish1Id,
                "parishIds", Set.of(parish1Id),
                "defaultPassword", "secret12345"
        ));
        JsonNode foreign = createUser(superToken, Map.of(
                "username", "foreign_inv_" + suffix,
                "email", "foreign_inv_" + suffix + "@test.local",
                "firstName", "For",
                "lastName", "Eign" + suffix,
                "title", "Mr",
                "role", "PARISH_VIEWER",
                "defaultParishId", parish2Id,
                "parishIds", Set.of(parish2Id),
                "defaultPassword", "secret12345"
        ));

        String scopedToken = login("scoped_inv_" + suffix, "secret12345");
        long foreignId = foreign.get("userId").asLong();

        String inviteBody = objectMapper.writeValueAsString(Map.of("userId", foreignId));
        mvc.perform(post("/api/admin/users/invitations")
                        .header("Authorization", bearer(scopedToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(inviteBody))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found: " + foreignId));
    }

    @Test
    void twoScopedAdmins_differentParishes_useSeparateDiocesesWithParishesCacheEntries() throws Exception {
        Cache cache = cacheManager.getCache(CacheConfig.CACHE_DIOCESES_WITH_PARISHES);
        assertThat(cache).isNotNull();
        cache.clear();

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        createUser(superToken, Map.of(
                "username", "cache_a_" + suffix,
                "email", "cache_a_" + suffix + "@test.local",
                "firstName", "Cache",
                "lastName", "Alpha" + suffix,
                "title", "Mr",
                "role", "ADMIN",
                "defaultParishId", parish1Id,
                "parishIds", Set.of(parish1Id),
                "defaultPassword", "secret12345"
        ));
        createUser(superToken, Map.of(
                "username", "cache_b_" + suffix,
                "email", "cache_b_" + suffix + "@test.local",
                "firstName", "Cache",
                "lastName", "Beta" + suffix,
                "title", "Mr",
                "role", "ADMIN",
                "defaultParishId", parish2Id,
                "parishIds", Set.of(parish2Id),
                "defaultPassword", "secret12345"
        ));

        String tokenA = login("cache_a_" + suffix, "secret12345");
        String tokenB = login("cache_b_" + suffix, "secret12345");

        mvc.perform(get("/api/dioceses/with-parishes")
                        .header("Authorization", bearer(tokenA)))
                .andExpect(status().isOk());
        assertThat(nativeCacheSize(cache)).isEqualTo(1);

        mvc.perform(get("/api/dioceses/with-parishes")
                        .header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk());
        assertThat(nativeCacheSize(cache)).isEqualTo(2);
    }

    @Test
    void scopedAdmin_getParishesByForeignDiocese_returnsEmptyList() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        createUser(superToken, Map.of(
                "username", "scoped_parlist_" + suffix,
                "email", "scoped_parlist_" + suffix + "@test.local",
                "firstName", "Par",
                "lastName", "List" + suffix,
                "title", "Mr",
                "role", "ADMIN",
                "defaultParishId", parish1Id,
                "parishIds", Set.of(parish1Id),
                "defaultPassword", "secret12345"
        ));
        String scopedToken = login("scoped_parlist_" + suffix, "secret12345");

        String body = mvc.perform(get("/api/dioceses/{dioceseId}/parishes", diocese2Id)
                        .header("Authorization", bearer(scopedToken)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode arr = objectMapper.readTree(body);
        assertThat(arr.isArray()).isTrue();
        assertThat(arr.size()).isEqualTo(0);
    }

    @Test
    void scopedAdmin_searchDiocesesByCountry_returnsOnlyDiocesesWithParishAccess() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        createUser(superToken, Map.of(
                "username", "scoped_search_" + suffix,
                "email", "scoped_search_" + suffix + "@test.local",
                "firstName", "Sea",
                "lastName", "Rch" + suffix,
                "title", "Mr",
                "role", "ADMIN",
                "defaultParishId", parish1Id,
                "parishIds", Set.of(parish1Id),
                "defaultPassword", "secret12345"
        ));
        String scopedToken = login("scoped_search_" + suffix, "secret12345");

        String body = mvc.perform(get("/api/dioceses/search")
                        .param("countryCode", "US")
                        .header("Authorization", bearer(scopedToken)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode arr = objectMapper.readTree(body);
        assertThat(arr.isArray()).isTrue();
        assertThat(arr.size()).isEqualTo(1);
        assertThat(arr.get(0).get("id").asLong()).isEqualTo(diocese1Id);
    }

    @Test
    void dioceseAdmin_searchDiocesesByCountry_returnsOnlyAssignedDioceses() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> request = new HashMap<>();
        request.put("username", "da_search_iso_" + suffix);
        request.put("email", "da_search_iso_" + suffix + "@test.local");
        request.put("firstName", "DA");
        request.put("lastName", "Search" + suffix);
        request.put("title", "Mr");
        request.put("role", "DIOCESE_ADMIN");
        request.put("dioceseIds", Set.of(diocese1Id));
        request.put("parishIds", Set.of());
        request.put("defaultPassword", "secret12345");
        createUser(superToken, request);

        String daToken = login("da_search_iso_" + suffix, "secret12345");

        String body = mvc.perform(get("/api/dioceses/search")
                        .param("countryCode", "US")
                        .header("Authorization", bearer(daToken)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode arr = objectMapper.readTree(body);
        assertThat(arr.isArray()).isTrue();
        assertThat(arr.size()).isEqualTo(1);
        assertThat(arr.get(0).get("id").asLong()).isEqualTo(diocese1Id);
    }

    @Test
    void apiDiocesesCountries_doesNotReturnOk_unscopedCountryListingMustNotExist() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        createUser(superToken, Map.of(
                "username", "scoped_countries_" + suffix,
                "email", "scoped_countries_" + suffix + "@test.local",
                "firstName", "Coun",
                "lastName", "Try" + suffix,
                "title", "Mr",
                "role", "ADMIN",
                "defaultParishId", parish1Id,
                "parishIds", Set.of(parish1Id),
                "defaultPassword", "secret12345"
        ));
        String scopedToken = login("scoped_countries_" + suffix, "secret12345");

        int status = mvc.perform(get("/api/dioceses/countries")
                        .header("Authorization", bearer(scopedToken)))
                .andReturn()
                .getResponse()
                .getStatus();
        assertThat(status).isNotEqualTo(200);
    }

    private static int nativeCacheSize(Cache cache) {
        Object nativeCache = cache.getNativeCache();
        if (nativeCache instanceof Map<?, ?> map) {
            return map.size();
        }
        return 0;
    }

    private String login(String username, String password) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("username", username, "password", password));
        String response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    private JsonNode createUser(String token, Map<String, ?> request) throws Exception {
        String response = mvc.perform(post("/api/admin/users")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response);
    }

    private Long createDiocese(String token, String name, String code) throws Exception {
        return createDiocese(token, name, code, null, null);
    }

    private Long createDiocese(String token, String name, String code, String countryCode, String countryName)
            throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("dioceseName", name);
        body.put("code", code);
        body.put("description", "Regression test diocese");
        if (countryCode != null && !countryCode.isBlank()) {
            body.put("countryCode", countryCode);
            body.put("countryName", countryName != null ? countryName : "Test Country");
        }
        String response = mvc.perform(post("/api/dioceses")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private Long createParish(String token, Long dioceseId, String parishName) throws Exception {
        String request = objectMapper.writeValueAsString(
                Map.of("parishName", parishName, "dioceseId", dioceseId, "description", "Regression test parish")
        );
        String response = mvc.perform(post("/api/parishes")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
