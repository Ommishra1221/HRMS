package com.example.microservices.probation.exception;

import org.springframework.http.HttpStatus;

public class ProbationException extends RuntimeException {
    private final HttpStatus status;
    public ProbationException(HttpStatus status, String message) { super(message); this.status = status; }
    public HttpStatus getStatus() { return status; }
    public static ProbationException badRequest(String message) { return new ProbationException(HttpStatus.BAD_REQUEST, message); }
    public static ProbationException forbidden() { return new ProbationException(HttpStatus.FORBIDDEN, "You are not authorized to access this assessment or action"); }
    public static ProbationException conflict(String message) { return new ProbationException(HttpStatus.CONFLICT, message); }
}
