package com.wyloks.churchRegistry.security;

import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ensures RLS session flags match auth-split: only SUPER_ADMIN sets {@code app.is_admin}; ADMIN is parish-scoped.
 */
class RlsSessionContextTest {

    @AfterEach
    void tearDown() {
        RlsSessionContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void get_whenThreadLocalUnset_derivesIsAdminFalse_forParishAdminWithParishIds() {
        setAuthentication("ADMIN", Set.of(10L, 20L));

        RlsSessionContext.RlsValues values = RlsSessionContext.get();

        assertThat(values.isAdmin()).isFalse();
        assertThat(values.parishIds()).containsExactlyInAnyOrder(10L, 20L);
    }

    @Test
    void get_whenThreadLocalUnset_derivesIsAdminTrue_forSuperAdmin() {
        setAuthentication("SUPER_ADMIN", Collections.emptySet());

        RlsSessionContext.RlsValues values = RlsSessionContext.get();

        assertThat(values.isAdmin()).isTrue();
    }

    @Test
    void get_whenThreadLocalUnset_derivesIsAdminFalse_forPriest() {
        setAuthentication("PARISH_PRIEST", Set.of(5L));

        assertThat(RlsSessionContext.get().isAdmin()).isFalse();
    }

    @Test
    void set_mirrorsFilter_superAdminBypassPropagatesToGet() {
        RlsSessionContext.set(Set.of(1L), true);

        RlsSessionContext.RlsValues values = RlsSessionContext.get();

        assertThat(values.isAdmin()).isTrue();
        assertThat(values.parishIds()).containsExactly(1L);
    }

    private static void setAuthentication(String role, Set<Long> parishAccessIds) {
        Set<Parish> accesses = parishAccessIds.stream()
                .map(id -> Parish.builder().id(id).build())
                .collect(Collectors.toSet());
        AppUser user = AppUser.builder()
                .username("rls-test")
                .passwordHash("x")
                .role(role)
                .parish(null)
                .parishAccesses(accesses)
                .build();
        AppUserDetails details = new AppUserDetails(user);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                details,
                null,
                details.getAuthorities()
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
