package com.example.microservices.payroll.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a payroll id does not exist -> becomes a clean 404 response.
 */
public class PayrollNotFoundException extends RuntimeException {

    private final HttpStatus status;

    public PayrollNotFoundException(String message) {
        super(message);
        this.status = HttpStatus.NOT_FOUND;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
