package com.example.microservices.auth.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a user id does not exist -> becomes a clean 404 response.
 * Same pattern as PayrollNotFoundException / AttendanceNotFoundException.
 */
public class UserNotFoundException extends RuntimeException {

    private final HttpStatus status;

    public UserNotFoundException(String message) {
        super(message);
        this.status = HttpStatus.NOT_FOUND;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
