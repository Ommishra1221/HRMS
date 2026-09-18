package com.example.microservices.auth.security;

import java.io.IOException;
import java.util.List;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * JwtAuthenticationFilter = runs ONCE per request, BEFORE the authorization
 * rules, and answers one question: "does this request carry a valid JWT?"
 *
 * THE HANDSHAKE, step by step:
 * 1. Client sends:  Authorization: Bearer eyJhbGciOi...
 * 2. We grab the header, strip the "Bearer " prefix.
 * 3. JwtUtil validates signature + expiry (invalid -> no authentication set).
 * 4. We build an Authentication object (username + roles from the token)
 *    and park it in SecurityContextHolder - Spring's "who is calling?" slot.
 * 5. SecurityConfig's rules then run: hasRole("ADMIN") sees the authority
 *    "ROLE_ADMIN" taken straight from the token, so the request is allowed or
 *    refused on the role ALREADY PROVEN by the signature - no DB lookup, no
 *    second service call.
 *
 * No header / bad token = empty context = the request is "anonymous" ->
 * the rules reject it with 401/403. We deliberately do NOT stop the chain
 * ourselves; we just decline to authenticate.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtAuthenticationFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        // No Bearer header? (the /auth/login request looks like this.)
        // Leave the context empty and move on - the rules decide next.
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7); // strip "Bearer " (7 chars)

        try {
            // Validates signature + expiry; throws InvalidTokenException if bad.
            jwtUtil.validateToken(token);

            String username = jwtUtil.extractUsername(token);

            // Roles were packed into the token at login (exactly one of the
            // three). Turn them into Spring Security authorities
            // ("ROLE_ADMIN" -> hasRole("ADMIN")).
            List<String> roles = jwtUtil.extractRoles(token);
            if (roles == null) {
                roles = List.of();
            }
            var authorities = roles.stream()
                    .map(SimpleGrantedAuthority::new)
                    .toList();

            // principal = WHO (username), credentials = null (already proven,
            // we never keep raw passwords), authorities = WHAT they may do.
            var authentication = new UsernamePasswordAuthenticationToken(
                    username, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);

            filterChain.doFilter(request, response);
        } catch (Exception ex) {
            // Invalid/expired token: clear any partial authentication and
            // continue unauthenticated. For protected endpoints Spring then
            // answers 401; the one public endpoint (/auth/login) still passes
            // through untouched.
            SecurityContextHolder.clearContext();
            filterChain.doFilter(request, response);
        }
    }
}
