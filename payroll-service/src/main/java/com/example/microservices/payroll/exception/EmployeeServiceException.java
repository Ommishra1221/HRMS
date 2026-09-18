package com.example.microservices.payroll.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when employee-service answers 404 for the employeeId on a payroll
 * record, or when a business rule is violated (duplicate month, already
 * paid, negative numbers...). Carries the HTTP status to respond with.
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
