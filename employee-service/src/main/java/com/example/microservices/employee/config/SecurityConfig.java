package com.example.microservices.employee.config;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.example.microservices.employee.security.JwtAuthenticationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletResponse;

/**
 * SecurityConfig = the rulebook for WHO may call WHAT in employee-service.
 *
 * employee-service has NO login endpoint - authentication happened in
 * auth-service (:8085), which signed the JWT this service only verifies.
 * Every endpoint here requires a valid token; the coarse gates are:
 *
 *   POST   /employees        hasRole(ADMIN)   create a master record
 *   PUT    /employees/{id}   hasRole(ADMIN)   update a master record
 *   DELETE /employees/{id}   hasRole(ADMIN)   delete a master record
 *   GET    /employees        hasAnyRole(ADMIN, HR)
 *   GET    /employees/me     EMPLOYEE self-service (own profile, from the JWT)
 *   GET    /employees/{id}   ADMIN/HR read it; an EMPLOYEE may only read their
 *                             OWN id - that ownership check is finer-grained
 *                             than URL matching, so it lives in the service
 *                             layer (CurrentUser + ForbiddenOperationException).
 *
 * WHY URL RULES *AND* @PreAuthorize? The URL rules here are the coarse gate;
 * @PreAuthorize on the controller methods is the same rule attached to the
 * method itself, so a future route remapping cannot silently widen access.
 * (The same two-lock pattern UserController in auth-service uses.)
 *
 * STATELESS, like every service in this project: no sessions, no CSRF - the
 * JWT in the Authorization header replaces all of that.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          ObjectMapper objectMapper) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Pure REST API: no browser sessions, no CSRF tokens, no login page.
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                    // Self-service first: /employees/me must match BEFORE the
                    // /employees/{id} rule below - "me" would otherwise be
                    // treated as an id path variable.
                    .requestMatchers("/employees/me").authenticated()
                    // Master-data reads: back-office roles only. An EMPLOYEE
                    // listing every employee would defeat the ownership model.
                    .requestMatchers(HttpMethod.GET, "/employees").hasAnyRole("ADMIN", "HR")
                    // Master-data writes: ADMIN only.
                    .requestMatchers(HttpMethod.POST, "/employees").hasRole("ADMIN")
                    .requestMatchers(HttpMethod.PUT, "/employees/*").hasRole("ADMIN")
                    .requestMatchers(HttpMethod.DELETE, "/employees/*").hasRole("ADMIN")
                    // Single-record read: ADMIN/HR by URL; an EMPLOYEE gets in
                    // here too, but the service layer then verifies that the
                    // requested id IS the caller's own employeeId (403 if not).
                    .requestMatchers(HttpMethod.GET, "/employees/*").hasAnyRole("ADMIN", "HR", "EMPLOYEE")
                    // Anything else (nothing today): must be logged in.
                    .anyRequest().authenticated())
            // Both handlers are written by hand because Spring's defaults send
            // an EMPTY body - and this project promises every error to be
            // { timestamp, status, error, message } so the React UI can always
            // read `message`. 401 = no/bad token, 403 = token fine, role not.
            .exceptionHandling(ex -> ex
                    .authenticationEntryPoint((request, response, authException) ->
                            writeError(response, HttpStatus.UNAUTHORIZED,
                                    "Authentication required: send a valid Bearer token"))
                    .accessDeniedHandler((request, response, accessDeniedException) ->
                            writeError(response, HttpStatus.FORBIDDEN,
                                    "Access denied: you do not have permission to perform this operation")))
            // Verify the JWT BEFORE the authorization rules run.
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * The same { timestamp, status, error, message } shape GlobalExceptionHandler
     * produces. Security filters run BEFORE the DispatcherServlet, so a 401/403
     * raised here never reaches @RestControllerAdvice - it has to be written
     * by hand to keep the error contract identical everywhere.
     */
    private void writeError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
