package com.wyloks.churchRegistry.security;

import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression: request thread must see {@code app.is_admin} only for {@code SUPER_ADMIN} (Postgres RLS bypass),
 * and parish IDs for parish-scoped roles — same semantics as {@link RlsSessionContextTest}.
 */
class RlsSessionFilterTest {

    private final RlsSessionFilter filter = new RlsSessionFilter();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RlsSessionContext.clear();
    }

    @Test
    void duringRequest_parishScopedAdmin_setsIsAdminFalse() throws ServletException, IOException {
        setAuthentication("ADMIN", Set.of(5L, 7L));
        AtomicReference<RlsSessionContext.RlsValues> captured = new AtomicReference<>();

        filter.doFilterInternal(new MockHttpServletRequest(), new MockHttpServletResponse(),
                (req, res) -> captured.set(RlsSessionContext.get()));

        assertThat(captured.get().isAdmin()).isFalse();
        assertThat(captured.get().parishIds()).containsExactlyInAnyOrder(5L, 7L);
    }

    @Test
    void duringRequest_superAdmin_setsIsAdminTrue() throws ServletException, IOException {
        setAuthentication("SUPER_ADMIN", Collections.emptySet());
        AtomicReference<RlsSessionContext.RlsValues> captured = new AtomicReference<>();

        filter.doFilterInternal(new MockHttpServletRequest(), new MockHttpServletResponse(),
                (req, res) -> captured.set(RlsSessionContext.get()));

        assertThat(captured.get().isAdmin()).isTrue();
    }

    private static void setAuthentication(String role, Set<Long> parishAccessIds) {
        Set<Parish> accesses = parishAccessIds.stream()
                .map(id -> Parish.builder().id(id).build())
                .collect(Collectors.toSet());
        AppUser user = AppUser.builder()
                .username("filter-test-user")
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
