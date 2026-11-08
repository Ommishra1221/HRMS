package com.example.microservices.probation.service;

import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;
import com.example.microservices.probation.domain.*;
import com.example.microservices.probation.dto.ProbationDtos.*;
import com.example.microservices.probation.security.CurrentUser;

@Component
public class AssessmentMapper {
    public Summary summary(Assessment a) {
        return new Summary(a.getId(),a.getEmployeeId(),a.getEmployeeName(),a.getEmployeeDepartment(),a.getReportingManagerUserId(),a.getManagerName(),
            a.getProbationStartDate(),a.getProbationEndDate(),a.getReviewDueDate(),a.getStatus(),a.getOverallScore(),a.getVersion(),a.getUpdatedAt());
    }
    public List<RatingView> ratings(Assessment a) { return a.getRatings().stream().map(r -> new RatingView(r.getCriterionCode(),r.getCriterionNameSnapshot(),r.getWeight(),r.getScore(),r.getComments())).toList(); }
    public EmployeeOutcome outcome(Assessment a) {
        boolean published=a.getPublishedAt()!=null && a.getStatus().isFinal();
        return new EmployeeOutcome(a.getId(),a.getEmployeeId(),a.getProbationStartDate(),a.getProbationEndDate(),a.getReviewDueDate(),a.getStatus(),
            published?a.getFinalDecision():null,published?a.getPublishedComments():null,published?a.getRevisedEndDate():null,
            published?a.getPublishedAt():null,a.getPreviousAssessmentId());
    }
    public Evidence evidence(Assessment a) {
        return new Evidence(a.getReportingManagerUserId(),ratings(a),a.getStrengths(),a.getAreasForImprovement(),a.getDevelopmentRecommendations(),a.getRecommendation(),a.getOverallScore(),
            a.getEmployeeId(),a.getProbationStartDate(),a.getProbationEndDate(),a.getReviewDueDate(),a.getInitialRemarks(),a.getHrReviewRemarks(),a.getFinalDecision(),a.getDecisionRemarks(),
            a.getRevisedEndDate(),a.getPublishedComments(),a.getDecidedBy(),a.getDecisionDate());
    }
    public AssessmentView detail(Assessment a, List<AssessmentHistory> history, CurrentUser user) {
        boolean office=user.isOffice();
        var visibleHistory=history.stream().filter(h -> office ||
            (h.getPerformedBy().equals(user.userId()) && Set.of("EVALUATION_SAVED","EVALUATION_SUBMITTED").contains(h.getAction())) ||
            Set.of("SENT_FOR_EVALUATION","RETURNED_TO_MANAGER","REASSIGNED").contains(h.getAction()))
            .map(h -> new HistoryView(h.getId(),h.getAction(),h.getPreviousStatus(),h.getNewStatus(),h.getPerformedBy(),h.getPerformedAt(),h.getRemarks(),office?h.getEvidenceSnapshot():null)).toList();
        return new AssessmentView(summary(a),a.getCriteriaVersion(),a.getInitialRemarks(),ratings(a),a.getStrengths(),a.getAreasForImprovement(),a.getDevelopmentRecommendations(),a.getRecommendation(),
            office?a.getHrReviewRemarks():null,a.getFinalDecision(),office?a.getDecisionRemarks():null,a.getPublishedComments(),a.getRevisedEndDate(),a.getDecidedBy(),a.getDecisionDate(),
            a.getPublishedAt(),a.getPreviousAssessmentId(),a.getCreatedBy(),a.getCreatedAt(),visibleHistory,
            user.role().equals("EMPLOYEE") && a.getReportingManagerUserId().equals(user.userId())
                && java.util.Objects.equals(a.getManagerEmployeeId(),user.employeeId()) && a.getStatus().isManagerEditable());
    }
}
