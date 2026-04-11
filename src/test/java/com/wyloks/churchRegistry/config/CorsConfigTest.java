package com.wyloks.churchRegistry.config;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.core.env.Environment;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CorsConfigTest {

    @Test
    void expandWwwApexMirrors_addsWwwForApexHttps() {
        assertThat(CorsConfig.expandWwwApexMirrors(List.of("https://sacramentregistry.com")))
                .containsExactlyInAnyOrder("https://sacramentregistry.com", "https://www.sacramentregistry.com");
    }

    @Test
    void expandWwwApexMirrors_addsApexForWww() {
        assertThat(CorsConfig.expandWwwApexMirrors(List.of("https://www.sacramentregistry.com")))
                .containsExactlyInAnyOrder("https://www.sacramentregistry.com", "https://sacramentregistry.com");
    }

    @Test
    void expandWwwApexMirrors_doesNotMirrorAppSubdomain() {
        assertThat(CorsConfig.expandWwwApexMirrors(List.of("https://app.sacramentregistry.com")))
                .containsExactly("https://app.sacramentregistry.com");
    }

    @Test
    void expandWwwApexMirrors_preservesFlyDev() {
        assertThat(CorsConfig.expandWwwApexMirrors(List.of("https://church-registry.fly.dev")))
                .containsExactly("https://church-registry.fly.dev");
    }

    @Test
    void effectiveAllowedOrigins_blankWhenDeployed_usesSacramentRegistry() {
        Environment env = Mockito.mock(Environment.class);
        Mockito.when(env.getActiveProfiles()).thenReturn(new String[] {"prod"});
        assertThat(CorsConfig.effectiveAllowedOrigins("", env))
                .isEqualTo("https://sacramentregistry.com,https://www.sacramentregistry.com");
        assertThat(CorsConfig.effectiveAllowedOrigins("   ", env))
                .isEqualTo("https://sacramentregistry.com,https://www.sacramentregistry.com");
    }

    @Test
    void effectiveAllowedOrigins_blankWhenLocal_usesLocalhost() {
        Environment env = Mockito.mock(Environment.class);
        Mockito.when(env.getActiveProfiles()).thenReturn(new String[] {"default"});
        assertThat(CorsConfig.effectiveAllowedOrigins("", env)).isEqualTo("http://localhost:3000");
    }

    @Test
    void effectiveAllowedOrigins_nonBlank_unchanged() {
        Environment env = Mockito.mock(Environment.class);
        Mockito.when(env.getActiveProfiles()).thenReturn(new String[] {"prod"});
        assertThat(CorsConfig.effectiveAllowedOrigins("https://custom.example", env)).isEqualTo("https://custom.example");
    }

    @Test
    void effectiveAllowedPatterns_blankWhenDeployed_usesSubdomainPattern() {
        Environment env = Mockito.mock(Environment.class);
        Mockito.when(env.getActiveProfiles()).thenReturn(new String[] {"staging"});
        assertThat(CorsConfig.effectiveAllowedOriginPatterns("", env)).isEqualTo("https://*.sacramentregistry.com");
    }

    @Test
    void effectiveAllowedPatterns_blankWhenLocal_empty() {
        Environment env = Mockito.mock(Environment.class);
        Mockito.when(env.getActiveProfiles()).thenReturn(new String[] {"default"});
        assertThat(CorsConfig.effectiveAllowedOriginPatterns("", env)).isEmpty();
    }
}
