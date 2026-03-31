package com.wyloks.churchRegistry.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @Value("${app.sentry-test-endpoint.enabled:false}")
    private boolean sentryTestEndpointEnabled;

    @Value("${app.sentry-test-endpoint.key:}")
    private String sentryTestEndpointKey;

    @GetMapping
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @GetMapping("/sentry-test")
    public ResponseEntity<Void> sentryTest(
            @RequestHeader(value = "X-Sentry-Test-Key", required = false) String keyHeader
    ) {
        if (!sentryTestEndpointEnabled) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        if (!sentryTestEndpointKey.isBlank() && !sentryTestEndpointKey.equals(keyHeader)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        throw new RuntimeException("Manual Sentry test error from Spring backend");
    }
}
