package com.example.microservices.employee.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.microservices.employee.dto.EmployeeRequest;
import com.example.microservices.employee.dto.EmployeeResponse;
import com.example.microservices.employee.entity.Employee;
import com.example.microservices.employee.exception.ForbiddenOperationException;
import com.example.microservices.employee.exception.ResourceNotFoundException;
import com.example.microservices.employee.repository.EmployeeRepository;
import com.example.microservices.employee.security.CurrentUser;

/**
 * ServiceImpl = WHERE the business logic lives.
 *
 * The controller only translates HTTP <-> Java. This class does the real work:
 * validates existence, talks to the repository, converts entity <-> DTO -
 * and now also enforces the OWNERSHIP rule, which no URL pattern can express:
 *
 *   an EMPLOYEE may only read their OWN master record.
 *
 * The caller's identity comes from CurrentUser (populated by
 * JwtAuthenticationFilter out of the signed JWT). The employeeId in the path
 * is treated as a REQUEST, never as PROOF - the proof is the signature on the
 * token. Example: JWT says employeeId = 25, request says GET /employees/26
 * -> ForbiddenOperationException -> 403. GET /employees/25 -> 200.
 */
@Service
public class EmployeeServiceImpl implements EmployeeService {

    private final EmployeeRepository employeeRepository;

    // Constructor injection: Spring hands us the repository automatically.
    // (Preferred over @Autowired on fields - easier to test, fields can be final.)
    public EmployeeServiceImpl(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    @Override
    @Transactional
    public EmployeeResponse createEmployee(EmployeeRequest request) {
        Employee employee = new Employee();
        employee.setName(request.getName());
        employee.setEmail(request.getEmail());
        employee.setDepartment(request.getDepartment());
        // id is NOT set - the database generates it
        Employee saved = employeeRepository.save(employee);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeResponse> getAllEmployees() {
        return employeeRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * EMPLOYEE self-service: the profile is resolved from the JWT, not from
     * any client-supplied id - there is literally no path variable to fake.
     *
     * Two failures are possible, both 403:
     * - the account has NO employeeId claim (a pure ADMIN/HR account): there
     *   is no employee record it could own, so self-service does not apply;
     * - the claim points at an employee that does not exist (deleted since
     *   the token was issued): reporting it as 404 would leak that the link
     *   is stale to a caller that may not probe other ids anyway; 403 states
     *   plainly that this account has no profile it may read.
     */
    @Override
    @Transactional(readOnly = true)
    public EmployeeResponse getMyProfile() {
        CurrentUser caller = CurrentUser.get();
        if (!caller.hasEmployeeLink()) {
            throw new ForbiddenOperationException(
                    "This account is not linked to an employee profile");
        }
        Employee employee = employeeRepository.findById(caller.employeeId())
                .orElseThrow(() -> new ForbiddenOperationException(
                        "This account is not linked to an employee profile"));
        return toResponse(employee);
    }

    @Override
    @Transactional(readOnly = true)
    public EmployeeResponse getEmployeeById(Long id) {
        // OWNERSHIP RULE: an EMPLOYEE may only read their own record, and the
        // only trusted identity is the JWT (CurrentUser), never the path id.
        // ADMIN/HR pass this gate untouched.
        CurrentUser caller = CurrentUser.get();
        if (caller.isEmployee() && !id.equals(caller.employeeId())) {
            throw new ForbiddenOperationException(
                    "Employees may only view their own profile");
        }

        Employee employee = employeeRepository.findById(id)
                // If the row does not exist -> clean 404 via GlobalExceptionHandler
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + id));
        return toResponse(employee);
    }

    @Override
    @Transactional
    public EmployeeResponse updateEmployee(Long id, EmployeeRequest request) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + id));

        employee.setName(request.getName());
        employee.setEmail(request.getEmail());
        employee.setDepartment(request.getDepartment());
        // save() on an entity that already has an id = UPDATE in SQL
        Employee updated = employeeRepository.save(employee);
        return toResponse(updated);
    }

    @Override
    @Transactional
    public void deleteEmployee(Long id) {
        if (!employeeRepository.existsById(id)) {
            throw new ResourceNotFoundException("Employee not found with id: " + id);
        }
        employeeRepository.deleteById(id);
    }

    // ---- private helper: Entity -> Response DTO ----
    private EmployeeResponse toResponse(Employee employee) {
        return new EmployeeResponse(
                employee.getId(),
                employee.getName(),
                employee.getEmail(),
                employee.getDepartment());
    }
}
