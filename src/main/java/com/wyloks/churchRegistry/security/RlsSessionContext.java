package com.wyloks.churchRegistry.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Holds RLS session values for the current request: {@code app.parish_ids} and {@code app.is_admin}.
 * {@link RlsValues#isAdmin()} is {@code true} only for {@code SUPER_ADMIN} (global RLS bypass).
 * Parish-scoped {@code ADMIN} uses {@link RlsValues#parishIds()} only; {@code app.is_admin} stays false.
 */
public final class RlsSessionContext {

    private static final ThreadLocal<RlsValues> HOLDER = new ThreadLocal<>();

    private RlsSessionContext() {}

    /**
     * Set RLS values for the current request. Call from filter after authentication.
     *
     * @param isAdmin {@code true} only for SUPER_ADMIN; maps to PostgreSQL {@code app.is_admin}.
     */
    public static void set(Set<Long> parishIds, boolean isAdmin) {
        HOLDER.set(new RlsValues(parishIds, isAdmin));
    }

    /**
     * Clear RLS values. Call from filter in finally block.
     */
    public static void clear() {
        HOLDER.remove();
    }

    /**
     * Get current RLS values. Returns empty/false if not set (e.g. unauthenticated).
     */
    public static RlsValues get() {
        RlsValues v = HOLDER.get();
        if (v != null) {
            return v;
        }
        // Fallback: try to derive from SecurityContext (e.g. if filter order differs)
        return deriveFromSecurityContext();
    }

    private static RlsValues deriveFromSecurityContext() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AppUserDetails details)) {
            return new RlsValues(Collections.emptySet(), false);
        }
        boolean superAdminRlsBypass = details.isSuperAdmin();
        Set<Long> parishIds = details.getParishAccessIds();
        return new RlsValues(parishIds != null ? parishIds : Collections.emptySet(), superAdminRlsBypass);
    }

    /**
     * @param isAdmin when {@code true}, PostgreSQL {@code app.is_admin} is set (SUPER_ADMIN global bypass only).
     */
    public record RlsValues(Set<Long> parishIds, boolean isAdmin) {
        public String parishIdsAsCommaSeparated() {
            if (parishIds == null || parishIds.isEmpty()) {
                return "";
            }
            return parishIds.stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(","));
        }
    }
}
