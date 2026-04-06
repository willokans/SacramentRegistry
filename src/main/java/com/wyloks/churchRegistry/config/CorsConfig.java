package com.wyloks.churchRegistry.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Configuration
public class CorsConfig {

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        List<String> effective = origins.isEmpty() ? List.of("http://localhost:3000") : expandWwwApexMirrors(origins);
        config.setAllowedOrigins(effective);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setExposedHeaders(List.of("Authorization"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
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
