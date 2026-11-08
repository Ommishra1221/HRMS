package com.example.microservices.probation.domain;

import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.*;

@Entity
@Table(name = "probation_assessments")
public class Assessment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
     @Column(name = "employee_id")
    private Long employeeId;
     @Column(name = "employee_name")
    private String employeeName;
     @Column(name = "employee_department")
    private String employeeDepartment;
     @Column(name = "probation_start_date")
    private LocalDate probationStartDate;
     @Column(name = "probation_end_date")
    private LocalDate probationEndDate;
     @Column(name = "review_due_date")
    private LocalDate reviewDueDate;
     @Column(name = "reporting_manager_user_id")
    private Long reportingManagerUserId;
     @Column(name = "manager_employee_id")
    private Long managerEmployeeId;
     @Column(name = "manager_name")
    private String managerName;
    @Enumerated(EnumType.STRING) @Column(name = "status")
    private AssessmentStatus status;
     @Column(name = "criteria_version")
    private String criteriaVersion;
     @Column(name = "initial_remarks")
    private String initialRemarks;
     @Column(name = "strengths")
    private String strengths;
     @Column(name = "areas_for_improvement")
    private String areasForImprovement;
     @Column(name = "development_recommendations")
    private String developmentRecommendations;
    @Enumerated(EnumType.STRING) @Column(name = "recommendation")
    private Decision recommendation;
     @Column(name = "overall_score")
    private BigDecimal overallScore;
     @Column(name = "hr_review_remarks")
    private String hrReviewRemarks;
    @Enumerated(EnumType.STRING) @Column(name = "final_decision")
    private Decision finalDecision;
     @Column(name = "decision_remarks")
    private String decisionRemarks;
     @Column(name = "published_comments")
    private String publishedComments;
     @Column(name = "revised_end_date")
    private LocalDate revisedEndDate;
     @Column(name = "decision_date")
    private OffsetDateTime decisionDate;
     @Column(name = "decided_by")
    private Long decidedBy;
     @Column(name = "published_at")
    private OffsetDateTime publishedAt;
     @Column(name = "previous_assessment_id")
    private Long previousAssessmentId;
     @Column(name = "created_by")
    private Long createdBy;
     @Column(name = "created_at")
    private OffsetDateTime createdAt;
     @Column(name = "updated_by")
    private Long updatedBy;
     @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
    @Version @Column(name = "version")
    private Long version;
    @OneToMany(mappedBy = "assessment", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<AssessmentRating> ratings = new ArrayList<>();
    public List<AssessmentRating> getRatings() { return ratings; }

    public Long getId() { return id; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long value) { this.employeeId = value; }
    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String value) { this.employeeName = value; }
    public String getEmployeeDepartment() { return employeeDepartment; }
    public void setEmployeeDepartment(String value) { this.employeeDepartment = value; }
    public LocalDate getProbationStartDate() { return probationStartDate; }
    public void setProbationStartDate(LocalDate value) { this.probationStartDate = value; }
    public LocalDate getProbationEndDate() { return probationEndDate; }
    public void setProbationEndDate(LocalDate value) { this.probationEndDate = value; }
    public LocalDate getReviewDueDate() { return reviewDueDate; }
    public void setReviewDueDate(LocalDate value) { this.reviewDueDate = value; }
    public Long getReportingManagerUserId() { return reportingManagerUserId; }
    public void setReportingManagerUserId(Long value) { this.reportingManagerUserId = value; }
    public Long getManagerEmployeeId() { return managerEmployeeId; }
    public void setManagerEmployeeId(Long value) { this.managerEmployeeId = value; }
    public String getManagerName() { return managerName; }
    public void setManagerName(String value) { this.managerName = value; }
    public AssessmentStatus getStatus() { return status; }
    public void setStatus(AssessmentStatus value) { this.status = value; }
    public String getCriteriaVersion() { return criteriaVersion; }
    public void setCriteriaVersion(String value) { this.criteriaVersion = value; }
    public String getInitialRemarks() { return initialRemarks; }
    public void setInitialRemarks(String value) { this.initialRemarks = value; }
    public String getStrengths() { return strengths; }
    public void setStrengths(String value) { this.strengths = value; }
    public String getAreasForImprovement() { return areasForImprovement; }
    public void setAreasForImprovement(String value) { this.areasForImprovement = value; }
    public String getDevelopmentRecommendations() { return developmentRecommendations; }
    public void setDevelopmentRecommendations(String value) { this.developmentRecommendations = value; }
    public Decision getRecommendation() { return recommendation; }
    public void setRecommendation(Decision value) { this.recommendation = value; }
    public BigDecimal getOverallScore() { return overallScore; }
    public void setOverallScore(BigDecimal value) { this.overallScore = value; }
    public String getHrReviewRemarks() { return hrReviewRemarks; }
    public void setHrReviewRemarks(String value) { this.hrReviewRemarks = value; }
    public Decision getFinalDecision() { return finalDecision; }
    public void setFinalDecision(Decision value) { this.finalDecision = value; }
    public String getDecisionRemarks() { return decisionRemarks; }
    public void setDecisionRemarks(String value) { this.decisionRemarks = value; }
    public String getPublishedComments() { return publishedComments; }
    public void setPublishedComments(String value) { this.publishedComments = value; }
    public LocalDate getRevisedEndDate() { return revisedEndDate; }
    public void setRevisedEndDate(LocalDate value) { this.revisedEndDate = value; }
    public OffsetDateTime getDecisionDate() { return decisionDate; }
    public void setDecisionDate(OffsetDateTime value) { this.decisionDate = value; }
    public Long getDecidedBy() { return decidedBy; }
    public void setDecidedBy(Long value) { this.decidedBy = value; }
    public OffsetDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(OffsetDateTime value) { this.publishedAt = value; }
    public Long getPreviousAssessmentId() { return previousAssessmentId; }
    public void setPreviousAssessmentId(Long value) { this.previousAssessmentId = value; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long value) { this.createdBy = value; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime value) { this.createdAt = value; }
    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long value) { this.updatedBy = value; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime value) { this.updatedAt = value; }
    public Long getVersion() { return version; }
    public void setVersion(Long value) { this.version = value; }
}
