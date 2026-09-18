package com.example.microservices.employee.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
 * POST   /employees        -> createEmployee()   ADMIN only
 * GET    /employees        -> getAllEmployees()  ADMIN / HR
 * GET    /employees/me     -> getMyProfile()     EMPLOYEE self-service
 * GET    /employees/{id}   -> getEmployeeById()  ADMIN / HR any, EMPLOYEE own only
 * PUT    /employees/{id}   -> updateEmployee()   ADMIN only
 * DELETE /employees/{id}   -> deleteEmployee()   ADMIN only
 *
 * WHO DECIDES WHAT - the two independent locks:
 * 1. SecurityConfig's URL rules (coarse gate: which role may hit which shape
 *    of URL at all) - e.g. only ADMIN can even reach PUT /employees/{id}.
 * 2. @PreAuthorize below (the same rule attached to the method, so a future
 *    route remap cannot silently widen access) - the same two-lock pattern
 *    UserController in auth-service uses.
 * Ownership ("EMPLOYEE may read only their own record") is finer-grained than
 * any URL can express, so it lives in EmployeeServiceImpl via CurrentUser.
 */
@RestController
@RequestMapping("/employees")
public class EmployeeController {

    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    // POST http://localhost:8081/employees - ADMIN only.
    // HR and EMPLOYEE tokens are stopped by the URL rule (403) and never
    // reach this method.
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<EmployeeResponse> createEmployee(@Valid @RequestBody EmployeeRequest request) {
        EmployeeResponse created = employeeService.createEmployee(request);
        // 201 Created is the correct status for "a new resource was born"
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // GET http://localhost:8081/employees - ADMIN / HR only (the directory).
    // An EMPLOYEE must not be able to list every employee master record.
    @PreAuthorize("hasAnyRole('ADMIN', 'HR')")
    @GetMapping
    public ResponseEntity<List<EmployeeResponse>> getAllEmployees() {
        return ResponseEntity.ok(employeeService.getAllEmployees());
    }

    // GET http://localhost:8081/employees/me - EMPLOYEE self-service.
    // "me" (not a number!) means the id is taken from the JWT, so an employee
    // cannot read anybody else's profile by changing a path variable. The
    // URL gate allows any authenticated caller; the service resolves it as
    // the caller's own record (an ADMIN/HR has no employee link -> 403).
    @GetMapping("/me")
    public ResponseEntity<EmployeeResponse> getMyProfile() {
        return ResponseEntity.ok(employeeService.getMyProfile());
    }

    // GET http://localhost:8081/employees/1
    // ADMIN/HR: any record. EMPLOYEE: the service layer rejects any id other
    // than the caller's own employeeId (403) - the id in the path is NEVER
    // trusted as proof of ownership; the JWT is.
    @PreAuthorize("hasAnyRole('ADMIN', 'HR', 'EMPLOYEE')")
    @GetMapping("/{id}")
    public ResponseEntity<EmployeeResponse> getEmployeeById(@PathVariable Long id) {
        return ResponseEntity.ok(employeeService.getEmployeeById(id));
    }

    // PUT http://localhost:8081/employees/1 - ADMIN only.
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<EmployeeResponse> updateEmployee(@PathVariable Long id,
            @Valid @RequestBody EmployeeRequest request) {
        return ResponseEntity.ok(employeeService.updateEmployee(id, request));
    }

    // DELETE http://localhost:8081/employees/1 - ADMIN only.
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEmployee(@PathVariable Long id) {
        employeeService.deleteEmployee(id);
        // 204 No Content = "deleted successfully, nothing left to show you"
        return ResponseEntity.noContent().build();
    }
}
