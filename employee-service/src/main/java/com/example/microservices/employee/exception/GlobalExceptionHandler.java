package com.example.microservices.employee.exception;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * GlobalExceptionHandler = the safety net for the whole service.
 *
 * Whenever ANY controller method throws an exception, Spring routes it here.
 * We translate it into a small, meaningful JSON body + correct HTTP status.
 *
 * WHY is this important in microservices?
 * Because other services (leave-service) will call our API. If we crash with
 * a 500 stack trace, they cannot react properly. A clean 404 with a message
 * tells the caller exactly what happened.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 404 - employee not found
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    // 403 - authenticated, but not allowed (ownership / role rule).
    // Raised by the service layer (e.g. an EMPLOYEE asking for another
    // employee's profile). Role refusals made by Spring Security BEFORE a
    // controller runs are answered by SecurityConfig's accessDeniedHandler
    // instead - filters never reach @RestControllerAdvice.
    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(ForbiddenOperationException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    // 403 raised by Spring Security itself, i.e. @PreAuthorize firing on a
    // method the URL rules let through. THIS HANDLER IS NOT OPTIONAL: method-
    // security exceptions surface inside the DispatcherServlet, so without it
    // the catch-all below would swallow AccessDeniedException and the client
    // would see 500 instead of 403. (Same handler auth-service carries.)
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN,
                "Access denied: you do not have permission to perform this operation");
    }

    // 403 raised by Spring Security itself, i.e. @PreAuthorize firing on a
    // method the URL rules let through. THIS HANDLER IS NOT OPTIONAL: method-
    // security exceptions surface inside the DispatcherServlet, so without it
    // the catch-all below would swallow AccessDeniedException and the client
    // would see 500 instead of 403. (Same handler auth-service carries.)
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN,
                "Access denied: you do not have permission to perform this operation");
    }

    // 400 - validation failed (e.g. missing name, bad email)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .findFirst()
                .orElse("Invalid request");
        return build(HttpStatus.BAD_REQUEST, message);
    }

    // 500 - anything unexpected
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected error: " + ex.getMessage());
    }

    private ResponseEntity<Map<String, Object>> build(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}
