package com.example.microservices.payroll.exception;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import feign.FeignException;

/**
 * GlobalExceptionHandler = the safety net for payroll-service.
 *
 * It maps exceptions to clean JSON + correct HTTP status codes:
 * - payroll not found         -> 404
 * - validation errors         -> 400
 * - employee-service down     -> 503
 * - employee-service said 404 -> 404 (with a clear message)
 * - anything unexpected       -> 500
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(PayrollNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(PayrollNotFoundException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    // 403 - authenticated, but not allowed (ownership rule). Raised by the
    // service layer (e.g. an EMPLOYEE reading another employee's payslip).
    // Role refusals made by Spring Security BEFORE a controller runs are
    // answered by SecurityConfig's accessDeniedHandler instead - filters
    // never reach @RestControllerAdvice.
    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(ForbiddenOperationException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    @ExceptionHandler(EmployeeServiceException.class)
    public ResponseEntity<Map<String, Object>> handleEmployeeService(EmployeeServiceException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    // 403-not-500 fix: method-security exceptions surface inside the
    // DispatcherServlet, so without this handler the catch-all below would
    // swallow AccessDeniedException and the client would see 500 instead of
    // 403. (Same handler auth-service carries.)
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
