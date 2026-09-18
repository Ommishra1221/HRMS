package com.example.microservices.auth.security;

import java.util.Date;
import java.util.List;
import java.util.function.Function;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.example.microservices.auth.exception.InvalidTokenException;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * JwtUtil = the only class in the whole project that touches tokens.
 *
 * TWO jobs, one file:
 * 1. generateToken()  - after a successful login, pack the user's identity
 *                       (username + id + role + employeeId) into a signed token.
 * 2. validate/extract - later, prove a token is genuine and read it back.
 *
 * HOW THE SIGNATURE WORKS (no magic): we sign with a SECRET key known only to
 * servers. The token is three Base64URL parts - header.payload.signature.
 * Change ONE letter of the payload and the signature no longer matches ->
 * validation throws -> we reject it. Nobody can forge a token without the
 * secret. The payload is only BASE64URL-ENCODED, not encrypted, so anyone can
 * READ it - that is why no password or secret may ever be placed in a claim.
 *
 * THE CLAIM SET THIS SERVICE ISSUES (the contract the whole project relies on):
 *   sub        - the username (the identity the token proves)
 *   userId     - users.id in auth_db (stable even if the username is renamed)
 *   roles      - ["ROLE_ADMIN"] | ["ROLE_HR"] | ["ROLE_EMPLOYEE"] - exactly one
 *   employeeId - the employee this account belongs to, or ABSENT for admin/HR
 *   iat        - issued at
 *   exp        - expires at (24 h by default)
 */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expirationMs;

    public JwtUtil(@Value("${app.jwt.secret}") String secret,
                   @Value("${app.jwt.expiration-ms}") long expirationMs) {
        // Build the HMAC signing key once from the configured secret string.
        // jjwt picks the strongest HMAC the length allows: >=32 bytes -> HS256,
        // >=48 -> HS384, >=64 -> HS512 (our demo secret is 75 chars -> HS512).
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMs = expirationMs;
    }

    /**
     * Called by AuthServiceImpl after login succeeds.
     *
     * @param subject    the username - the token's "sub" claim
     * @param userId     auth_db users.id, so /auth/me needs no extra lookup key
     * @param employeeId the linked employee, or null for admin/HR accounts.
     *                   Null means the claim is simply NOT ADDED - we never
     *                   write "employeeId": null into the token, so a client
     *                   can tell "not an employee" from "employee 0".
     * @param roles      exactly one of ROLE_ADMIN / ROLE_HR / ROLE_EMPLOYEE
     */
    public String generateToken(String subject, Long userId, Long employeeId, List<String> roles) {
        Date now = new Date();
        var builder = Jwts.builder()
                .subject(subject)
                .claim("userId", userId)
                .claim("roles", roles);
        if (employeeId != null) {
            builder.claim("employeeId", employeeId);
        }
        return builder
                .issuedAt(now)
                // exp = "expired at". After this instant the token is dead.
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact(); // the actual "eyJhbGciOi..." String
    }

    /** Is this token genuine and unexpired? Throws InvalidTokenException if not. */
    public void validateToken(String token) {
        try {
            // parseSignedClaims verifies the SIGNATURE and the EXP date in one go.
            parse(token);
        } catch (JwtException | IllegalArgumentException ex) {
            throw new InvalidTokenException("Invalid or expired token");
        }
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

    /** The auth_db user id claim (null if absent - e.g. a hand-built token). */
    public Long extractUserId(String token) {
        Object value = parse(token).get("userId");
        return value == null ? null : ((Number) value).longValue();
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
                .verifyWith(key) // same secret that signed it
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
