package com.example.microservices.attendance.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when employee-service answers 404 for the employeeId on an
 * attendance record.
 *
 * We translate the downstream 404 into our own 404-style error so the client
 * gets one clear message instead of a confusing chain.
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
