package com.example.microservices.auth.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when login fails: unknown username OR wrong password.
 *
 * SECURITY NOTE: both cases return the SAME generic message ("Invalid
 * username or password") with 401. We never say WHICH half was wrong -
 * that would let attackers discover valid usernames.
 */
public class InvalidCredentialsException extends RuntimeException {

    private final HttpStatus status;

    public InvalidCredentialsException(String message) {
        super(message);
        this.status = HttpStatus.UNAUTHORIZED;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
