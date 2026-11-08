package com.example.microservices.auth.dto;

/** Minimal assignment directory: no email, enabled flag, roles or credentials. */
public record ProbationReviewerResponse(Long id, String username, String fullName, Long employeeId) {}
