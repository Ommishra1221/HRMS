package com.example.microservices.auth.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a JWT is malformed, expired, or has a bad signature
 * -> 401 Unauthorized. Used by JwtAuthenticationFilter when a token
 * fails validation on /auth/me.
 */
public class InvalidTokenException extends RuntimeException {

    private final HttpStatus status;

    public InvalidTokenException(String message) {
        super(message);
        this.status = HttpStatus.UNAUTHORIZED;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
