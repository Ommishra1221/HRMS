package com.example.microservices.leave.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a leave id does not exist -> becomes a clean 404 response.
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
