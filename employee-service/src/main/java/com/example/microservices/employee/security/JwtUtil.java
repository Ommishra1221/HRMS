package com.example.microservices.employee.security;

import java.util.List;
import java.util.function.Function;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * JwtUtil = the only class in this service that touches tokens.
 *
 * IMPORTANT DIFFERENCE FROM auth-service: employee-service does NOT issue
 * tokens. Login lives in auth-service (:8085) and ONLY there. This service
 * merely VERIFIES the tokens auth-service signed, which works because both
 * services share the same app.jwt.secret - a token signed with anything else
 * fails signature validation and the request stays anonymous (-> 401).
 *
 * THE CLAIM SET BEING READ (issued by auth-service, one contract for the
 * whole project):
 *   sub        - the username (the identity the token proves)
 *   userId     - users.id in auth_db (not needed here)
 *   roles      - ["ROLE_ADMIN"] | ["ROLE_HR"] | ["ROLE_EMPLOYEE"] - exactly one
 *   employeeId - the employee this account belongs to, ABSENT for admin/HR
 *   iat / exp  - issued at / expires at (auth-service sets exp to 24 h)
 *
 * WHY NO InvalidTokenException HERE (auth-service has one)? Nothing in this
 * service surfaces a token problem as a response body: an invalid token simply
 * means the JwtAuthenticationFilter declines to authenticate and Spring
 * Security answers 401. So JwtException is allowed to propagate to the
 * filter's catch block instead of being wrapped in a custom exception.
 *
 * The payload is only BASE64URL-ENCODED, not encrypted - anyone can READ it.
 * auth-service never puts a password in a token, and neither do we read one.
 */
@Component
public class JwtUtil {

    private final SecretKey key;

    public JwtUtil(@Value("${app.jwt.secret}") String secret) {
        // Build the HMAC verification key once from the configured secret.
        // Must be the SAME string as auth-service's app.jwt.secret.
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    /** Is this token genuine and unexpired? Throws JwtException if not. */
    public void validateToken(String token) {
        // parseSignedClaims verifies the SIGNATURE and the EXP date in one go.
        parse(token);
    }

    /** The username back out of the token (the "sub" claim). */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /** The roles back out of the token (the custom "roles" claim). */
    @SuppressWarnings("unchecked")
    public List<String> extractRoles(String token) {
        return (List<String>) parse(token).get("roles");
    }

    /** The employee link claim, or null when this account is not an employee. */
    public Long extractEmployeeId(String token) {
        Object value = parse(token).get("employeeId");
        return value == null ? null : ((Number) value).longValue();
    }

    /** Generic claim reader - parse, then apply any getter you need. */
    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        return resolver.apply(parse(token));
    }

    private Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key) // same secret that signed it in auth-service
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
