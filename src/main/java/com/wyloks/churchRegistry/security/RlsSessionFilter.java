package com.wyloks.churchRegistry.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Set;

/**
 * Sets RLS session context from the current user before each request.
 * Must run after JwtAuthFilter so SecurityContext is populated.
 */
@Component
@Profile("!auth-slice")
public class RlsSessionFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof AppUserDetails details) {
                boolean superAdminRlsBypass = details.isSuperAdmin();
                Set<Long> parishIds = details.getParishAccessIds();
                RlsSessionContext.set(parishIds != null ? parishIds : Collections.emptySet(), superAdminRlsBypass);
            } else {
                RlsSessionContext.set(Collections.emptySet(), false);
            }
            filterChain.doFilter(request, response);
        } finally {
            RlsSessionContext.clear();
        }
    }
}
