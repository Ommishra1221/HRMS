package com.example.microservices.attendance.controller;

import java.time.LocalTime;
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

import com.example.microservices.attendance.dto.AttendanceRequest;
import com.example.microservices.attendance.dto.AttendanceResponse;
import com.example.microservices.attendance.service.AttendanceService;

import jakarta.validation.Valid;

/**
 * Front door of attendance-service, listening on port 8083.
 *
 * POST   /attendance                -> createAttendance()  ADMIN only (verifies employee via HTTP!)
 * GET    /attendance                -> getAllAttendance()  ADMIN/HR all, EMPLOYEE own (?employeeId= filters)
 * GET    /attendance/{id}           -> getAttendanceById() ADMIN/HR any, EMPLOYEE own (composes attendance + employee)
 * PUT    /attendance/{id}           -> updateAttendance()  ADMIN only
 * PATCH  /attendance/{id}/checkout  -> markCheckOut()      ADMIN only (sets checkOut time)
 * DELETE /attendance/{id}           -> deleteAttendance()  ADMIN only
 *
 * WHO DECIDES WHAT - the two independent locks:
 * 1. SecurityConfig's URL rules (coarse gate: GET = all three roles, every
 *    write = ADMIN only; HR is read-only; attendance has no self-service
 *    writes, and none are invented).
 * 2. @PreAuthorize below (the same rule attached to the method, so a future
 *    route remap cannot silently widen access) - the same two-lock pattern
 *    UserController in auth-service uses.
 * The per-row rule (an EMPLOYEE reads only their own rows) is finer-grained
 * than any URL can express and lives in AttendanceServiceImpl via CurrentUser.
 */
@RestController
@RequestMapping("/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    // POST http://localhost:8083/attendance - ADMIN only. Attendance is
    // recorded by the company, never self-service by the employee.
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<AttendanceResponse> createAttendance(@Valid @RequestBody AttendanceRequest request) {
        AttendanceResponse created = attendanceService.createAttendance(request);
        // 201 Created is the correct status for "a new resource was born"
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // GET http://localhost:8083/attendance   (also: /attendance?employeeId=1)
    // ADMIN/HR: every record. EMPLOYEE: silently scoped to their own rows -
    // an ?employeeId= that does not match the JWT's employeeId is overridden
    // (never trusted), so a query parameter cannot widen the view.
    @PreAuthorize("hasAnyRole('ADMIN', 'HR', 'EMPLOYEE')")
    @GetMapping
    public ResponseEntity<List<AttendanceResponse>> getAllAttendance(
            @RequestParam(required = false) Long employeeId) {
        if (employeeId != null) {
            return ResponseEntity.ok(attendanceService.getAttendanceByEmployee(employeeId));
        }
        return ResponseEntity.ok(attendanceService.getAllAttendance());
    }

    // GET http://localhost:8083/attendance/1
    // ADMIN/HR: any record. EMPLOYEE: 403 when the row's employeeId is not
    // the caller's own (ownership verified against the JWT, not the path).
    @PreAuthorize("hasAnyRole('ADMIN', 'HR', 'EMPLOYEE')")
    @GetMapping("/{id}")
    public ResponseEntity<AttendanceResponse> getAttendanceById(@PathVariable Long id) {
        return ResponseEntity.ok(attendanceService.getAttendanceById(id));
    }

    // PUT http://localhost:8083/attendance/1 - ADMIN only.
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<AttendanceResponse> updateAttendance(@PathVariable Long id,
            @Valid @RequestBody AttendanceRequest request) {
        return ResponseEntity.ok(attendanceService.updateAttendance(id, request));
    }

    // PATCH http://localhost:8083/attendance/1/checkout  body: {"checkOut": "18:30:00"} - ADMIN only.
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/checkout")
    public ResponseEntity<AttendanceResponse> markCheckOut(@PathVariable Long id,
            @RequestBody Map<String, LocalTime> body) {
        LocalTime checkOut = body.get("checkOut");
        return ResponseEntity.ok(attendanceService.markCheckOut(id, checkOut));
    }

    // DELETE http://localhost:8083/attendance/1 - ADMIN only.
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAttendance(@PathVariable Long id) {
        attendanceService.deleteAttendance(id);
        // 204 No Content = "deleted successfully, nothing left to show you"
        return ResponseEntity.noContent().build();
    }
}
