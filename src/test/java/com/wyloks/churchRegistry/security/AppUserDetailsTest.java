package com.wyloks.churchRegistry.security;

import com.wyloks.churchRegistry.entity.AppUser;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AppUserDetailsTest {

    @Test
    void isSuperAdmin_true_forSuperAdminRole() {
        AppUser user = AppUser.builder()
                .username("u")
                .passwordHash("h")
                .role("SUPER_ADMIN")
                .build();
        assertThat(new AppUserDetails(user).isSuperAdmin()).isTrue();
    }

    @Test
    void isSuperAdmin_true_whenRoleHasDifferentCasingOrWhitespace() {
        AppUser lower = AppUser.builder()
                .username("u")
                .passwordHash("h")
                .role("super_admin")
                .build();
        assertThat(new AppUserDetails(lower).isSuperAdmin()).isTrue();

        AppUser spaced = AppUser.builder()
                .username("u")
                .passwordHash("h")
                .role("  SUPER_ADMIN  ")
                .build();
        assertThat(new AppUserDetails(spaced).isSuperAdmin()).isTrue();
    }

    @Test
    void isSuperAdmin_false_forParishScopedAdmin() {
        AppUser user = AppUser.builder()
                .username("u")
                .passwordHash("h")
                .role("ADMIN")
                .build();
        assertThat(new AppUserDetails(user).isSuperAdmin()).isFalse();
    }

    @Test
    void isSuperAdmin_false_forDioceseAdmin() {
        AppUser user = AppUser.builder()
                .username("u")
                .passwordHash("h")
                .role("DIOCESE_ADMIN")
                .build();
        assertThat(new AppUserDetails(user).isSuperAdmin()).isFalse();
    }

    @Test
    void isSuperAdmin_false_forNonAdminRoles() {
        for (String role : new String[] {"PARISH_PRIEST", "PRIEST", "PARISH_VIEWER", null, "", "  "}) {
            AppUser user = AppUser.builder()
                    .username("u")
                    .passwordHash("h")
                    .role(role)
                    .build();
            assertThat(new AppUserDetails(user).isSuperAdmin())
                    .as("role=%s", role)
                    .isFalse();
        }
    }
}
