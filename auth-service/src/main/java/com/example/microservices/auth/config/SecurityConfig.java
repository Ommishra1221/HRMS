package com.example.microservices.auth.config;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.example.microservices.auth.security.JwtAuthenticationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletResponse;

/**
 * SecurityConfig = the rulebook for WHO may call WHAT in auth-service.
 *
 * Old tutorials use WebSecurityConfigurerAdapter - REMOVED in modern Spring
 * Security. The modern style (7.x, which Boot 4.1.1 brings) is declaring
 * @Bean methods like this one.
 *
 * What makes this API "stateless": we do NOT create sessions. Every request
 * must present its own JWT. The server remembers nothing between requests -
 * that is what lets the gateway stay a dumb pipe and any service scale freely.
 *
 * THE COMPLETE ACCESS MAP - there is no public signup any more:
 *
 *   POST /auth/login        permitAll()   the ONLY public door
 *   GET  /auth/me           authenticated any logged-in role may read itself
 *   /auth/users/**          hasRole(ADMIN) administrators create/manage accounts
 *   anything else           authenticated (role rules added later)
 */
@Configuration
@EnableWebSecurity
// Turns on @PreAuthorize on methods. UserController uses it as a second,
// per-endpoint lock on top of the URL rule below - two independent checks, so
// a future route accidentally placed outside /auth/users cannot silently open
// account creation to the world.
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
            // We are a pure REST API: no browser sessions, no CSRF tokens,
            // no login page. JWT in a header replaces ALL of that.
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                    // The ONLY public endpoint in the whole service. You need
                    // no token to GET a token - that is the entire point of
                    // login. /auth/register used to live here; it is GONE
                    // (accounts are created by an ADMIN via /auth/users).
                    .requestMatchers("/auth/login").permitAll()
                    // Account management. hasRole("ADMIN") matches the
                    // authority "ROLE_ADMIN" that the JWT filter read out of
                    // the token - so an HR or EMPLOYEE token gets 403 here.
                    .requestMatchers("/auth/users/**").hasRole("ADMIN")
                    // /auth/me and anything added later: must be logged in.
                    .anyRequest().authenticated())
            // Without this, an unauthenticated request gets the DEFAULT
            // 403 Forbidden. 401 Unauthorized is the CORRECT code for "no/
            // bad credentials" (and the frontend's axios interceptor auto-
            // logs-out on exactly this status).
            //
            // Both handlers are written by hand because Spring's defaults send
            // an EMPTY body - and this project promises every error to be
            // { timestamp, status, error, message } so the React UI can always
            // read `message`.
            .exceptionHandling(ex -> ex
                    .authenticationEntryPoint((request, response, authException) ->
                            writeError(response, HttpStatus.UNAUTHORIZED,
                                    "Authentication required: send a valid Bearer token"))
                    .accessDeniedHandler((request, response, accessDeniedException) ->
                            writeError(response, HttpStatus.FORBIDDEN,
                                    "Access denied: this operation requires the ADMIN role")))
            // Register our filter BEFORE the default username/password filter.
            // Order matters: by the time the authorization rules run, our
            // filter has already read the JWT and authenticated the user.
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

    /**
     * Exposes Spring's AuthenticationManager so AuthServiceImpl can call
     * authenticate() during login (it checks the BCrypt hash for us).
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * THE password hasher. BCrypt = slow on purpose + random salt per hash.
     * A plain password goes in; a "$2a$10$..." hash is stored. UserServiceImpl
     * encodes with it for every account an ADMIN creates or resets; Spring's
     * login check compares with it.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
