package com.example.microservices.employee.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * EmployeeRequest = the JSON a client sends us.
 *
 * WHY a DTO instead of accepting the Entity directly?
 * - The client should not be able to set "id" (the database owns that).
 * - We validate the incoming fields here with annotations.
 * - If our table changes, the outside world does not have to.
 */
public class EmployeeRequest {

    @NotBlank(message = "name is required")
    private String name;

    @NotBlank(message = "email is required")
    @Email(message = "email must be a valid email address")
    private String email;

    @NotBlank(message = "department is required")
    private String department;

    public EmployeeRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }
}
