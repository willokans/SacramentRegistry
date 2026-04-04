package com.wyloks.churchRegistry.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DioceseParishCacheIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    CacheManager cacheManager;

    @Test
    void findDiocesesWithParishes_populatesCache_andSecondCallHitsCache() throws Exception {
        String token = loginAndGetToken("superadmin", "password");

        Cache diocesesCache = cacheManager.getCache(CacheConfig.CACHE_DIOCESES_WITH_PARISHES);
        assertThat(diocesesCache).isNotNull();

        // First call - populates cache
        mvc.perform(get("/api/dioceses/with-parishes")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        int sizeAfterFirst = getCacheSize(diocesesCache);
        assertThat(sizeAfterFirst).isGreaterThanOrEqualTo(1);

        // Second call - cache hit (same response, no new cache entry)
        mvc.perform(get("/api/dioceses/with-parishes")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        int sizeAfterSecond = getCacheSize(diocesesCache);
        assertThat(sizeAfterSecond).isEqualTo(sizeAfterFirst);
    }

    @Test
    void createDiocese_evictsDiocesesAndParishesCaches() throws Exception {
        String token = loginAndGetToken("superadmin", "password");

        // Populate cache
        mvc.perform(get("/api/dioceses/with-parishes")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        Cache diocesesCache = cacheManager.getCache(CacheConfig.CACHE_DIOCESES_WITH_PARISHES);
        Cache parishesCache = cacheManager.getCache(CacheConfig.CACHE_PARISHES_BY_DIOCESE);
        assertThat(getCacheSize(diocesesCache)).isGreaterThanOrEqualTo(1);

        // Create diocese - should evict both caches
        long seed = System.nanoTime();
        String request = objectMapper.writeValueAsString(
                new DiocesePayload("Cache Evict Diocese " + seed, "CED" + (seed % 10000), "Cache eviction test")
        );
        mvc.perform(post("/api/dioceses")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated());

        assertThat(getCacheSize(diocesesCache)).isZero();
        assertThat(getCacheSize(parishesCache)).isZero();
    }

    @Test
    void findByDioceseId_populatesParishesCache() throws Exception {
        String token = loginAndGetToken("superadmin", "password");

        // Get a diocese id first
        String diocesesResponse = mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode dioceses = objectMapper.readTree(diocesesResponse);
        if (dioceses.isEmpty()) {
            // Create one if none exist
            long seed = System.nanoTime();
            String createRequest = objectMapper.writeValueAsString(
                    new DiocesePayload("Parish Cache Diocese " + seed, "PCD" + (seed % 10000), "Parish cache test")
            );
            String createResponse = mvc.perform(post("/api/dioceses")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(createRequest))
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            long dioceseId = objectMapper.readTree(createResponse).get("id").asLong();

            mvc.perform(get("/api/dioceses/{dioceseId}/parishes", dioceseId)
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());

            Cache parishesCache = cacheManager.getCache(CacheConfig.CACHE_PARISHES_BY_DIOCESE);
            assertThat(getCacheSize(parishesCache)).isGreaterThanOrEqualTo(1);
        } else {
            long dioceseId = dioceses.get(0).get("id").asLong();

            Cache parishesCache = cacheManager.getCache(CacheConfig.CACHE_PARISHES_BY_DIOCESE);
            int sizeBefore = getCacheSize(parishesCache);

            mvc.perform(get("/api/dioceses/{dioceseId}/parishes", dioceseId)
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());

            assertThat(getCacheSize(parishesCache)).isGreaterThanOrEqualTo(sizeBefore + 1);
        }
    }

    @Test
    void createParish_evictsDiocesesAndParishesCaches() throws Exception {
        String token = loginAndGetToken("superadmin", "password");

        // Ensure we have a diocese
        String diocesesResponse = mvc.perform(get("/api/dioceses")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode dioceses = objectMapper.readTree(diocesesResponse);
        long dioceseId = dioceses.isEmpty()
                ? createDiocese(token)
                : dioceses.get(0).get("id").asLong();

        // Populate parishes cache
        mvc.perform(get("/api/dioceses/{dioceseId}/parishes", dioceseId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        Cache parishesCache = cacheManager.getCache(CacheConfig.CACHE_PARISHES_BY_DIOCESE);
        assertThat(getCacheSize(parishesCache)).isGreaterThanOrEqualTo(1);

        // Create parish - should evict both caches
        long seed = System.nanoTime();
        String request = objectMapper.writeValueAsString(
                new ParishPayload("Cache Evict Parish " + seed, dioceseId, "Cache eviction test")
        );
        mvc.perform(post("/api/parishes")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated());

        assertThat(getCacheSize(parishesCache)).isZero();
        assertThat(getCacheSize(cacheManager.getCache(CacheConfig.CACHE_DIOCESES_WITH_PARISHES))).isZero();
    }

    private int getCacheSize(Cache cache) {
        if (cache == null) return 0;
        Object nativeCache = cache.getNativeCache();
        if (nativeCache instanceof Map<?, ?> map) {
            return map.size();
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

    private long createDiocese(String token) throws Exception {
        long seed = System.nanoTime();
        String request = objectMapper.writeValueAsString(
                new DiocesePayload("Cache Test Diocese " + seed, "CTD" + (seed % 10000), "Cache test")
        );
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

    private record DiocesePayload(String dioceseName, String code, String description) {}
    private record ParishPayload(String parishName, Long dioceseId, String description) {}
}
