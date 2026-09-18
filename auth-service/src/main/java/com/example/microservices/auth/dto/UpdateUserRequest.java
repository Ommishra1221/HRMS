package com.example.microservices.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * UpdateUserRequest = the JSON an ADMIN sends to PUT /auth/users/{id}.
 *
 * Every field is OPTIONAL: only the ones present are applied (a null means
 * "leave it alone"), which is the same tolerant style the attendance and
 * payroll partial updates use. The role is deliberately NOT here - changing a
 * role goes through PATCH /auth/users/{id}/role so it can never happen by
 * accident while editing a display name.
 */
public class UpdateUserRequest {

    @Size(min = 3, max = 100, message = "username must be between 3 and 100 characters")
    @Pattern(regexp = "^[A-Za-z0-9._-]+$",
            message = "username may only contain letters, digits, dot, underscore or hyphen")
    private String username;

    @Email(message = "email must be a valid email address")
    private String email;

    @Size(max = 150, message = "fullName must be at most 150 characters")
    private String fullName;

    // Optional password reset performed BY AN ADMIN. When present it is
    // re-hashed with BCrypt; when absent the existing hash is untouched.
    @Size(min = 6, max = 100, message = "password must be between 6 and 100 characters")
    private String password;

    // Send an explicit null to UNLINK the account from an employee - so we
    // cannot tell "not provided" from "clear it" with the field alone...
    // hence the flag below.
    private Long employeeId;

    // true = apply the employeeId field (even if it is null); false/absent =
    // leave the existing link untouched.
    private boolean changeEmployeeId;

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

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public boolean isChangeEmployeeId() {
        return changeEmployeeId;
    }

    public void setChangeEmployeeId(boolean changeEmployeeId) {
        this.changeEmployeeId = changeEmployeeId;
    }
}
