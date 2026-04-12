package com.wyloks.churchRegistry.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Set;

@Component
public class CurrentUserAccessService {

    public CurrentUserAccess currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw forbidden("Authentication required");
        }

        Object principal = authentication.getPrincipal();
        if (!(principal instanceof AppUserDetails userDetails)) {
            throw forbidden("Invalid authentication principal");
        }

        String role = normalizeRole(userDetails.getRole());
        if (role == null) {
            throw forbidden("Role is required");
        }

        return new CurrentUserAccess(userDetails.getUsername(), role, userDetails.getParishAccessIds());
    }

    /** True when the current principal is {@code SUPER_ADMIN} (global bypass). */
    public boolean isSuperAdmin() {
        return currentUser().isSuperAdmin();
    }

    /** True when the current principal is {@code DIOCESE_ADMIN}. */
    public boolean isDioceseAdmin() {
        return currentUser().isDioceseAdmin();
    }

    /**
     * True when the caller may use the diocesan dashboard API ({@code SUPER_ADMIN} or {@code DIOCESE_ADMIN}).
     * Parish-scoped {@code ADMIN} must not use diocese-wide aggregates.
     */
    public boolean canAccessDioceseDashboard() {
        return currentUser().canAccessDioceseDashboard();
    }

    /**
     * Returns the username of the currently authenticated user.
     * @throws ResponseStatusException 403 if not authenticated
     */
    public String getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw forbidden("Authentication required");
        }
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof AppUserDetails userDetails)) {
            throw forbidden("Invalid authentication principal");
        }
        return userDetails.getUsername();
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        return role.trim().toUpperCase(Locale.ROOT);
    }

    private ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }

    public record CurrentUserAccess(String username, String role, Set<Long> parishIds) {
        /**
         * True for parish {@code ADMIN}, {@code DIOCESE_ADMIN}, or {@code SUPER_ADMIN}.
         * Prefer {@link #isSuperAdmin()} when the decision is global bypass vs parish-scoped access.
         */
        public boolean isAdmin() {
            return "ADMIN".equals(role) || "DIOCESE_ADMIN".equals(role) || "SUPER_ADMIN".equals(role);
        }

        public boolean isSuperAdmin() {
            return "SUPER_ADMIN".equals(role);
        }

        public boolean isDioceseAdmin() {
            return "DIOCESE_ADMIN".equals(role);
        }

        public boolean canAccessDioceseDashboard() {
            return isSuperAdmin() || isDioceseAdmin();
        }
    }
}
