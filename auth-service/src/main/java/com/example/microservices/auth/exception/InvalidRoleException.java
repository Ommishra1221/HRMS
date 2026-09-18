package com.example.microservices.auth.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a client sends a role that is not one of ADMIN / HR / EMPLOYEE
 * -> becomes a clean 400 Bad Request.
 *
 * 400 (not 409/403) is correct here: the REQUEST itself was malformed, so the
 * caller must fix the payload. Nothing was written to the database.
 */
public class InvalidRoleException extends RuntimeException {

    private final HttpStatus status;

    public InvalidRoleException(String message) {
        super(message);
        this.status = HttpStatus.BAD_REQUEST;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
