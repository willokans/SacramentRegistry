package com.wyloks.churchRegistry.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.wyloks.churchRegistry.security.CurrentUserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.cache.support.CompositeCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Configuration
@EnableCaching
public class CacheConfig {

    public static final String CACHE_DIOCESES_WITH_PARISHES = "dioceses-with-parishes";
    public static final String CACHE_PARISHES_BY_DIOCESE = "parishes-by-diocese";
    public static final String CACHE_PARISH_DASHBOARD = "parish-dashboard";
    public static final String CACHE_DIOCESE_DASHBOARD = "diocese-dashboard";

    private static final Duration REDIS_CACHE_TTL = Duration.ofMinutes(10);

    @Bean
    public CacheManager cacheManager(
            @Autowired(required = false) RedisConnectionFactory redisConnectionFactory,
            ObjectMapper objectMapper) {
        CaffeineCacheManager dashboardCacheManager = new CaffeineCacheManager();
        dashboardCacheManager.registerCustomCache(CACHE_PARISH_DASHBOARD,
                Caffeine.newBuilder()
                        .expireAfterWrite(2, TimeUnit.MINUTES)
                        .maximumSize(500)
                        .build());
        dashboardCacheManager.registerCustomCache(CACHE_DIOCESE_DASHBOARD,
                Caffeine.newBuilder()
                        .expireAfterWrite(2, TimeUnit.MINUTES)
                        .maximumSize(100)
                        .build());

        org.springframework.cache.CacheManager diocesesParishesManager;
        if (redisConnectionFactory != null) {
            ObjectMapper cacheObjectMapper = objectMapper.copy();
            cacheObjectMapper.activateDefaultTyping(
                    cacheObjectMapper.getPolymorphicTypeValidator(),
                    ObjectMapper.DefaultTyping.NON_FINAL,
                    JsonTypeInfo.As.PROPERTY);
            GenericJackson2JsonRedisSerializer valueSerializer =
                    new GenericJackson2JsonRedisSerializer(cacheObjectMapper);

            RedisCacheConfiguration redisDefaults = RedisCacheConfiguration.defaultCacheConfig()
                    .entryTtl(REDIS_CACHE_TTL)
                    .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                    .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(valueSerializer));

            diocesesParishesManager = RedisCacheManager.builder(redisConnectionFactory)
                    .cacheDefaults(redisDefaults)
                    .withInitialCacheConfigurations(Map.of(
                            CACHE_DIOCESES_WITH_PARISHES, redisDefaults,
                            CACHE_PARISHES_BY_DIOCESE, redisDefaults))
                    .build();
        } else {
            diocesesParishesManager = new ConcurrentMapCacheManager(
                    CACHE_DIOCESES_WITH_PARISHES, CACHE_PARISHES_BY_DIOCESE);
        }

        CompositeCacheManager composite = new CompositeCacheManager();
        composite.setCacheManagers(Arrays.asList(diocesesParishesManager, dashboardCacheManager));
        return composite;
    }

    /**
     * Key generator that includes user context (admin vs parish-filtered) so cache entries
     * are isolated per user access. Prevents cross-tenant cache leakage.
     */
    @Bean
    public DioceseParishCacheKeyGenerator dioceseParishCacheKeyGenerator(CurrentUserAccessService currentUserAccessService) {
        return new DioceseParishCacheKeyGenerator(currentUserAccessService);
    }

    /**
     * Diocese dashboard responses must not be shared across users: {@code DIOCESE_ADMIN} scope differs from
     * {@code SUPER_ADMIN} and from other users' parish sets.
     */
    @Bean
    public DioceseDashboardCacheKeyGenerator dioceseDashboardCacheKeyGenerator(CurrentUserAccessService currentUserAccessService) {
        return new DioceseDashboardCacheKeyGenerator(currentUserAccessService);
    }

    public static class DioceseDashboardCacheKeyGenerator implements org.springframework.cache.interceptor.KeyGenerator {

        private final CurrentUserAccessService currentUserAccessService;

        public DioceseDashboardCacheKeyGenerator(CurrentUserAccessService currentUserAccessService) {
            this.currentUserAccessService = currentUserAccessService;
        }

        @Override
        public Object generate(Object target, java.lang.reflect.Method method, Object... params) {
            CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
            String userKey = currentUser.isSuperAdmin()
                    ? "super_admin"
                    : "parishes:" + currentUser.parishIds().stream()
                            .sorted()
                            .map(String::valueOf)
                            .collect(Collectors.joining(","));

            if (params != null && params.length > 0 && params[0] instanceof Long dioceseId) {
                return "diocese-dashboard:" + dioceseId + "::" + userKey;
            }
            return userKey;
        }
    }

    public static class DioceseParishCacheKeyGenerator implements org.springframework.cache.interceptor.KeyGenerator {

        private final CurrentUserAccessService currentUserAccessService;

        public DioceseParishCacheKeyGenerator(CurrentUserAccessService currentUserAccessService) {
            this.currentUserAccessService = currentUserAccessService;
        }

        @Override
        public Object generate(Object target, java.lang.reflect.Method method, Object... params) {
            CurrentUserAccessService.CurrentUserAccess currentUser = currentUserAccessService.currentUser();
            String userKey = currentUser.isSuperAdmin()
                    ? "super_admin"
                    : "parishes:" + currentUser.parishIds().stream()
                            .sorted()
                            .map(String::valueOf)
                            .collect(Collectors.joining(","));

            if (params != null && params.length > 0 && params[0] instanceof Long dioceseId) {
                return "diocese:" + dioceseId + "::" + userKey;
            }
            return userKey;
        }
    }
}
