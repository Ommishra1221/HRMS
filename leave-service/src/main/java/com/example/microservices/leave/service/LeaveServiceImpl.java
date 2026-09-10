package com.example.microservices.leave.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.microservices.leave.client.EmployeeClient;
import com.example.microservices.leave.dto.EmployeeResponse;
import com.example.microservices.leave.dto.LeaveRequest;
import com.example.microservices.leave.dto.LeaveResponse;
import com.example.microservices.leave.entity.Leave;
import com.example.microservices.leave.exception.EmployeeServiceException;
import com.example.microservices.leave.exception.ResourceNotFoundException;
import com.example.microservices.leave.repository.LeaveRepository;

import feign.FeignException;

/**
 * THE HEART OF THE MICROSERVICE DEMO.
 *
 * This class does TWO kinds of work:
 * 1. Owns leave data -> reads/writes leave_db via LeaveRepository.
 * 2. Borrows employee data -> calls employee-service over HTTP via EmployeeClient.
 *
 * This is called DATA COMPOSITION (or "API composition"):
 * the final JSON is stitched together from two services at request time.
 * Nothing about employees is stored in leave_db.
 */
@Service
public class LeaveServiceImpl implements LeaveService {

    private final LeaveRepository leaveRepository;
    private final EmployeeClient employeeClient;

    public LeaveServiceImpl(LeaveRepository leaveRepository, EmployeeClient employeeClient) {
        this.leaveRepository = leaveRepository;
        this.employeeClient = employeeClient;
    }

    @Override
    @Transactional
    public LeaveResponse createLeave(LeaveRequest request) {
        // STEP 1: is this a real employee? Ask employee-service over HTTP.
        EmployeeResponse employee = fetchEmployeeOrThrow(request.getEmployeeId());

        // STEP 2: save the leave in OUR OWN database (leave_db).
        Leave leave = new Leave();
        leave.setEmployeeId(request.getEmployeeId());
        leave.setLeaveType(request.getLeaveType());
        leave.setFromDate(request.getFromDate());
        leave.setToDate(request.getToDate());
        leave.setReason(request.getReason());
        // Business rule: a new leave always starts as PENDING.
        // Status changes should go through a dedicated "approve" API later.
        leave.setStatus("PENDING");
        Leave saved = leaveRepository.save(leave);

        // STEP 3: compose the response: leave data (leave_db) + employee data (HTTP).
        LeaveResponse response = toResponse(saved);
        response.setEmployee(employee);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveResponse> getAllLeaves() {
        // LEARNING NOTE: this makes one HTTP call PER leave (the classic "N+1"
        // problem). Fine for learning; later you'd batch/cache or share IDs only.
        return leaveRepository.findAll().stream()
                .map(leave -> {
                    LeaveResponse response = toResponse(leave);
                    response.setEmployee(employeeClient.getEmployeeById(leave.getEmployeeId()));
                    return response;
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public LeaveResponse getLeaveById(Long id) {
        Leave leave = leaveRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Leave not found with id: " + id));

        // ---- THE MICROSERVICE COMMUNICATION HAPPENS ON THIS LINE ----
        // employeeClient is a generated HTTP proxy. This one Java method call
        // becomes:  GET http://localhost:8081/employees/{employeeId}
        EmployeeResponse employee = fetchEmployeeOrThrow(leave.getEmployeeId());

        LeaveResponse response = toResponse(leave);
        response.setEmployee(employee);
        return response;
    }

    @Override
    @Transactional
    public LeaveResponse updateLeave(Long id, LeaveRequest request) {
        Leave leave = leaveRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Leave not found with id: " + id));

        // If the client changed employeeId, verify the new employee exists too.
        EmployeeResponse employee = fetchEmployeeOrThrow(request.getEmployeeId());

        leave.setEmployeeId(request.getEmployeeId());
        leave.setLeaveType(request.getLeaveType());
        leave.setFromDate(request.getFromDate());
        leave.setToDate(request.getToDate());
        leave.setReason(request.getReason());
        Leave updated = leaveRepository.save(leave);

        LeaveResponse response = toResponse(updated);
        response.setEmployee(employee);
        return response;
    }

    @Override
    @Transactional
    public void deleteLeave(Long id) {
        if (!leaveRepository.existsById(id)) {
            throw new ResourceNotFoundException("Leave not found with id: " + id);
        }
        leaveRepository.deleteById(id);
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

    private LeaveResponse toResponse(Leave leave) {
        LeaveResponse response = new LeaveResponse();
        response.setId(leave.getId());
        response.setEmployeeId(leave.getEmployeeId());
        response.setLeaveType(leave.getLeaveType());
        response.setFromDate(leave.getFromDate());
        response.setToDate(leave.getToDate());
        response.setReason(leave.getReason());
        response.setStatus(leave.getStatus());
        return response;
    }
}
