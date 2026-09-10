package com.example.microservices.leave.dto;

/**
 * A lightweight copy of EmployeeResponse.
 *
 * WHY duplicate this small class instead of importing it?
 * Because microservices are INDEPENDENT projects. leave-service must not
 * depend on employee-service's JAR or its database - only on its REST API
 * and the JSON shape. A small duplicate DTO keeps the services decoupled.
 */
public class EmployeeResponse {

    private Long id;
    private String name;
    private String email;
    private String department;

    public EmployeeResponse() {
    }

    public EmployeeResponse(Long id, String name, String email, String department) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.department = department;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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
