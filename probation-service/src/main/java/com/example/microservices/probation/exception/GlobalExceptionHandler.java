package com.example.microservices.probation.exception;

import java.time.OffsetDateTime;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import jakarta.validation.ConstraintViolationException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private ResponseEntity<Map<String,Object>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("timestamp", OffsetDateTime.now().toString(), "status", status.value(), "error", status.getReasonPhrase(), "message", message));
    }
    @ExceptionHandler(ProbationException.class) ResponseEntity<?> domain(ProbationException ex) { return error(ex.getStatus(), ex.getMessage()); }
    @ExceptionHandler(AccessDeniedException.class) ResponseEntity<?> denied() { return error(HttpStatus.FORBIDDEN, "You are not authorized to perform this action"); }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException ex) {
        var field = ex.getBindingResult().getFieldErrors().getFirst();
        return error(HttpStatus.BAD_REQUEST, field.getField() + ": " + field.getDefaultMessage());
    }
    @ExceptionHandler({ConstraintViolationException.class, HandlerMethodValidationException.class, HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<?> malformed() { return error(HttpStatus.BAD_REQUEST, "Invalid request: check identifiers, dates, status, scores and required fields"); }
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class) ResponseEntity<?> stale() { return error(HttpStatus.CONFLICT, "This assessment changed. Reload it before trying again"); }
    @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<?> constraint() { return error(HttpStatus.CONFLICT, "Assessment conflicts with an existing cycle or a data integrity rule"); }
    @ExceptionHandler(feign.FeignException.class) ResponseEntity<?> downstream() { return error(HttpStatus.SERVICE_UNAVAILABLE, "Reference validation is unavailable. Please try again later"); }
    @ExceptionHandler(Exception.class) ResponseEntity<?> unexpected(Exception ex) {
        org.slf4j.LoggerFactory.getLogger(getClass()).error("Probation request failed", ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to complete the probation request");
    }
}
