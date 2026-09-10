package com.example.microservices.leave.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when employee-service answers 404 for the employeeId on a leave.
 *
 * We translate the downstream 404 into our own 400/404-style error so the
 * client gets one clear message instead of a confusing chain.
 */
public class EmployeeServiceException extends RuntimeException {

    private final HttpStatus status;

    public EmployeeServiceException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
