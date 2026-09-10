package com.example.microservices.employee.dto;

/**
 * EmployeeResponse = the JSON we send back to the client.
 *
 * Notice: it has the same fields as the entity, but it is a SEPARATE class.
 * That way, if the database entity ever changes (extra internal columns etc.),
 * the API contract with clients (and with leave-service!) stays stable.
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
