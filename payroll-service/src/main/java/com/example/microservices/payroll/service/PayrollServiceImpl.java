package com.example.microservices.payroll.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.microservices.payroll.client.EmployeeClient;
import com.example.microservices.payroll.dto.PayrollRequest;
import com.example.microservices.payroll.dto.PayrollResponse;
import com.example.microservices.payroll.dto.EmployeeResponse;
import com.example.microservices.payroll.entity.Payroll;
import com.example.microservices.payroll.exception.EmployeeServiceException;
import com.example.microservices.payroll.exception.ForbiddenOperationException;
import com.example.microservices.payroll.exception.PayrollNotFoundException;
import com.example.microservices.payroll.repository.PayrollRepository;
import com.example.microservices.payroll.security.CurrentUser;

import feign.FeignException;

/**
 * THE HEART OF payroll-service.
 *
 * This class does TWO kinds of work:
 * 1. Owns payroll data -> reads/writes payroll_db via PayrollRepository.
 * 2. Borrows employee data -> calls employee-service over HTTP via EmployeeClient.
 *
 * This is DATA COMPOSITION ("API composition"): the final JSON is stitched
 * together from two services at request time. Nothing about employees is
 * stored in payroll_db - only the employeeId number.
 *
 * THE AUTHORIZATION LAYER (added, existing payroll rules untouched):
 * Role gates ("only ADMIN writes or marks PAID", "HR is read-only") already
 * ran in SecurityConfig/@PreAuthorize before this code executes. What is
 * LEFT here is the per-row rule, because it depends on the data itself: an
 * EMPLOYEE's rows are the ones whose employee_id equals the employeeId claim
 * in their JWT (CurrentUser) - the employeeId in a query string is NEVER
 * trusted. All money rules (one payslip per month, server-side netSalary,
 * PENDING -> PAID, PAID immutability) are exactly as they were.
 */
@Service
public class PayrollServiceImpl implements PayrollService {

    private final PayrollRepository payrollRepository;
    private final EmployeeClient employeeClient;

    public PayrollServiceImpl(PayrollRepository payrollRepository, EmployeeClient employeeClient) {
        this.payrollRepository = payrollRepository;
        this.employeeClient = employeeClient;
    }

    @Override
    @Transactional
    public PayrollResponse createPayroll(PayrollRequest request) {
        // STEP 1: is this a real employee? Ask employee-service over HTTP.
        EmployeeResponse employee = fetchEmployeeOrThrow(request.getEmployeeId());

        // STEP 2: business rules before touching the database.
        if (payrollRepository.findByEmployeeIdAndMonth(
                request.getEmployeeId(), request.getMonth()).isPresent()) {
            throw new EmployeeServiceException(
                    "Payroll already exists for employee " + request.getEmployeeId()
                            + " for month " + request.getMonth()
                            + " (one payslip per employee per month)",
                    HttpStatus.CONFLICT);
        }

        // STEP 3: save the payslip in OUR OWN database (payroll_db).
        // Business rule: a new payroll always starts as PENDING (unpaid).
        Payroll payroll = new Payroll();
        applyRequest(payroll, request);
        payroll.setStatus("PENDING");
        Payroll saved = payrollRepository.save(payroll);

        // STEP 4: compose the response: payroll data + employee data (HTTP).
        PayrollResponse response = toResponse(saved);
        response.setEmployee(employee);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PayrollResponse> getAllPayrolls() {
        // OWNERSHIP: an EMPLOYEE's "list everything" is silently scoped to
        // their own payslips - the filter value is the JWT's employeeId claim,
        // not anything the client sent (no ?employeeId= can widen it).
        CurrentUser caller = CurrentUser.get();
        List<Payroll> payrolls = caller.isEmployee()
                ? payrollRepository.findByEmployeeIdOrderByMonthDesc(caller.employeeId())
                : payrollRepository.findAll();

        // LEARNING NOTE: one HTTP call PER record (the classic "N+1" problem).
        // Fine for learning; later you'd batch/cache or share IDs only.
        return payrolls.stream()
                .map(this::toResponseWithEmployee)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PayrollResponse getPayrollById(Long id) {
        Payroll payroll = payrollRepository.findById(id)
                .orElseThrow(() -> new PayrollNotFoundException("Payroll not found with id: " + id));

        // OWNERSHIP: an EMPLOYEE may only read their own payslip. The row's
        // employee_id is compared with the JWT's employeeId claim - the id in
        // the path is a REQUEST, never PROOF. (ADMIN and HR pass freely.)
        CurrentUser caller = CurrentUser.get();
        if (caller.isEmployee() && !payroll.getEmployeeId().equals(caller.employeeId())) {
            throw new ForbiddenOperationException("You can only view your own payslips");
        }

        // ---- THE MICROSERVICE COMMUNICATION HAPPENS ON THIS LINE ----
        // employeeClient is a generated HTTP proxy. This one Java method call
        // becomes:  GET http://localhost:8081/employees/{employeeId}
        return toResponseWithEmployee(payroll);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PayrollResponse> getPayrollsByEmployee(Long employeeId) {
        // OWNERSHIP: whatever the query string asked for, an EMPLOYEE's filter
        // is FORCED to their own employeeId from the JWT. Asking for somebody
        // else's id is not an error - it simply returns your own payslips,
        // the same way the unfiltered list does. (ADMIN and HR keep the real
        // filter.)
        CurrentUser caller = CurrentUser.get();
        if (caller.isEmployee()) {
            employeeId = caller.employeeId();
        }

        // Verify the employee exists before listing (same Feign check as create).
        fetchEmployeeOrThrow(employeeId);
        return payrollRepository.findByEmployeeIdOrderByMonthDesc(employeeId).stream()
                .map(this::toResponseWithEmployee)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public PayrollResponse updatePayroll(Long id, PayrollRequest request) {
        Payroll payroll = payrollRepository.findById(id)
                .orElseThrow(() -> new PayrollNotFoundException("Payroll not found with id: " + id));

        // PAID IS IMMUTABLE - now enforced on the full update too, not only on
        // markPaid(). markPaid() alone made the PAID transition terminal, but
        // PUT could still rewrite basicSalary/allowances/deductions (and even
        // the employee/month) of an already-paid payslip: an ADMIN could
        // retroactively change what was actually paid. 409 - a business
        // conflict, matching markPaid's refusal of a second payment.
        if ("PAID".equalsIgnoreCase(payroll.getStatus())) {
            throw new EmployeeServiceException(
                    "Payroll " + id + " is already paid (month " + payroll.getMonth()
                            + ") and can no longer be modified",
                    HttpStatus.CONFLICT);
        }

        // If the client changed employeeId/month, the duplicate rule must hold
        // for the NEW values - and the employee must exist.
        EmployeeResponse employee = fetchEmployeeOrThrow(request.getEmployeeId());
        payrollRepository.findByEmployeeIdAndMonth(request.getEmployeeId(), request.getMonth())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new EmployeeServiceException(
                            "Payroll already exists for employee " + request.getEmployeeId()
                                    + " for month " + request.getMonth(),
                            HttpStatus.CONFLICT);
                });

        applyRequest(payroll, request);
        Payroll updated = payrollRepository.save(payroll);

        PayrollResponse response = toResponse(updated);
        response.setEmployee(employee);
        return response;
    }

    /**
     * Business action (not plain CRUD): pays a PENDING payslip.
     * Same idea as attendance-service's markCheckOut - a dedicated endpoint
     * for one small, rule-checked state change.
     */
    @Override
    @Transactional
    public PayrollResponse markPaid(Long id, LocalDate paymentDate) {
        Payroll payroll = payrollRepository.findById(id)
                .orElseThrow(() -> new PayrollNotFoundException("Payroll not found with id: " + id));

        if (payroll.getStatus().equalsIgnoreCase("PAID")) {
            throw new EmployeeServiceException(
                    "Payroll " + id + " is already paid (month " + payroll.getMonth() + ")",
                    HttpStatus.CONFLICT);
        }
        LocalDate date = paymentDate != null ? paymentDate : LocalDate.now();

        payroll.setStatus("PAID");
        payroll.setPaymentDate(date);
        Payroll updated = payrollRepository.save(payroll);
        return toResponseWithEmployee(updated);
    }

    @Override
    @Transactional
    public void deletePayroll(Long id) {
        Payroll payroll = payrollRepository.findById(id)
                .orElseThrow(() -> new PayrollNotFoundException("Payroll not found with id: " + id));

        // PAID IS IMMUTABLE - deletion included. A payslip is a financial
        // record of money that actually moved; deleting one would erase the
        // only trace of the payment. ADMIN deletes a PENDING payslip freely.
        if ("PAID".equalsIgnoreCase(payroll.getStatus())) {
            throw new EmployeeServiceException(
                    "Payroll " + id + " is already paid (month " + payroll.getMonth()
                            + ") and cannot be deleted",
                    HttpStatus.CONFLICT);
        }
        payrollRepository.delete(payroll);
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

    private PayrollResponse toResponseWithEmployee(Payroll payroll) {
        PayrollResponse response = toResponse(payroll);
        response.setEmployee(employeeClient.getEmployeeById(payroll.getEmployeeId()));
        return response;
    }

    private void applyRequest(Payroll payroll, PayrollRequest request) {
        payroll.setEmployeeId(request.getEmployeeId());
        payroll.setMonth(request.getMonth().trim());
        payroll.setBasicSalary(request.getBasicSalary());
        payroll.setAllowances(request.getAllowances());
        payroll.setDeductions(request.getDeductions());
        payroll.setPaymentDate(request.getPaymentDate());
    }

    private PayrollResponse toResponse(Payroll payroll) {
        PayrollResponse response = new PayrollResponse();
        response.setId(payroll.getId());
        response.setEmployeeId(payroll.getEmployeeId());
        response.setMonth(payroll.getMonth());
        response.setBasicSalary(payroll.getBasicSalary());
        response.setAllowances(payroll.getAllowances());
        response.setDeductions(payroll.getDeductions());
        response.setNetSalary(computeNetSalary(payroll));
        response.setStatus(payroll.getStatus());
        response.setPaymentDate(payroll.getPaymentDate());
        return response;
    }

    // Business math lives in the service, never in the controller or the DTO.
    private BigDecimal computeNetSalary(Payroll payroll) {
        return payroll.getBasicSalary()
                .add(payroll.getAllowances())
                .subtract(payroll.getDeductions());
    }
}
