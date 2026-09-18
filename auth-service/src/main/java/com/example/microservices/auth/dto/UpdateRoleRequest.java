package com.example.microservices.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * UpdateRoleRequest = the JSON an ADMIN sends to PATCH /auth/users/{id}/role.
 *
 * One field only, on purpose: a role change is a security event, so it gets its
 * own tiny endpoint with its own audit-friendly shape instead of being buried
 * in a general update. The value is whitelisted by RoleName.from() in the
 * service layer - "ADMIN" / "HR" / "EMPLOYEE" (ROLE_ prefix optional).
 */
public class UpdateRoleRequest {

    @NotBlank(message = "role is required (ADMIN, HR or EMPLOYEE)")
    private String role;

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}
