package com.example.microservices.probation.service;

import com.example.microservices.probation.dto.ProbationDtos.*;
import com.example.microservices.probation.domain.AssessmentStatus;

public interface ProbationService {
    AssessmentView create(CreateAssessment request);
    AssessmentView update(Long id, UpdateAssessment request);
    Object get(Long id);
    PageResult<?> list(int page,int size,String search,AssessmentStatus status,Long employeeId,boolean manager,boolean mine);
    AssessmentView send(Long id, VersionRequest request);
    AssessmentView evaluate(Long id, EvaluationRequest request);
    AssessmentView submit(Long id, VersionRequest request);
    AssessmentView returnToManager(Long id, ReviewRequest request);
    AssessmentView forward(Long id, ReviewRequest request);
    AssessmentView decide(Long id, DecisionRequest request);
    AssessmentView reassign(Long id, ReassignRequest request);
    Statistics statistics();
    Capabilities capabilities();
}
