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
class DioceseDashboardCacheIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    CacheManager cacheManager;

    @Test
    void getDioceseDashboard_populatesCache_andSecondCallHitsCache() throws Exception {
        String token = loginAndGetToken("superadmin", "password");
        long dioceseId = getOrCreateDioceseId(token);

        org.springframework.cache.Cache dashboardCache = cacheManager.getCache(CacheConfig.CACHE_DIOCESE_DASHBOARD);
        assertThat(dashboardCache).isNotNull();
        dashboardCache.clear();

        long sizeBefore = getDashboardCacheSize(dashboardCache);
        assertThat(sizeBefore).isZero();

        // First call - populates cache
        mvc.perform(get("/api/dioceses/{dioceseId}/dashboard", dioceseId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts").exists())
                .andExpect(jsonPath("$.counts.parishes").exists())
                .andExpect(jsonPath("$.counts.baptisms").exists());

        long sizeAfterFirst = getDashboardCacheSize(dashboardCache);
        assertThat(sizeAfterFirst).isEqualTo(1);

        // Second call - cache hit (no new cache entry)
        mvc.perform(get("/api/dioceses/{dioceseId}/dashboard", dioceseId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts").exists());

        long sizeAfterSecond = getDashboardCacheSize(dashboardCache);
        assertThat(sizeAfterSecond).isEqualTo(1);
    }

    @Test
    void getDioceseDashboard_differentDioceseIdsHaveSeparateCacheEntries() throws Exception {
        String token = loginAndGetToken("superadmin", "password");
        long dioceseId1 = getOrCreateDioceseId(token);
        long dioceseId2 = getOrCreateSecondDioceseId(token, dioceseId1);

        org.springframework.cache.Cache dashboardCache = cacheManager.getCache(CacheConfig.CACHE_DIOCESE_DASHBOARD);
        assertThat(dashboardCache).isNotNull();
        dashboardCache.clear();

        // Request dashboard for first diocese
        mvc.perform(get("/api/dioceses/{dioceseId}/dashboard", dioceseId1)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        long sizeAfterFirst = getDashboardCacheSize(dashboardCache);
        assertThat(sizeAfterFirst).isEqualTo(1);

        // Request dashboard for second diocese - adds new cache entry
        mvc.perform(get("/api/dioceses/{dioceseId}/dashboard", dioceseId2)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        long sizeAfterSecond = getDashboardCacheSize(dashboardCache);
        assertThat(sizeAfterSecond).isEqualTo(2);
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

    private long getOrCreateDioceseId(String token) throws Exception {
        String diocesesResponse = mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode dioceses = objectMapper.readTree(diocesesResponse);

        if (dioceses.isEmpty()) {
            return createDiocese(token);
        }
        return dioceses.get(0).get("id").asLong();
    }

    private long getOrCreateSecondDioceseId(String token, long existingDioceseId) throws Exception {
        String diocesesResponse = mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode dioceses = objectMapper.readTree(diocesesResponse);

        for (JsonNode diocese : dioceses) {
            long id = diocese.get("id").asLong();
            if (id != existingDioceseId) {
                return id;
            }
        }
        return createDiocese(token);
    }

    private long createDiocese(String token) throws Exception {
        long seed = System.nanoTime();
        String dioceseRequest = objectMapper.writeValueAsString(
                new DiocesePayload("Diocese Dashboard Cache Diocese " + seed, "DDCD" + (seed % 10000), "Diocese dashboard cache test")
        );
        String dioceseResponse = mvc.perform(post("/api/dioceses")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(dioceseRequest))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(dioceseResponse).get("id").asLong();
    }

    private record DiocesePayload(String dioceseName, String code, String description) {}
}
