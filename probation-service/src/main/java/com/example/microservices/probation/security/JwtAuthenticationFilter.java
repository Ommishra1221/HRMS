package com.example.microservices.probation.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import jakarta.servlet.*;
import jakarta.servlet.http.*;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final SecretKey key;
    public JwtAuthenticationFilter(@Value("${app.jwt.secret}") String secret) {
        key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                var token = header.substring(7);
                var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
                var roles = claims.get("roles", List.class);
                var id = claims.get("userId", Number.class);
                var employee = claims.get("employeeId", Number.class);
                if (claims.getExpiration() == null || claims.getSubject() == null || claims.getSubject().isBlank()
                    || id == null || id.longValue() <= 0 || roles == null || roles.size() != 1
                    || !Set.of("ROLE_ADMIN", "ROLE_HR", "ROLE_EMPLOYEE").contains(roles.getFirst())
                    || (employee != null && employee.longValue() <= 0)) throw new IllegalArgumentException();
                var role = (String) roles.getFirst();
                var principal = new CurrentUser(id.longValue(), claims.getSubject(), employee == null ? null : employee.longValue(), role.substring(5));
                SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    principal, token, List.of(new SimpleGrantedAuthority(role))));
            } catch (RuntimeException ignored) { SecurityContextHolder.clearContext(); }
        }
        chain.doFilter(request, response);
    }
}
