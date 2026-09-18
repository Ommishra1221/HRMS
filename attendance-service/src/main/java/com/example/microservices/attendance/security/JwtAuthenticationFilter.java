package com.example.microservices.attendance.security;

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
 * Same handshake as auth-service's filter, with ONE addition that matters for
 * authorization: the employeeId claim is carried into the principal
 * (CurrentUser.AuthUser) so the service layer can enforce OWNERSHIP - an
 * EMPLOYEE may only read attendance rows whose employee_id is their own -
 * without trusting any id the browser sent.
 *
 * 1. Client sends:  Authorization: Bearer eyJhbGciOi...
 * 2. We strip the "Bearer " prefix and validate signature + expiry via JwtUtil.
 * 3. Roles from the token become Spring Security authorities
 *    ("ROLE_ADMIN" -> hasRole("ADMIN") in @PreAuthorize / SecurityConfig).
 * 4. We park an Authentication (principal = AuthUser) in SecurityContextHolder.
 *
 * No header / bad token = empty context = the request is "anonymous" ->
 * the rules reject it with 401. We deliberately do NOT stop the chain
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

        // No Bearer header? Leave the context empty and move on - the rules decide next.
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7); // strip "Bearer " (7 chars)

        try {
            // Validates signature + expiry; throws JwtException if bad.
            jwtUtil.validateToken(token);

            String username = jwtUtil.extractUsername(token);
            List<String> roles = jwtUtil.extractRoles(token);
            if (roles == null) {
                roles = List.of();
            }

            // Defense in depth: a token with NO role can never exist in this
            // system (auth-service issues exactly one of the three). Treating
            // it as anonymous means a hand-built token with an empty roles
            // claim cannot sneak through an endpoint that only requires
            // "authenticated" without any specific role.
            if (roles.isEmpty()) {
                filterChain.doFilter(request, response);
                return;
            }

            var authorities = roles.stream()
                    .map(SimpleGrantedAuthority::new)
                    .toList();

            // principal = WHO (username + employee link). credentials carries
            // the validated JWT itself - FeignTokenRelay needs it to attach
            // the SAME token to the internal employee-service calls that
            // compose responses (employee-service is protected too).
            var principal = new CurrentUser.AuthUser(username, jwtUtil.extractEmployeeId(token));
            var authentication = new UsernamePasswordAuthenticationToken(principal, token, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);

            filterChain.doFilter(request, response);
        } catch (Exception ex) {
            // Invalid/expired token: clear any partial authentication and
            // continue unauthenticated. Protected endpoints then get 401 from
            // SecurityConfig's authenticationEntryPoint.
            SecurityContextHolder.clearContext();
            filterChain.doFilter(request, response);
        }
    }
}
