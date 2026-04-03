package com.wyloks.churchRegistry.config;

import com.wyloks.churchRegistry.security.JwtAuthFilter;
import com.wyloks.churchRegistry.security.RlsSessionFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
@Profile("!auth-slice")
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RlsSessionFilter rlsSessionFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(c -> {})
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> res.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized"))
                        .accessDeniedHandler((req, res, ex) -> {
                            HttpStatus status = HttpStatus.FORBIDDEN;
                            String message = ex.getMessage() != null ? ex.getMessage() : status.getReasonPhrase();
                            String escapedMessage = message
                                    .replace("\\", "\\\\")
                                    .replace("\"", "\\\"");
                            res.setStatus(status.value());
                            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            res.getWriter().write("{\"status\":" + status.value()
                                    + ",\"error\":\"" + status.getReasonPhrase()
                                    + "\",\"message\":\"" + escapedMessage + "\"}");
                        }))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/health").permitAll()
                        .requestMatchers("/api/health/sentry-test").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/auth/login", "/api/auth/refresh", "/api/auth/logout",
                        "/api/auth/forgot-password", "/api/auth/reset-password-by-token", "/api/auth/accept-invite").permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs", "/v3/api-docs/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/admin/users").hasRole("SUPER_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/admin/users/invitations").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/admin/users/invitations/*/resend").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/admin/users/invitations/*/revoke").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/dioceses").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/parishes").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers(HttpMethod.POST,
                                "/api/parishes/*/baptisms",
                                "/api/communions",
                                "/api/confirmations",
                                "/api/marriages",
                                "/api/marriages/with-parties")
                        .hasAnyRole("ADMIN", "PRIEST", "PARISH_PRIEST", "PARISH_SECRETARY")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().denyAll())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rlsSessionFilter, JwtAuthFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
