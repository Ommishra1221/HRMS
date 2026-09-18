package com.example.microservices.auth.exception;

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
 * GlobalExceptionHandler = the safety net for auth-service.
 *
 * Same error shape as every service in this project:
 *   { timestamp, status, error, message }
 *
 * The frontend's axios interceptor reads exactly the "message" field - so
 * "Invalid username or password" or "Access denied" shows up in the UI as-is.
 *
 * STATUS CODES THIS SERVICE PROMISES (and the whole auth contract):
 *   400 - the request itself was malformed (validation, bad role name)
 *   401 - missing/incorrect credentials (login) or a dead/missing token
 *   403 - authenticated, but not allowed (not an ADMIN, self-demotion)
 *   404 - user id not found
 *   409 - duplicate username or email
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidCredentials(InvalidCredentialsException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidToken(InvalidTokenException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    @ExceptionHandler(DuplicateUserException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicateUser(DuplicateUserException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleUserNotFound(UserNotFoundException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    @ExceptionHandler(InvalidRoleException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidRole(InvalidRoleException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    @ExceptionHandler(OperationNotAllowedException.class)
    public ResponseEntity<Map<String, Object>> handleOperationNotAllowed(OperationNotAllowedException ex) {
        return build(ex.getStatus(), ex.getMessage());
    }

    /**
     * A 403 raised by Spring Security itself, i.e. @PreAuthorize("hasRole('ADMIN')")
     * firing because the caller is an HR or EMPLOYEE account.
     *
     * THIS HANDLER IS NOT OPTIONAL. Method-security exceptions surface inside
     * DispatcherServlet, so without it the catch-all below would swallow
     * AccessDeniedException and the client would see 500 instead of 403.
     * The message is deliberately generic - we say WHAT is required, never
     * which account the caller holds.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, "Access denied: this operation requires the ADMIN role");
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
