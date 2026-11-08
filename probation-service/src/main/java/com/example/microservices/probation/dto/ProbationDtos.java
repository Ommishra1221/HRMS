package com.example.microservices.probation.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import com.example.microservices.probation.domain.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

/** Explicit input allowlists and distinct employee/internal response contracts. */
public final class ProbationDtos {
    private ProbationDtos() {}
    public record CreateAssessment(@NotNull @Positive Long employeeId,
        @NotNull LocalDate probationStartDate, @NotNull LocalDate probationEndDate,
        @NotNull LocalDate reviewDueDate, @NotNull @Positive Long reportingManagerUserId,
        @Size(max=4000) String initialRemarks, @Positive Long previousAssessmentId) {}
    public record UpdateAssessment(@NotNull @PositiveOrZero Long version,
        @NotNull LocalDate probationStartDate, @NotNull LocalDate probationEndDate,
        @NotNull LocalDate reviewDueDate, @Size(max=4000) String initialRemarks) {}
    public record VersionRequest(@NotNull @PositiveOrZero Long version) {}
    public record ReviewRequest(@NotNull @PositiveOrZero Long version, @NotBlank @Size(max=4000) String remarks) {}
    public record ReassignRequest(@NotNull @PositiveOrZero Long version,
        @NotNull @Positive Long reportingManagerUserId, @NotBlank @Size(max=4000) String remarks) {}
    public record RatingInput(@NotBlank String criterionCode, @Min(1) @Max(5) Integer score, @Size(max=2000) String comments) {}
    public record EvaluationRequest(@NotNull @PositiveOrZero Long version,
        @NotNull @Size(max=50) List<@NotNull @Valid RatingInput> ratings,
        @Size(max=4000) String strengths, @Size(max=4000) String areasForImprovement,
        @Size(max=4000) String developmentRecommendations, Decision recommendation) {}
    public record DecisionRequest(@NotNull @PositiveOrZero Long version, @NotNull Decision decision,
        @Size(max=4000) String remarks, LocalDate revisedEndDate, @Size(max=4000) String publishedComments) {}
    public record EmployeeSummary(Long id, String name, String email, String department) {}
    public record Reviewer(Long id, String username, String fullName, Long employeeId) {
        public String displayName() { return fullName == null || fullName.isBlank() ? username : fullName; }
    }
    public record RatingView(String criterionCode, String criterionName, Integer weight, Integer score, String comments) {}
    public record HistoryView(Long id, String action, String previousStatus, String newStatus,
        Long performedBy, OffsetDateTime performedAt, String remarks, String evidenceSnapshot) {}
    public record Summary(Long id, Long employeeId, String employeeName, String employeeDepartment,
        Long reportingManagerUserId, String managerName, LocalDate probationStartDate,
        LocalDate probationEndDate, LocalDate reviewDueDate, AssessmentStatus status,
        BigDecimal overallScore, Long version, OffsetDateTime updatedAt) {}
    public record AssessmentView(Summary assessment, String criteriaVersion, String initialRemarks,
        List<RatingView> ratings, String strengths, String areasForImprovement, String developmentRecommendations,
        Decision recommendation, String hrReviewRemarks, Decision finalDecision, String decisionRemarks,
        String publishedComments, LocalDate revisedEndDate, Long decidedBy, OffsetDateTime decisionDate,
        OffsetDateTime publishedAt, Long previousAssessmentId, Long createdBy, OffsetDateTime createdAt,
        List<HistoryView> history, boolean canEvaluate) {}
    public record EmployeeOutcome(Long id, Long employeeId, LocalDate probationStartDate,
        LocalDate probationEndDate, LocalDate reviewDueDate, AssessmentStatus status,
        Decision finalDecision, String publishedComments, LocalDate revisedEndDate,
        OffsetDateTime publishedAt, Long previousAssessmentId) {}
    public record PageResult<T>(List<T> content, long totalElements, int totalPages, int page, int size) {}
    public record Statistics(long active, long pendingManager, long pendingHr, long pendingAdmin,
        long completed, List<Summary> recentlyCompleted) {}
    public record Capabilities(boolean hasAssignments) {}
    public record Evidence(Long reviewerUserId, List<RatingView> ratings, String strengths,
        String areasForImprovement, String developmentRecommendations, Decision recommendation,
        BigDecimal overallScore, Long employeeId, LocalDate probationStartDate, LocalDate probationEndDate,
        LocalDate reviewDueDate, String initialRemarks, String hrReviewRemarks, Decision finalDecision,
        String decisionRemarks, LocalDate revisedEndDate, String publishedComments, Long decidedBy, OffsetDateTime decisionDate) {}
}
