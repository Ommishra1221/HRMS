package com.example.microservices.probation.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.example.microservices.probation.service.ProbationService;
import com.example.microservices.probation.client.ReferenceDirectory;
import com.example.microservices.probation.security.CurrentUser;
import com.example.microservices.probation.domain.*;
import com.example.microservices.probation.dto.ProbationDtos.*;

@RestController
@RequestMapping("/probation")
public class ProbationController {
    private final ProbationService service;
    private final ReferenceDirectory directory;
    public ProbationController(ProbationService service,ReferenceDirectory directory) { this.service=service; this.directory=directory; }
    @PostMapping("/assessments") @PreAuthorize("hasRole('HR')")
    public ResponseEntity<AssessmentView> create(@Valid @RequestBody CreateAssessment request) { return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request)); }
    @PutMapping("/assessments/{id}") @PreAuthorize("hasRole('HR')")
    public AssessmentView update(@PathVariable @Positive Long id,@Valid @RequestBody UpdateAssessment request) { return service.update(id,request); }
    @GetMapping("/assessments/{id}") public Object get(@PathVariable @Positive Long id) { return service.get(id); }
    @GetMapping("/assessments") public PageResult<?> list(
        @RequestParam(defaultValue="0") @Min(0) int page, @RequestParam(defaultValue="20") @Min(1) @Max(100) int size,
        @RequestParam(defaultValue="") @Size(max=100) String search, @RequestParam(required=false) AssessmentStatus status,
        @RequestParam(required=false) @Positive Long employeeId) { return service.list(page,size,search,status,employeeId,false,false); }
    @GetMapping("/manager/assignments") public PageResult<?> assignments(
        @RequestParam(defaultValue="0") @Min(0) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int size,
        @RequestParam(defaultValue="") @Size(max=100) String search,@RequestParam(required=false) AssessmentStatus status) {
        return service.list(page,size,search,status,null,true,false);
    }
    @GetMapping("/me") public PageResult<?> mine(@RequestParam(defaultValue="0") @Min(0) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int size) {
        return service.list(page,size,"",null,null,false,true);
    }
    @GetMapping("/employees/{employeeId}/history") public PageResult<?> employeeHistory(@PathVariable @Positive Long employeeId,
        @RequestParam(defaultValue="0") @Min(0) int page,@RequestParam(defaultValue="20") @Min(1) @Max(100) int size) {
        return service.list(page,size,"",null,employeeId,false,false);
    }
    @GetMapping("/statistics") @PreAuthorize("hasAnyRole('ADMIN','HR')") public Statistics statistics() { return service.statistics(); }
    @GetMapping("/capabilities") public Capabilities capabilities() { return service.capabilities(); }
    @GetMapping("/criteria") public Object criteria() { return java.util.Map.of("version",Criteria.POLICY_VERSION,"criteria",Criteria.ALL,"scoreLabels",Criteria.LABELS); }
    @GetMapping("/employees") @PreAuthorize("hasAnyRole('ADMIN','HR')") public Object employees() { CurrentUser.get().requireOffice(); return directory.employees(); }
    @GetMapping("/reviewers") @PreAuthorize("hasAnyRole('ADMIN','HR')") public PageResult<Reviewer> reviewers(
        @RequestParam(defaultValue="0") @Min(0) int page,@RequestParam(defaultValue="50") @Min(1) @Max(100) int size,
        @RequestParam(defaultValue="") @Size(max=100) String search) { CurrentUser.get().requireOffice(); return directory.reviewers(page,size,search); }
    @PostMapping("/assessments/{id}/send-for-evaluation") @PreAuthorize("hasRole('HR')")
    public AssessmentView send(@PathVariable @Positive Long id,@Valid @RequestBody VersionRequest request) { return service.send(id,request); }
    @PutMapping("/assessments/{id}/evaluation") public AssessmentView evaluate(@PathVariable @Positive Long id,@Valid @RequestBody EvaluationRequest request) { return service.evaluate(id,request); }
    @PostMapping("/assessments/{id}/submit-evaluation") public AssessmentView submit(@PathVariable @Positive Long id,@Valid @RequestBody VersionRequest request) { return service.submit(id,request); }
    @PostMapping("/assessments/{id}/return-to-manager") @PreAuthorize("hasRole('HR')")
    public AssessmentView returnToManager(@PathVariable @Positive Long id,@Valid @RequestBody ReviewRequest request) { return service.returnToManager(id,request); }
    @PostMapping("/assessments/{id}/forward-for-approval") @PreAuthorize("hasRole('HR')")
    public AssessmentView forward(@PathVariable @Positive Long id,@Valid @RequestBody ReviewRequest request) { return service.forward(id,request); }
    @PostMapping("/assessments/{id}/decision") @PreAuthorize("hasRole('ADMIN')")
    public AssessmentView decide(@PathVariable @Positive Long id,@Valid @RequestBody DecisionRequest request) { return service.decide(id,request); }
    @PostMapping("/assessments/{id}/reassign") @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public AssessmentView reassign(@PathVariable @Positive Long id,@Valid @RequestBody ReassignRequest request) { return service.reassign(id,request); }
}
