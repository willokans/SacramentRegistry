package com.wyloks.churchRegistry.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.CorsProcessor;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.cors.DefaultCorsProcessor;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limits all HTTP entry points except health, CORS preflight, and Spring {@code /error}.
 * Login: {@code /api/auth/login} uses a strict bucket (default 5 attempts per 15 minutes per client IP).
 * Forgot-password: {@code /api/auth/forgot-password} uses its own bucket (default 5 per 15 minutes per IP).
 * Refresh/logout share a separate bucket; everything else shares the general API bucket.
 * Client key: {@code X-Forwarded-For} first hop when present, else remote address.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private final int loginLimit;
    private final int loginPeriodMinutes;
    private final int forgotPasswordLimit;
    private final int forgotPasswordPeriodMinutes;
    private final int refreshLimit;
    private final int refreshPeriodMinutes;
    private final int apiLimit;
    private final int apiPeriodMinutes;

    private final CorsConfigurationSource corsConfigurationSource;
    private final CorsProcessor corsProcessor = new DefaultCorsProcessor();

    private final Map<String, Bucket> loginBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> forgotPasswordBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> refreshBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> apiBuckets = new ConcurrentHashMap<>();

    public RateLimitFilter(
            int loginLimit,
            int loginPeriodMinutes,
            int forgotPasswordLimit,
            int forgotPasswordPeriodMinutes,
            int refreshLimit,
            int refreshPeriodMinutes,
            int apiLimit,
            int apiPeriodMinutes,
            CorsConfigurationSource corsConfigurationSource) {
        this.loginLimit = loginLimit;
        this.loginPeriodMinutes = loginPeriodMinutes;
        this.forgotPasswordLimit = forgotPasswordLimit;
        this.forgotPasswordPeriodMinutes = forgotPasswordPeriodMinutes;
        this.refreshLimit = refreshLimit;
        this.refreshPeriodMinutes = refreshPeriodMinutes;
        this.apiLimit = apiLimit;
        this.apiPeriodMinutes = apiPeriodMinutes;
        this.corsConfigurationSource = corsConfigurationSource;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientKey = resolveClientKey(request);
        String path = request.getRequestURI();

        Bucket bucket = resolveBucket(path, clientKey);
        if (bucket != null) {
            if (!bucket.tryConsume(1)) {
                writeTooManyRequests(request, response);
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveClientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String remote = request.getRemoteAddr();
        return remote != null ? remote : "unknown";
    }

    private Bucket resolveBucket(String path, String clientKey) {
        if (path == null) return null;
        if (path.startsWith("/api/health")) return null; // load balancer / probes
        if (path.startsWith("/error")) return null; // avoid compounding failures on error dispatch
        if (path.startsWith("/api/auth/login")) {
            return loginBuckets.computeIfAbsent(clientKey, k -> buildBucket(loginLimit, loginPeriodMinutes));
        }
        if (path.startsWith("/api/auth/forgot-password")) {
            return forgotPasswordBuckets.computeIfAbsent(
                    clientKey, k -> buildBucket(forgotPasswordLimit, forgotPasswordPeriodMinutes));
        }
        if (path.startsWith("/api/auth/refresh") || path.startsWith("/api/auth/logout")) {
            return refreshBuckets.computeIfAbsent(clientKey, k -> buildBucket(refreshLimit, refreshPeriodMinutes));
        }
        return apiBuckets.computeIfAbsent(clientKey, k -> buildBucket(apiLimit, apiPeriodMinutes));
    }

    private Bucket buildBucket(int capacity, int periodMinutes) {
        Bandwidth limit = Bandwidth.builder()
                .capacity(capacity)
                .refillGreedy(capacity, Duration.ofMinutes(periodMinutes))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    /**
     * This filter runs before Spring Security's {@code CorsFilter}. Without CORS headers, browsers
     * report a network error ("Failed to fetch") for cross-origin responses such as 429.
     */
    private void writeTooManyRequests(HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (CorsUtils.isCorsRequest(request)) {
            CorsConfiguration config = corsConfigurationSource.getCorsConfiguration(request);
            if (config != null) {
                this.corsProcessor.processRequest(config, request, response);
            }
        }
        response.setStatus(429);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Too many requests. Please try again later.\"}");
    }
}
