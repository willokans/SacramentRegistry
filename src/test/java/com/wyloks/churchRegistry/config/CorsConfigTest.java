package com.wyloks.churchRegistry.config;

import org.junit.jupiter.api.Test;

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
}
