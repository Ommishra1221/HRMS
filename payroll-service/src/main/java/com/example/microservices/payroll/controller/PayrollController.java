package com.example.microservices.payroll.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.microservices.payroll.dto.PayrollRequest;
import com.example.microservices.payroll.dto.PayrollResponse;
import com.example.microservices.payroll.service.PayrollService;

import jakarta.validation.Valid;

/**
 * Front door of payroll-service, listening on port 8084.
 *
 * POST   /payroll               -> createPayroll()  ADMIN only (verifies employee via HTTP!)
 * GET    /payroll               -> getAllPayrolls() ADMIN/HR all, EMPLOYEE own (?employeeId= filters)
 * GET    /payroll/{id}          -> getPayrollById() ADMIN/HR any, EMPLOYEE own (composes payroll + employee)
 * PUT    /payroll/{id}          -> updatePayroll()  ADMIN only
 * PATCH  /payroll/{id}/paid     -> markPaid()       ADMIN only (sets status=PAID)
 * DELETE /payroll/{id}          -> deletePayroll()  ADMIN only
 *
 * WHO DECIDES WHAT - the two independent locks:
 * 1. SecurityConfig's URL rules (coarse gate: GET = all three roles, every
 *    write = ADMIN only; HR is read-only and can NEVER mark PAID; payroll
 *    has no self-service writes for EMPLOYEE).
 * 2. @PreAuthorize below (the same rule attached to the method, so a future
 *    route remap cannot silently widen access) - the same two-lock pattern
 *    UserController in auth-service uses.
 * The per-row rule (an EMPLOYEE reads only their own payslips) is
 * finer-grained than any URL can express and lives in PayrollServiceImpl
 * via CurrentUser.
 */
@RestController
@RequestMapping("/payroll")
public class PayrollController {

    private final PayrollService payrollService;

    public PayrollController(PayrollService payrollService) {
        this.payrollService = payrollService;
    }

    // POST http://localhost:8084/payroll - ADMIN only. Salaries are entered
    // by ADMIN alone; HR and EMPLOYEE never create payroll.
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<PayrollResponse> createPayroll(@Valid @RequestBody PayrollRequest request) {
        PayrollResponse created = payrollService.createPayroll(request);
        // 201 Created is the correct status for "a new resource was born"
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // GET http://localhost:8084/payroll   (also: /payroll?employeeId=1)
    // ADMIN/HR: every payslip. EMPLOYEE: silently scoped to their own rows -
    // an ?employeeId= that does not match the JWT's employeeId is overridden
    // (never trusted), so a query parameter cannot widen the view.
    @PreAuthorize("hasAnyRole('ADMIN', 'HR', 'EMPLOYEE')")
    @GetMapping
    public ResponseEntity<List<PayrollResponse>> getAllPayrolls(
            @RequestParam(required = false) Long employeeId) {
        if (employeeId != null) {
            return ResponseEntity.ok(payrollService.getPayrollsByEmployee(employeeId));
        }
        return ResponseEntity.ok(payrollService.getAllPayrolls());
    }

    // GET http://localhost:8084/payroll/1
    // ADMIN/HR: any payslip. EMPLOYEE: 403 when the row's employeeId is not
    // the caller's own (ownership verified against the JWT, not the path).
    @PreAuthorize("hasAnyRole('ADMIN', 'HR', 'EMPLOYEE')")
    @GetMapping("/{id}")
    public ResponseEntity<PayrollResponse> getPayrollById(@PathVariable Long id) {
        return ResponseEntity.ok(payrollService.getPayrollById(id));
    }

    // PUT http://localhost:8084/payroll/1 - ADMIN only (PAID stays immutable
    // via the existing business rule in the service).
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<PayrollResponse> updatePayroll(@PathVariable Long id,
            @Valid @RequestBody PayrollRequest request) {
        return ResponseEntity.ok(payrollService.updatePayroll(id, request));
    }

    // PATCH http://localhost:8084/payroll/1/paid  body: {"paymentDate": "2026-09-30"} (optional)
    // ADMIN ONLY - the terminal money action. HR and EMPLOYEE tokens are
    // refused here by the role gate before any business rule runs.
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/paid")
    public ResponseEntity<PayrollResponse> markPaid(@PathVariable Long id,
            @RequestBody(required = false) Map<String, LocalDate> body) {
        LocalDate paymentDate = (body != null) ? body.get("paymentDate") : null;
        return ResponseEntity.ok(payrollService.markPaid(id, paymentDate));
    }

    // DELETE http://localhost:8084/payroll/1 - ADMIN only.
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePayroll(@PathVariable Long id) {
        payrollService.deletePayroll(id);
        // 204 No Content = "deleted successfully, nothing left to show you"
        return ResponseEntity.noContent().build();
    }
}
