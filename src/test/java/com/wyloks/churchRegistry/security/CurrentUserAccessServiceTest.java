package com.wyloks.churchRegistry.security;

import com.wyloks.churchRegistry.entity.AppUser;
import com.wyloks.churchRegistry.entity.Parish;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CurrentUserAccessServiceTest {

    private CurrentUserAccessService service;

    @BeforeEach
    void setUp() {
        service = new CurrentUserAccessService();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void currentUser_mapsSuperAdmin_andServiceIsSuperAdminTrue() {
        setAuthentication("superadmin", "super_admin", Set.of(1L));

        CurrentUserAccessService.CurrentUserAccess access = service.currentUser();

        assertThat(access.username()).isEqualTo("superadmin");
        assertThat(access.role()).isEqualTo("SUPER_ADMIN");
        assertThat(access.parishIds()).containsExactlyInAnyOrder(1L);
        assertThat(access.isSuperAdmin()).isTrue();
        assertThat(access.isAdmin()).isTrue();
        assertThat(service.isSuperAdmin()).isTrue();
    }

    @Test
    void currentUser_mapsAdmin_isAdminTrue_isSuperAdminFalse() {
        setAuthentication("admin", "admin", Set.of(10L, 20L));

        CurrentUserAccessService.CurrentUserAccess access = service.currentUser();

        assertThat(access.role()).isEqualTo("ADMIN");
        assertThat(access.parishIds()).containsExactlyInAnyOrder(10L, 20L);
        assertThat(access.isAdmin()).isTrue();
        assertThat(access.isSuperAdmin()).isFalse();
        assertThat(service.isSuperAdmin()).isFalse();
    }

    @Test
    void currentUser_normalizesRoleCase() {
        setAuthentication("u", "  Admin  ", Collections.emptySet());

        assertThat(service.currentUser().role()).isEqualTo("ADMIN");
    }

    @Test
    void currentUser_throws403_whenNotAuthenticated() {
        assertThatThrownBy(() -> service.currentUser())
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> service.isSuperAdmin())
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void currentUser_throws403_whenPrincipalIsNotAppUserDetails() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "anonymous", null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThatThrownBy(() -> service.currentUser())
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex ->
                        assertThat(((ResponseStatusException) ex).getReason()).contains("Invalid authentication principal"));
    }

    @Test
    void currentUser_throws403_whenRoleMissing() {
        setAuthentication("norole", null, Set.of());

        assertThatThrownBy(() -> service.currentUser())
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex ->
                        assertThat(((ResponseStatusException) ex).getReason()).contains("Role is required"));
    }

    private void setAuthentication(String username, String role, Set<Long> parishIds) {
        Set<Parish> accesses = parishIds.stream()
                .map(id -> Parish.builder().id(id).build())
                .collect(Collectors.toSet());
        AppUser user = AppUser.builder()
                .username(username)
                .passwordHash("h")
                .role(role)
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
