package com.wyloks.churchRegistry.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import lombok.extern.slf4j.Slf4j;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Configuration
@Slf4j
public class CorsConfig {

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    /**
     * Optional comma-separated Ant-style origin patterns (Spring CORS), e.g. {@code https://*.sacramentregistry.com}
     * so {@code app.}, {@code staging.}, etc. work without listing each host in {@code allowed-origins}.
     */
    @Value("${app.cors.allowed-origin-patterns:}")
    private String allowedOriginPatterns;

    /**
     * Fly/env often sets {@code CORS_ALLOWED_ORIGINS=} (empty string). That overrides YAML defaults but still
     * resolves to a blank property, so {@code @Value} defaults never apply — we previously fell through to
     * localhost-only and browsers on production origins got OPTIONS 403.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(Environment environment) {
        CorsConfiguration config = new CorsConfiguration();
        String originsRaw = effectiveAllowedOrigins(allowedOrigins, environment);
        List<String> origins = Arrays.stream(originsRaw.split(","))
                .map(CorsConfig::normalizeOriginToken)
                .filter(s -> !s.isEmpty())
                .toList();
        List<String> effective = origins.isEmpty() ? List.of("http://localhost:3000") : expandWwwApexMirrors(origins);
        config.setAllowedOrigins(effective);

        String patternsRaw = effectiveAllowedOriginPatterns(allowedOriginPatterns, environment);
        List<String> patterns = Arrays.stream(patternsRaw.split(","))
                .map(CorsConfig::normalizeOriginToken)
                .filter(s -> !s.isEmpty())
                .toList();
        if (!patterns.isEmpty()) {
            config.setAllowedOriginPatterns(patterns);
        }

        log.info(
                "CORS active: {} exact origin(s), {} pattern(s) — if browser preflight gets 403, check these match the Origin header (see fly logs)",
                effective.size(),
                patterns.size());
        log.debug("CORS allowed origins: {}", effective);
        log.debug("CORS allowed origin patterns: {}", patterns);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        // Wildcard: browsers may send Access-Control-Request-Headers with extras (e.g. baggage, sentry-trace).
        // A fixed list causes preflight 403 when any requested header is not listed.
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        // Register on /** so every path (including /api/...) is covered; avoids edge cases where only /api/** did not apply.
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /** Trim and strip trailing path slashes so {@code https://example.com/} matches browser {@code Origin: https://example.com}. */
    static String normalizeOriginToken(String raw) {
        if (raw == null) {
            return "";
        }
        String t = raw.trim();
        int scheme = t.indexOf("://");
        if (scheme < 0) {
            return t;
        }
        String afterScheme = t.substring(scheme + 3);
        if (afterScheme.isEmpty() || "/".equals(afterScheme)) {
            return t;
        }
        return t.replaceAll("/+$", "");
    }

    static boolean isDeployedProfile(Environment env) {
        if (env == null) {
            return false;
        }
        for (String p : env.getActiveProfiles()) {
            if (p == null) {
                continue;
            }
            String pl = p.toLowerCase(Locale.ROOT);
            if (pl.contains("prod") || pl.contains("staging") || "production".equals(pl)) {
                return true;
            }
        }
        return false;
    }

    static String effectiveAllowedOrigins(String configured, Environment environment) {
        String t = configured == null ? "" : configured.trim();
        if (!t.isEmpty()) {
            return t;
        }
        return isDeployedProfile(environment)
                ? "https://sacramentregistry.com,https://www.sacramentregistry.com"
                : "http://localhost:3000";
    }

    static String effectiveAllowedOriginPatterns(String configured, Environment environment) {
        String t = configured == null ? "" : configured.trim();
        if (!t.isEmpty()) {
            return t;
        }
        return isDeployedProfile(environment) ? "https://*.sacramentregistry.com" : "";
    }

    /**
     * For each configured {@code https://example.com} or {@code https://www.example.com} style origin
     * (exactly one dot in the registrable host, e.g. {@code sacramentregistry.com}), also allow the
     * www/apex counterpart so browsers on either host can call the API without listing both in env.
     * Does not mirror {@code app.example.com} or Fly-style hosts with multiple labels.
     */
    static List<String> expandWwwApexMirrors(List<String> origins) {
        Set<String> expanded = new LinkedHashSet<>(origins);
        for (String origin : origins) {
            try {
                URI uri = URI.create(origin);
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if (scheme == null || host == null) {
                    continue;
                }
                String lowerScheme = scheme.toLowerCase(Locale.ROOT);
                if (!"http".equals(lowerScheme) && !"https".equals(lowerScheme)) {
                    continue;
                }
                long dotCount = host.chars().filter(ch -> ch == '.').count();
                if (host.regionMatches(true, 0, "www.", 0, 4)) {
                    String apex = host.substring(4);
                    if (apex.chars().filter(ch -> ch == '.').count() == 1) {
                        expanded.add(rebuildOrigin(lowerScheme, apex, uri.getPort()));
                    }
                } else if (dotCount == 1) {
                    expanded.add(rebuildOrigin(lowerScheme, "www." + host, uri.getPort()));
                }
            } catch (IllegalArgumentException ignored) {
                // keep origin as-is only
            }
        }
        return new ArrayList<>(expanded);
    }

    private static String rebuildOrigin(String scheme, String host, int port) {
        if (port > 0) {
            return scheme + "://" + host + ":" + port;
        }
        return scheme + "://" + host;
    }
}
