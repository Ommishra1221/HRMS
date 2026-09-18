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
import com.example.microservices.leave.exception.ForbiddenOperationException;
import com.example.microservices.leave.exception.ResourceNotFoundException;
import com.example.microservices.leave.repository.LeaveRepository;
import com.example.microservices.leave.security.CurrentUser;

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
 *
 * THE AUTHORIZATION LAYER (added, existing leave logic untouched):
 * Role gates ("HR cannot write", "everyone must be logged in") already ran in
 * SecurityConfig/@PreAuthorize before this code executes. What is LEFT is the
 * per-row part, because it depends on the data itself:
 *
 *   1. OWNERSHIP - an EMPLOYEE's rows are the ones whose employee_id equals
 *      the employeeId claim in their JWT (CurrentUser). The employeeId in a
 *      request body is NEVER trusted: on create it is overwritten with the
 *      JWT value, and a body that claims somebody else's identity is a 403.
 *   2. THE PENDING LIFECYCLE - an EMPLOYEE may edit or delete only a leave
 *      that is still PENDING. (ADMIN keeps full control; the lifecycle rule
 *      is a self-service restriction, not an admin one.)
 *
 * "me" list note: an EMPLOYEE asking for ALL leaves gets back only their own
 * - the scope comes from the token, so no query parameter can widen it.
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
        // THE OWNERSHIP RULE, applied to the one field that matters here:
        // the body's employeeId is a REQUEST, never PROOF. The identity is
        // the JWT's employeeId claim. An EMPLOYEE who sends somebody else's
        // employeeId is refused (403); everybody else keeps the ADMIN/HR
        // behaviour of applying on behalf of a chosen employee (the employee
        // existence check below still runs via Feign).
        CurrentUser caller = CurrentUser.get();
        Long employeeId = request.getEmployeeId();
        if (caller.isEmployee()) {
            if (!caller.hasEmployeeLink()) {
                throw new ForbiddenOperationException(
                        "This account is not linked to an employee profile");
            }
            if (!employeeId.equals(caller.employeeId())) {
                throw new ForbiddenOperationException(
                        "You can only apply for leave as your own employee record ("
                                + caller.employeeId() + ")");
            }
        }

        // STEP 1: is this a real employee? Ask employee-service over HTTP.
        EmployeeResponse employee = fetchEmployeeOrThrow(employeeId);

        // STEP 2: save the leave in OUR OWN database (leave_db).
        Leave leave = new Leave();
        leave.setEmployeeId(employeeId);
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
        // OWNERSHIP: an EMPLOYEE's "list everything" is silently scoped to
        // their own rows - the filter value is the JWT's employeeId claim,
        // not anything the client sent.
        CurrentUser caller = CurrentUser.get();
        List<Leave> leaves = caller.isEmployee()
                ? leaveRepository.findByEmployeeId(caller.employeeId())
                : leaveRepository.findAll();

        // LEARNING NOTE: this makes one HTTP call PER leave (the classic "N+1"
        // problem). Fine for learning; later you'd batch/cache or share IDs only.
        return leaves.stream()
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

        // OWNERSHIP: an EMPLOYEE may only read their own leave. The row's
        // employee_id is compared with the JWT's employeeId claim - the id in
        // the path is a REQUEST, never PROOF. (ADMIN and HR pass freely.)
        CurrentUser caller = CurrentUser.get();
        if (caller.isEmployee() && !leave.getEmployeeId().equals(caller.employeeId())) {
            throw new ForbiddenOperationException("You can only view your own leave requests");
        }

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

        CurrentUser caller = CurrentUser.get();
        if (caller.isEmployee()) {
            // OWNERSHIP first: is this the caller's own leave?
            if (!leave.getEmployeeId().equals(caller.employeeId())) {
                throw new ForbiddenOperationException("You can only edit your own leave requests");
            }
            // THE PENDING LIFECYCLE: self-service edits end once a leave stops
            // being PENDING. (An ADMIN is not restricted by this rule.)
            if (!"PENDING".equalsIgnoreCase(leave.getStatus())) {
                throw new ForbiddenOperationException(
                        "Only PENDING leave requests can be edited (this one is "
                                + leave.getStatus() + ")");
            }
            // Same rule as create: the body's employeeId is NEVER trusted. An
            // edit is content-only - the leave stays filed under the caller's
            // own employee record, no matter what the body claims. (Without
            // this overwrite an employee could re-assign their request to a
            // colleague by changing one field.)
            request.setEmployeeId(caller.employeeId());
        }

        // If the client changed employeeId (an ADMIN editing on behalf of
        // someone else), verify the new employee exists too.
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
        Leave leave = leaveRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Leave not found with id: " + id));

        // Same two self-service rules as update: OWN own row + PENDING only.
        // ADMIN is unrestricted. (The extra findById instead of the old
        // existsById is what lets the service SEE the row it is judging.)
        CurrentUser caller = CurrentUser.get();
        if (caller.isEmployee()) {
            if (!leave.getEmployeeId().equals(caller.employeeId())) {
                throw new ForbiddenOperationException("You can only delete your own leave requests");
            }
            if (!"PENDING".equalsIgnoreCase(leave.getStatus())) {
                throw new ForbiddenOperationException(
                        "Only PENDING leave requests can be deleted (this one is "
                                + leave.getStatus() + ")");
            }
        }

        leaveRepository.delete(leave);
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
