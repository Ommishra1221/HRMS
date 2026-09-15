package com.example.microservices.attendance.controller;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
 * POST   /attendance                -> createAttendance()  (verifies employee via HTTP!)
 * GET    /attendance                -> getAllAttendance()  (?employeeId= filters by employee)
 * GET    /attendance/{id}           -> getAttendanceById() (composes attendance + employee)
 * PUT    /attendance/{id}           -> updateAttendance()
 * PATCH  /attendance/{id}/checkout  -> markCheckOut()      (sets checkOut time)
 * DELETE /attendance/{id}           -> deleteAttendance()
 */
@RestController
@RequestMapping("/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    // POST http://localhost:8083/attendance
    @PostMapping
    public ResponseEntity<AttendanceResponse> createAttendance(@Valid @RequestBody AttendanceRequest request) {
        AttendanceResponse created = attendanceService.createAttendance(request);
        // 201 Created is the correct status for "a new resource was born"
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // GET http://localhost:8083/attendance   (also: /attendance?employeeId=1)
    @GetMapping
    public ResponseEntity<List<AttendanceResponse>> getAllAttendance(
            @RequestParam(required = false) Long employeeId) {
        if (employeeId != null) {
            return ResponseEntity.ok(attendanceService.getAttendanceByEmployee(employeeId));
        }
        return ResponseEntity.ok(attendanceService.getAllAttendance());
    }

    // GET http://localhost:8083/attendance/1
    @GetMapping("/{id}")
    public ResponseEntity<AttendanceResponse> getAttendanceById(@PathVariable Long id) {
        return ResponseEntity.ok(attendanceService.getAttendanceById(id));
    }

    // PUT http://localhost:8083/attendance/1
    @PutMapping("/{id}")
    public ResponseEntity<AttendanceResponse> updateAttendance(@PathVariable Long id,
            @Valid @RequestBody AttendanceRequest request) {
        return ResponseEntity.ok(attendanceService.updateAttendance(id, request));
    }

    // PATCH http://localhost:8083/attendance/1/checkout  body: {"checkOut": "18:30:00"}
    @PatchMapping("/{id}/checkout")
    public ResponseEntity<AttendanceResponse> markCheckOut(@PathVariable Long id,
            @RequestBody Map<String, LocalTime> body) {
        LocalTime checkOut = body.get("checkOut");
        return ResponseEntity.ok(attendanceService.markCheckOut(id, checkOut));
    }

    // DELETE http://localhost:8083/attendance/1
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAttendance(@PathVariable Long id) {
        attendanceService.deleteAttendance(id);
        // 204 No Content = "deleted successfully, nothing left to show you"
        return ResponseEntity.noContent().build();
    }
}
