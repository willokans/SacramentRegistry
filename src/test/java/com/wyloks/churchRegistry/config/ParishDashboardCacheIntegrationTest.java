package com.wyloks.churchRegistry.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ParishDashboardCacheIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    CacheManager cacheManager;

    @Test
    void getDashboard_populatesCache_andSecondCallHitsCache() throws Exception {
        String token = loginAndGetToken("superadmin", "password");
        long parishId = getOrCreateParishId(token);

        org.springframework.cache.Cache dashboardCache = cacheManager.getCache(CacheConfig.CACHE_PARISH_DASHBOARD);
        assertThat(dashboardCache).isNotNull();
        dashboardCache.clear();

        long sizeBefore = getDashboardCacheSize(dashboardCache);
        assertThat(sizeBefore).isZero();

        // First call - populates cache
        mvc.perform(get("/api/parishes/{parishId}/dashboard", parishId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts").exists())
                .andExpect(jsonPath("$.counts.baptisms").exists());

        long sizeAfterFirst = getDashboardCacheSize(dashboardCache);
        assertThat(sizeAfterFirst).isEqualTo(1);

        // Second call - cache hit (no new cache entry)
        mvc.perform(get("/api/parishes/{parishId}/dashboard", parishId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts").exists());

        long sizeAfterSecond = getDashboardCacheSize(dashboardCache);
        assertThat(sizeAfterSecond).isEqualTo(1);
    }

    @Test
    void getDashboard_differentParishIdsHaveSeparateCacheEntries() throws Exception {
        String token = loginAndGetToken("superadmin", "password");
        long parishId1 = getOrCreateParishId(token);
        long parishId2 = getOrCreateSecondParishId(token, parishId1);

        org.springframework.cache.Cache dashboardCache = cacheManager.getCache(CacheConfig.CACHE_PARISH_DASHBOARD);
        assertThat(dashboardCache).isNotNull();
        dashboardCache.clear();

        // Request dashboard for first parish
        mvc.perform(get("/api/parishes/{parishId}/dashboard", parishId1)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        long sizeAfterFirst = getDashboardCacheSize(dashboardCache);
        assertThat(sizeAfterFirst).isEqualTo(1);

        // Request dashboard for second parish - adds new cache entry
        mvc.perform(get("/api/parishes/{parishId}/dashboard", parishId2)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        long sizeAfterSecond = getDashboardCacheSize(dashboardCache);
        assertThat(sizeAfterSecond).isEqualTo(2);
    }

    @Test
    void getDashboardCounts_returnsBatchCounts() throws Exception {
        String token = loginAndGetToken("superadmin", "password");
        long parishId = getOrCreateParishId(token);

        mvc.perform(get("/api/parishes/{parishId}/dashboard-counts", parishId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.baptisms").exists())
                .andExpect(jsonPath("$.communions").exists())
                .andExpect(jsonPath("$.confirmations").exists())
                .andExpect(jsonPath("$.marriages").exists())
                .andExpect(jsonPath("$.holyOrders").exists());
    }

    @Test
    void getDashboard_returnsExpectedStructure() throws Exception {
        String token = loginAndGetToken("superadmin", "password");
        long parishId = getOrCreateParishId(token);

        String response = mvc.perform(get("/api/parishes/{parishId}/dashboard", parishId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = objectMapper.readTree(response);
        assertThat(json.has("counts")).isTrue();
        assertThat(json.get("counts").has("baptisms")).isTrue();
        assertThat(json.get("counts").has("communions")).isTrue();
        assertThat(json.get("counts").has("confirmations")).isTrue();
        assertThat(json.get("counts").has("marriages")).isTrue();
        assertThat(json.get("counts").has("holyOrders")).isTrue();
        assertThat(json.has("baptisms")).isTrue();
        assertThat(json.has("communions")).isTrue();
        assertThat(json.has("confirmations")).isTrue();
        assertThat(json.has("marriages")).isTrue();
    }

    private long getDashboardCacheSize(org.springframework.cache.Cache cache) {
        if (cache == null) return 0;
        Object nativeCache = cache.getNativeCache();
        if (nativeCache instanceof Cache<?, ?> caffeineCache) {
            return caffeineCache.estimatedSize();
        }
        return 0;
    }

    private String loginAndGetToken(String username, String password) throws Exception {
        String response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    private long getOrCreateParishId(String token) throws Exception {
        String diocesesResponse = mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode dioceses = objectMapper.readTree(diocesesResponse);

        if (dioceses.isEmpty()) {
            return createDioceseAndParish(token);
        }

        long dioceseId = dioceses.get(0).get("id").asLong();
        String parishesResponse = mvc.perform(get("/api/dioceses/{dioceseId}/parishes", dioceseId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode parishes = objectMapper.readTree(parishesResponse);

        if (parishes.isEmpty()) {
            return createParish(token, dioceseId);
        }
        return parishes.get(0).get("id").asLong();
    }

    private long getOrCreateSecondParishId(String token, long existingParishId) throws Exception {
        String diocesesResponse = mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode dioceses = objectMapper.readTree(diocesesResponse);

        for (JsonNode diocese : dioceses) {
            long dioceseId = diocese.get("id").asLong();
            String parishesResponse = mvc.perform(get("/api/dioceses/{dioceseId}/parishes", dioceseId)
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            JsonNode parishes = objectMapper.readTree(parishesResponse);

            for (JsonNode parish : parishes) {
                long id = parish.get("id").asLong();
                if (id != existingParishId) {
                    return id;
                }
            }
        }

        long dioceseId = dioceses.get(0).get("id").asLong();
        return createParish(token, dioceseId);
    }

    private long createDioceseAndParish(String token) throws Exception {
        long seed = System.nanoTime();
        String dioceseRequest = objectMapper.writeValueAsString(
                new DiocesePayload("Dashboard Cache Diocese " + seed, "DCD" + (seed % 10000), "Dashboard cache test")
        );
        String dioceseResponse = mvc.perform(post("/api/dioceses")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(dioceseRequest))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        long dioceseId = objectMapper.readTree(dioceseResponse).get("id").asLong();
        return createParish(token, dioceseId);
    }

    private long createParish(String token, long dioceseId) throws Exception {
        long seed = System.nanoTime();
        String request = objectMapper.writeValueAsString(
                new ParishPayload("Dashboard Cache Parish " + seed, dioceseId, "Dashboard cache test")
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

    private record DiocesePayload(String dioceseName, String code, String description) {}
    private record ParishPayload(String parishName, Long dioceseId, String description) {}
}
