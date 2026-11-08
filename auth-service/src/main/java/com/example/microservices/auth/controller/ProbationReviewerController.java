package com.example.microservices.auth.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.*;
import com.example.microservices.auth.service.ProbationReviewerService;
import com.example.microservices.auth.dto.ProbationReviewerResponse;

@RestController
@RequestMapping("/auth/probation-reviewers")
@PreAuthorize("hasAnyRole('ADMIN','HR')")
@Validated
public class ProbationReviewerController {
    private final ProbationReviewerService service;
    public ProbationReviewerController(ProbationReviewerService service) { this.service=service; }
    @GetMapping public ProbationReviewerService.ReviewerPage list(
        @RequestParam(defaultValue="0") @Min(0) int page,
        @RequestParam(defaultValue="50") @Min(1) @Max(100) int size,
        @RequestParam(defaultValue="") @Size(max=100) String search) { return service.list(page,size,search); }
    @GetMapping("/{id}") public ProbationReviewerResponse get(@PathVariable @Positive Long id) { return service.get(id); }

    @ExceptionHandler({jakarta.validation.ConstraintViolationException.class, org.springframework.web.method.annotation.HandlerMethodValidationException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public org.springframework.http.ResponseEntity<?> invalidRequest() {
        return org.springframework.http.ResponseEntity.badRequest().body(java.util.Map.of(
            "timestamp",java.time.OffsetDateTime.now().toString(),"status",400,"error","Bad Request",
            "message","Invalid reviewer identifier, search, or pagination"));
    }
}
