package com.example.microservices.probation.config;

import java.time.OffsetDateTime;
import java.util.Map;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import com.example.microservices.probation.security.JwtAuthenticationFilter;
import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean SecurityFilterChain filterChain(HttpSecurity http, JwtAuthenticationFilter jwt, ObjectMapper mapper) throws Exception {
        return http.csrf(c -> c.disable()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a.requestMatchers("/probation/**").hasAnyRole("ADMIN", "HR", "EMPLOYEE").anyRequest().denyAll())
            .exceptionHandling(e -> e.authenticationEntryPoint((q,r,x) -> write(r, mapper, 401, "Unauthorized", "A valid Bearer token with userId is required"))
                .accessDeniedHandler((q,r,x) -> write(r, mapper, 403, "Forbidden", "You are not authorized to perform this action")))
            .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class).build();
    }
    private static void write(jakarta.servlet.http.HttpServletResponse response, ObjectMapper mapper,
        int status, String error, String message) throws java.io.IOException {
        response.setStatus(status); response.setContentType("application/json");
        response.getWriter().write(mapper.writeValueAsString(Map.of("timestamp", OffsetDateTime.now().toString(), "status", status, "error", error, "message", message)));
    }
}
