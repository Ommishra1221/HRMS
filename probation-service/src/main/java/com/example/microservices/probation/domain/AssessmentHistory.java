package com.example.microservices.probation.domain;

import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.*;

@Entity
@Table(name = "probation_assessment_history")
public class AssessmentHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
     @Column(name = "assessment_id")
    private Long assessmentId;
     @Column(name = "action")
    private String action;
     @Column(name = "previous_status")
    private String previousStatus;
     @Column(name = "new_status")
    private String newStatus;
     @Column(name = "performed_by")
    private Long performedBy;
     @Column(name = "performed_at")
    private OffsetDateTime performedAt;
     @Column(name = "remarks")
    private String remarks;
     @Column(name = "evidence_snapshot")
    private String evidenceSnapshot;

    public Long getId() { return id; }
    public Long getAssessmentId() { return assessmentId; }
    public void setAssessmentId(Long value) { this.assessmentId = value; }
    public String getAction() { return action; }
    public void setAction(String value) { this.action = value; }
    public String getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(String value) { this.previousStatus = value; }
    public String getNewStatus() { return newStatus; }
    public void setNewStatus(String value) { this.newStatus = value; }
    public Long getPerformedBy() { return performedBy; }
    public void setPerformedBy(Long value) { this.performedBy = value; }
    public OffsetDateTime getPerformedAt() { return performedAt; }
    public void setPerformedAt(OffsetDateTime value) { this.performedAt = value; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String value) { this.remarks = value; }
    public String getEvidenceSnapshot() { return evidenceSnapshot; }
    public void setEvidenceSnapshot(String value) { this.evidenceSnapshot = value; }
}
