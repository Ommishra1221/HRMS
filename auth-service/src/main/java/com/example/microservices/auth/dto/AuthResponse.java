package com.example.microservices.auth.dto;

import java.util.List;

/**
 * AuthResponse = the JSON a client receives after a successful login.
 *
 * Contains everything the frontend needs to remember WHO is logged in:
 * - token:      the JWT. The frontend stores it and sends it as
 *               "Authorization: Bearer <token>" on every later request.
 * - the user:   id/username/email/fullName/roles for display and menus.
 * - employeeId: which employee record this account maps to (null for pure
 *               admin/HR logins). The frontend needs it for employee
 *               self-service and the backend uses the same value from the
 *               token to scope "my own" reads.
 *
 * The password hash NEVER appears here, and neither does the plain password.
 */
public class AuthResponse {

    private String token;
    private String tokenType; // always "Bearer" - the HTTP standard word
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private List<String> roles; // e.g. ["ROLE_ADMIN"] - exactly one of the three
    private Long employeeId;    // null when the account is not an employee

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getTokenType() {
        return tokenType;
    }

    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }

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
}
