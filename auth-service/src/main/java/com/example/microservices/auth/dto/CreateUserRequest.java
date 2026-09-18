package com.example.microservices.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * CreateUserRequest = the JSON an ADMIN sends to POST /auth/users.
 *
 * This replaces the old public RegisterRequest: there is NO public signup any
 * more, so account creation is an ADMIN action performed here.
 *
 * Validation annotations are the FIRST layer: bad input dies with a 400 before
 * any business logic runs. The REAL checks (duplicates, role whitelist,
 * hashing) happen in UserServiceImpl.
 */
public class CreateUserRequest {

    @NotBlank(message = "username is required")
    @Size(min = 3, max = 100, message = "username must be between 3 and 100 characters")
    @Pattern(regexp = "^[A-Za-z0-9._-]+$",
            message = "username may only contain letters, digits, dot, underscore or hyphen")
    private String username;

    @NotBlank(message = "email is required")
    @Email(message = "email must be a valid email address")
    private String email;

    // Never log this field. It is hashed with BCrypt before it is stored.
    @NotBlank(message = "password is required")
    @Size(min = 6, max = 100, message = "password must be between 6 and 100 characters")
    private String password;

    @Size(max = 150, message = "fullName must be at most 150 characters")
    private String fullName;

    // REQUIRED here (unlike the old register flow, which defaulted to
    // EMPLOYEE): an admin creating an account must state which of the three
    // roles it gets. Accepted values: ADMIN | HR | EMPLOYEE (ROLE_ prefix
    // optional) - anything else is a 400.
    @NotBlank(message = "role is required (ADMIN, HR or EMPLOYEE)")
    private String role;

    // Optional link to an employee record in employee-service. Null is valid
    // (an admin or HR account may not represent an employee).
    private Long employeeId;

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

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }
}
