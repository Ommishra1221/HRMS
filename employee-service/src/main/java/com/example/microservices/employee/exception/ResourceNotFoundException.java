package com.example.microservices.employee.exception;

import org.springframework.http.HttpStatus;

/**
 * A simple exception we throw when something the client asked for does not exist.
 *
 * The GlobalExceptionHandler catches it and turns it into a clean
 * 404 response instead of an ugly stack trace.
 */
public class ResourceNotFoundException extends RuntimeException {

    private final HttpStatus status;

    public ResourceNotFoundException(String message) {
        super(message);
        this.status = HttpStatus.NOT_FOUND;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
