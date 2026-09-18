package com.example.microservices.auth.dto;

import java.util.List;

/**
 * UserResponse = a User WITHOUT its password hash.
 *
 * Used by GET /auth/me (the caller's own profile) and by every ADMIN
 * user-management endpoint. This is the DTO-only-leaves-the-service pattern:
 * the User entity (which contains the BCrypt hash) never crosses the API
 * boundary.
 *
 * `enabled` is exposed so the admin UI can show disabled accounts, and
 * `employeeId` so the UI can say WHICH employee an account belongs to.
 */
public class UserResponse {

    private Long id;
    private String username;
    private String email;
    private String fullName;
    private List<String> roles; // exactly one of ROLE_ADMIN / ROLE_HR / ROLE_EMPLOYEE
    private Long employeeId;    // null when the account is not tied to an employee
    private boolean enabled;    // false = the account may not log in

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public List<String> getRoles() {
        return roles;
    }

    public void setRoles(List<String> roles) {
        this.roles = roles;
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
