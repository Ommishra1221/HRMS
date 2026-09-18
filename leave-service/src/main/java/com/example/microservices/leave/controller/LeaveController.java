package com.example.microservices.leave.controller;

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

import com.example.microservices.leave.dto.LeaveRequest;
import com.example.microservices.leave.dto.LeaveResponse;
import com.example.microservices.leave.service.LeaveService;

import jakarta.validation.Valid;

/**
 * Front door of leave-service, listening on port 8082.
 *
 * POST   /leaves        -> createLeave()   ADMIN any, EMPLOYEE own - (verifies employee via HTTP!)
 * GET    /leaves        -> getAllLeaves()   ADMIN all, HR all, EMPLOYEE own
 * GET    /leaves/{id}   -> getLeaveById()   ADMIN/HR any, EMPLOYEE own (composes leave + employee)
 * PUT    /leaves/{id}   -> updateLeave()    ADMIN any, EMPLOYEE own + PENDING
 * DELETE /leaves/{id}   -> deleteLeave()    ADMIN any, EMPLOYEE own + PENDING
 *
 * WHO DECIDES WHAT - the two independent locks:
 * 1. SecurityConfig's URL rules (coarse gate: GET = all three roles, writes
 *    = ADMIN + EMPLOYEE; HR is read-only here).
 * 2. @PreAuthorize below (the same rule attached to the method, so a future
 *    route remap cannot silently widen access) - the same two-lock pattern
 *    UserController in auth-service uses.
 * The per-row rules (ownership + the PENDING lifecycle) are finer-grained
 * than any URL can express and live in LeaveServiceImpl via CurrentUser.
 */
@RestController
@RequestMapping("/leaves")
public class LeaveController {

    private final LeaveService leaveService;

    public LeaveController(LeaveService leaveService) {
        this.leaveService = leaveService;
    }

    // POST http://localhost:8082/leaves - 201 Created on success.
    // EMPLOYEE: the service layer OVERWRITES request.employeeId with the
    // caller's own (from the JWT) and 403s if the body tried to claim
    // somebody else's identity.
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PostMapping
    public ResponseEntity<LeaveResponse> createLeave(@Valid @RequestBody LeaveRequest request) {
        LeaveResponse created = leaveService.createLeave(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // GET http://localhost:8082/leaves
    // ADMIN: every leave. HR: every leave (read-only oversight). EMPLOYEE:
    // silently scoped to their own rows - the caller's employeeId comes from
    // the JWT, so a query parameter cannot widen it.
    @PreAuthorize("hasAnyRole('ADMIN', 'HR', 'EMPLOYEE')")
    @GetMapping
    public ResponseEntity<List<LeaveResponse>> getAllLeaves() {
        return ResponseEntity.ok(leaveService.getAllLeaves());
    }

    // GET http://localhost:8082/leaves/1
    // ADMIN/HR: any record. EMPLOYEE: 403 when the row's employeeId is not
    // the caller's own (ownership verified against the JWT, not the path).
    @PreAuthorize("hasAnyRole('ADMIN', 'HR', 'EMPLOYEE')")
    @GetMapping("/{id}")
    public ResponseEntity<LeaveResponse> getLeaveById(@PathVariable Long id) {
        return ResponseEntity.ok(leaveService.getLeaveById(id));
    }

    // PUT http://localhost:8082/leaves/1
    // ADMIN: any leave. EMPLOYEE: only their OWN and only while PENDING -
    // both checked in the service against the JWT identity.
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PutMapping("/{id}")
    public ResponseEntity<LeaveResponse> updateLeave(@PathVariable Long id,
            @Valid @RequestBody LeaveRequest request) {
        return ResponseEntity.ok(leaveService.updateLeave(id, request));
    }

    // DELETE http://localhost:8082/leaves/1 - 204 No Content.
    // ADMIN: any leave. EMPLOYEE: only their OWN and only while PENDING.
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLeave(@PathVariable Long id) {
        leaveService.deleteLeave(id);
        return ResponseEntity.noContent().build();
    }
}
