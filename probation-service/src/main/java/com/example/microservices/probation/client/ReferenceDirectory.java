package com.example.microservices.probation.client;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import com.example.microservices.probation.dto.ProbationDtos.*;
import com.example.microservices.probation.exception.ProbationException;

@Service
public class ReferenceDirectory {
    private final EmployeeClient employees; private final ReviewerClient reviewers;
    public ReferenceDirectory(EmployeeClient employees, ReviewerClient reviewers) { this.employees=employees; this.reviewers=reviewers; }
    public EmployeeSummary employee(Long id) {
        try { return employees.get(id); }
        catch (feign.FeignException.NotFound ex) { throw new ProbationException(HttpStatus.NOT_FOUND, "Referenced employee is unavailable"); }
    }
    public Reviewer reviewer(Long id) {
        try { return reviewers.get(id); }
        catch (feign.FeignException.NotFound ex) { throw ProbationException.badRequest("Reviewer must be an enabled, employee-linked EMPLOYEE account"); }
    }
    public List<EmployeeSummary> employees() { return employees.list(); }
    public PageResult<Reviewer> reviewers(int page, int size, String search) { return reviewers.list(page,size,search); }
}
