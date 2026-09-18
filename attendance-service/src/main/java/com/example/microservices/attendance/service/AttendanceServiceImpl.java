package com.example.microservices.attendance.service;

import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.microservices.attendance.client.EmployeeClient;
import com.example.microservices.attendance.dto.AttendanceRequest;
import com.example.microservices.attendance.dto.AttendanceResponse;
import com.example.microservices.attendance.dto.EmployeeResponse;
import com.example.microservices.attendance.entity.Attendance;
import com.example.microservices.attendance.exception.AttendanceNotFoundException;
import com.example.microservices.attendance.exception.EmployeeServiceException;
import com.example.microservices.attendance.exception.ForbiddenOperationException;
import com.example.microservices.attendance.repository.AttendanceRepository;
import com.example.microservices.attendance.security.CurrentUser;

import feign.FeignException;

/**
 * THE HEART OF attendance-service.
 *
 * This class does TWO kinds of work:
 * 1. Owns attendance data -> reads/writes attendance_db via AttendanceRepository.
 * 2. Borrows employee data -> calls employee-service over HTTP via EmployeeClient.
 *
 * This is DATA COMPOSITION ("API composition"): the final JSON is stitched
 * together from two services at request time. Nothing about employees is
 * stored in attendance_db - only the employeeId number.
 *
 * THE AUTHORIZATION LAYER (added, existing attendance logic untouched):
 * Role gates ("only ADMIN writes", "HR is read-only") already ran in
 * SecurityConfig/@PreAuthorize before this code executes. What is LEFT here
 * is the per-row rule, because it depends on the data itself: an EMPLOYEE's
 * rows are the ones whose employee_id equals the employeeId claim in their
 * JWT (CurrentUser) - the employeeId in a query string is NEVER trusted.
 */
@Service
public class AttendanceServiceImpl implements AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final EmployeeClient employeeClient;

    public AttendanceServiceImpl(AttendanceRepository attendanceRepository, EmployeeClient employeeClient) {
        this.attendanceRepository = attendanceRepository;
        this.employeeClient = employeeClient;
    }

    @Override
    @Transactional
    public AttendanceResponse createAttendance(AttendanceRequest request) {
        // STEP 1: is this a real employee? Ask employee-service over HTTP.
        EmployeeResponse employee = fetchEmployeeOrThrow(request.getEmployeeId());

        // STEP 2: business rules before touching the database.
        if (attendanceRepository.findByEmployeeIdAndAttendanceDate(
                request.getEmployeeId(), request.getAttendanceDate()).isPresent()) {
            throw new EmployeeServiceException(
                    "Attendance already exists for employee " + request.getEmployeeId()
                            + " on " + request.getAttendanceDate()
                            + " (one record per employee per day)",
                    HttpStatus.CONFLICT);
        }
        if ("PRESENT".equalsIgnoreCase(request.getStatus()) && request.getCheckIn() == null) {
            throw new EmployeeServiceException(
                    "checkIn is required when status is PRESENT",
                    HttpStatus.BAD_REQUEST);
        }

        // STEP 3: save the attendance record in OUR OWN database (attendance_db).
        Attendance attendance = new Attendance();
        applyRequest(attendance, request);
        Attendance saved = attendanceRepository.save(attendance);

        // STEP 4: compose the response: attendance data + employee data (HTTP).
        AttendanceResponse response = toResponse(saved);
        response.setEmployee(employee);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceResponse> getAllAttendance() {
        // OWNERSHIP: an EMPLOYEE's "list everything" is silently scoped to
        // their own rows - the filter value is the JWT's employeeId claim,
        // not anything the client sent (no ?employeeId= can widen it).
        CurrentUser caller = CurrentUser.get();
        List<Attendance> records = caller.isEmployee()
                ? attendanceRepository.findByEmployeeIdOrderByAttendanceDateDesc(caller.employeeId())
                : attendanceRepository.findAll();

        // LEARNING NOTE: one HTTP call PER record (the classic "N+1" problem).
        // Fine for learning; later you'd batch/cache or share IDs only.
        return records.stream()
                .map(this::toResponseWithEmployee)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public AttendanceResponse getAttendanceById(Long id) {
        Attendance attendance = attendanceRepository.findById(id)
                .orElseThrow(() -> new AttendanceNotFoundException("Attendance not found with id: " + id));

        // OWNERSHIP: an EMPLOYEE may only read their own attendance. The row's
        // employee_id is compared with the JWT's employeeId claim - the id in
        // the path is a REQUEST, never PROOF. (ADMIN and HR pass freely.)
        CurrentUser caller = CurrentUser.get();
        if (caller.isEmployee() && !attendance.getEmployeeId().equals(caller.employeeId())) {
            throw new ForbiddenOperationException("You can only view your own attendance");
        }

        // ---- THE MICROSERVICE COMMUNICATION HAPPENS ON THIS LINE ----
        // employeeClient is a generated HTTP proxy. This one Java method call
        // becomes:  GET http://localhost:8081/employees/{employeeId}
        return toResponseWithEmployee(attendance);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceResponse> getAttendanceByEmployee(Long employeeId) {
        // OWNERSHIP: whatever the query string asked for, an EMPLOYEE's filter
        // is FORCED to their own employeeId from the JWT. Asking for somebody
        // else's id is not an error - it simply returns your own rows, the
        // same way the unfiltered list does. (ADMIN and HR keep the real
        // filter.)
        CurrentUser caller = CurrentUser.get();
        if (caller.isEmployee()) {
            employeeId = caller.employeeId();
        }

        // Verify the employee exists before listing (same Feign check as create).
        fetchEmployeeOrThrow(employeeId);
        return attendanceRepository.findByEmployeeIdOrderByAttendanceDateDesc(employeeId).stream()
                .map(this::toResponseWithEmployee)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public AttendanceResponse updateAttendance(Long id, AttendanceRequest request) {
        Attendance attendance = attendanceRepository.findById(id)
                .orElseThrow(() -> new AttendanceNotFoundException("Attendance not found with id: " + id));

        // If the client changed employeeId/date, the duplicate rule must hold
        // for the NEW values - and the employee must exist.
        EmployeeResponse employee = fetchEmployeeOrThrow(request.getEmployeeId());
        attendanceRepository.findByEmployeeIdAndAttendanceDate(
                        request.getEmployeeId(), request.getAttendanceDate())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new EmployeeServiceException(
                            "Attendance already exists for employee " + request.getEmployeeId()
                                    + " on " + request.getAttendanceDate(),
                            HttpStatus.CONFLICT);
                });
        if ("PRESENT".equalsIgnoreCase(request.getStatus()) && request.getCheckIn() == null) {
            throw new EmployeeServiceException(
                    "checkIn is required when status is PRESENT",
                    HttpStatus.BAD_REQUEST);
        }

        applyRequest(attendance, request);
        Attendance updated = attendanceRepository.save(attendance);

        AttendanceResponse response = toResponse(updated);
        response.setEmployee(employee);
        return response;
    }

    @Override
    @Transactional
    public AttendanceResponse markCheckOut(Long id, LocalTime checkOut) {
        Attendance attendance = attendanceRepository.findById(id)
                .orElseThrow(() -> new AttendanceNotFoundException("Attendance not found with id: " + id));
        if (checkOut == null) {
            throw new EmployeeServiceException("checkOut time is required", HttpStatus.BAD_REQUEST);
        }
        if (attendance.getCheckIn() != null && checkOut.isBefore(attendance.getCheckIn())) {
            throw new EmployeeServiceException(
                    "checkOut (" + checkOut + ") cannot be before checkIn (" + attendance.getCheckIn() + ")",
                    HttpStatus.BAD_REQUEST);
        }
        attendance.setCheckOut(checkOut);
        Attendance updated = attendanceRepository.save(attendance);
        return toResponseWithEmployee(updated);
    }

    @Override
    @Transactional
    public void deleteAttendance(Long id) {
        if (!attendanceRepository.existsById(id)) {
            throw new AttendanceNotFoundException("Attendance not found with id: " + id);
        }
        attendanceRepository.deleteById(id);
    }

    /**
     * Translates communication failures into meaningful errors:
     * - employee-service said 404 -> employee does not exist -> 404 to our client
     * - employee-service unreachable (connection refused/timeout) -> let the
     *   raw FeignException bubble up; GlobalExceptionHandler turns it into 503.
     */
    private EmployeeResponse fetchEmployeeOrThrow(Long employeeId) {
        try {
            return employeeClient.getEmployeeById(employeeId);
        } catch (FeignException.NotFound ex) {
            throw new EmployeeServiceException(
                    "Employee not found with id: " + employeeId + " (checked in employee-service)",
                    HttpStatus.NOT_FOUND);
        }
    }

    private AttendanceResponse toResponseWithEmployee(Attendance attendance) {
        AttendanceResponse response = toResponse(attendance);
        response.setEmployee(employeeClient.getEmployeeById(attendance.getEmployeeId()));
        return response;
    }

    private void applyRequest(Attendance attendance, AttendanceRequest request) {
        attendance.setEmployeeId(request.getEmployeeId());
        attendance.setAttendanceDate(request.getAttendanceDate());
        attendance.setStatus(request.getStatus().trim().toUpperCase());
        attendance.setCheckIn(request.getCheckIn());
        attendance.setCheckOut(request.getCheckOut());
    }

    private AttendanceResponse toResponse(Attendance attendance) {
        AttendanceResponse response = new AttendanceResponse();
        response.setId(attendance.getId());
        response.setEmployeeId(attendance.getEmployeeId());
        response.setAttendanceDate(attendance.getAttendanceDate());
        response.setStatus(attendance.getStatus());
        response.setCheckIn(attendance.getCheckIn());
        response.setCheckOut(attendance.getCheckOut());
        return response;
    }
}
