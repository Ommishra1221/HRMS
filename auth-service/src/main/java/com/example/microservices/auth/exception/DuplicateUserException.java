package com.example.microservices.auth.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when registering with a username or email that already exists
 * -> becomes a clean 409 Conflict. Same idea as payroll's
 * "one payslip per employee per month" conflict.
 */
public class DuplicateUserException extends RuntimeException {

    private final HttpStatus status;

    public DuplicateUserException(String message) {
        super(message);
        this.status = HttpStatus.CONFLICT;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
