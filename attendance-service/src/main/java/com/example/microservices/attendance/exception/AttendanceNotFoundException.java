package com.example.microservices.attendance.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when an attendance id does not exist -> becomes a clean 404 response.
 */
public class AttendanceNotFoundException extends RuntimeException {

    private final HttpStatus status;

    public AttendanceNotFoundException(String message) {
        super(message);
        this.status = HttpStatus.NOT_FOUND;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
