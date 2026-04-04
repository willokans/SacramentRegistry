package com.wyloks.churchRegistry.security;

import com.wyloks.churchRegistry.entity.AppUser;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class AppUserDetails implements UserDetails {

    private final AppUser user;
    private final String role;
    private final Long parishId;
    private final Set<Long> parishAccessIds;

    /**
     * Builds parish scope from app_user_parish_access (source of truth).
     * Falls back to parish_id for legacy users who have no parish_access rows.
     */
    public AppUserDetails(AppUser user) {
        this.user = user;
        this.role = user.getRole();
        this.parishId = user.getParish() != null ? user.getParish().getId() : null;
        this.parishAccessIds = new HashSet<>();
        if (user.getParishAccesses() != null) {
            user.getParishAccesses().stream()
                    .filter(p -> p != null && p.getId() != null)
                    .forEach(p -> this.parishAccessIds.add(p.getId()));
        }
        if (this.parishAccessIds.isEmpty() && this.parishId != null) {
            this.parishAccessIds.add(this.parishId);
        }
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        if (role == null || role.isBlank()) {
            return Collections.emptyList();
        }
        return Stream.of("ROLE_" + role.toUpperCase())
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    public AppUser getAppUser() {
        return user;
    }

    public String getRole() {
        return role;
    }

    public Long getParishId() {
        return parishId;
    }

    public Set<Long> getParishAccessIds() {
        return Collections.unmodifiableSet(parishAccessIds);
    }

    /** Global bypass for RLS and parish checks; not granted to parish-scoped {@code ADMIN}. */
    public boolean isSuperAdmin() {
        return role != null && "SUPER_ADMIN".equals(role.trim().toUpperCase(Locale.ROOT));
    }
}
