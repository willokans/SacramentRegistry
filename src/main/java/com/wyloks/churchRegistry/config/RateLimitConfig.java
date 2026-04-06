package com.wyloks.churchRegistry.config;

import com.wyloks.churchRegistry.security.RateLimitFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@Profile("!auth-slice")
public class RateLimitConfig {

    @Bean
    public RateLimitFilter rateLimitFilter(
            CorsConfigurationSource corsConfigurationSource,
            @Value("${app.rate-limit.login.limit:5}") int loginLimit,
            @Value("${app.rate-limit.login.period-minutes:15}") int loginPeriodMinutes,
            @Value("${app.rate-limit.forgot-password.limit:5}") int forgotPasswordLimit,
            @Value("${app.rate-limit.forgot-password.period-minutes:15}") int forgotPasswordPeriodMinutes,
            @Value("${app.rate-limit.refresh.limit:15}") int refreshLimit,
            @Value("${app.rate-limit.refresh.period-minutes:1}") int refreshPeriodMinutes,
            @Value("${app.rate-limit.api.limit:300}") int apiLimit,
            @Value("${app.rate-limit.api.period-minutes:1}") int apiPeriodMinutes) {
        return new RateLimitFilter(
                loginLimit,
                loginPeriodMinutes,
                forgotPasswordLimit,
                forgotPasswordPeriodMinutes,
                refreshLimit,
                refreshPeriodMinutes,
                apiLimit,
                apiPeriodMinutes,
                corsConfigurationSource);
    }

    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(RateLimitFilter filter) {
        FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE); // Run before Spring Security
        registration.addUrlPatterns("/*");
        return registration;
    }
}
