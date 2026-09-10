package com.example.microservices.employee.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.microservices.employee.dto.EmployeeRequest;
import com.example.microservices.employee.dto.EmployeeResponse;
import com.example.microservices.employee.service.EmployeeService;

import jakarta.validation.Valid;

/**
 * The controller is the FRONT DOOR of employee-service.
 *
 * It listens on HTTP, maps URLs to Java methods, converts JSON <-> objects,
 * and returns proper HTTP status codes. It contains NO business logic -
 * it immediately delegates to EmployeeService.
 *
 * POST   /employees        -> createEmployee()
 * GET    /employees        -> getAllEmployees()
 * GET    /employees/{id}   -> getEmployeeById()
 * PUT    /employees/{id}   -> updateEmployee()
 * DELETE /employees/{id}   -> deleteEmployee()
 */
@RestController
@RequestMapping("/employees")
public class EmployeeController {

    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    // POST http://localhost:8081/employees
    @PostMapping
    public ResponseEntity<EmployeeResponse> createEmployee(@Valid @RequestBody EmployeeRequest request) {
        EmployeeResponse created = employeeService.createEmployee(request);
        // 201 Created is the correct status for "a new resource was born"
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // GET http://localhost:8081/employees
    @GetMapping
    public ResponseEntity<List<EmployeeResponse>> getAllEmployees() {
        return ResponseEntity.ok(employeeService.getAllEmployees());
    }

    // GET http://localhost:8081/employees/1
    @GetMapping("/{id}")
    public ResponseEntity<EmployeeResponse> getEmployeeById(@PathVariable Long id) {
        return ResponseEntity.ok(employeeService.getEmployeeById(id));
    }

    // PUT http://localhost:8081/employees/1
    @PutMapping("/{id}")
    public ResponseEntity<EmployeeResponse> updateEmployee(@PathVariable Long id,
            @Valid @RequestBody EmployeeRequest request) {
        return ResponseEntity.ok(employeeService.updateEmployee(id, request));
    }

    // DELETE http://localhost:8081/employees/1
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEmployee(@PathVariable Long id) {
        employeeService.deleteEmployee(id);
        // 204 No Content = "deleted successfully, nothing left to show you"
        return ResponseEntity.noContent().build();
    }
}
