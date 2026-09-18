package com.example.microservices.leave.exception;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import feign.FeignException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * GlobalExceptionHandler = the safety net for leave-service.
 *
 * It maps exceptions to clean JSON + correct HTTP status codes:
 * - leave not found            -> 404
 * - validation errors          -> 400
 * - employee-service down      -> 503
 * - employee-service said 404  -> 404 (with a clear message)
 * - anything unexpected        -> 500
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    // 403 - authenticated, but not allowed (ownership / PENDING rule).
    // Raised by the service layer (e.g. an EMPLOYEE touching another
    // employee's leave, or editing a non-PENDING one). Role refusals made by
    // Spring Security BEFORE a controller runs are answered by
    // SecurityConfig's accessDeniedHandler instead - filters never reach
    // @RestControllerAdvice.
    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(ForbiddenOperationException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    @ExceptionHandler(EmployeeServiceException.class)
    public ResponseEntity<Map<String, Object>> handleEmployeeService(EmployeeServiceException ex) {
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

    // Thrown by OpenFeign when employee-service cannot be reached at all
    // (connection refused / timeout). We answer 503 Service Unavailable.
    @ExceptionHandler(FeignException.class)
    public ResponseEntity<Map<String, Object>> handleFeign(FeignException ex) {
        return build(HttpStatus.SERVICE_UNAVAILABLE,
                "Employee service is currently unavailable. Please try again later.");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .findFirst()
                .orElse("Invalid request");
        return build(HttpStatus.BAD_REQUEST, message);
    }

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
