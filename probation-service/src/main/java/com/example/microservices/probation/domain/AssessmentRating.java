package com.example.microservices.probation.domain;

import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.*;

@Entity
@Table(name = "probation_assessment_ratings")
public class AssessmentRating {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
     @Column(name = "criterion_code")
    private String criterionCode;
     @Column(name = "criterion_name_snapshot")
    private String criterionNameSnapshot;
     @Column(name = "weight")
    private Integer weight;
     @Column(name = "score")
    private Integer score;
     @Column(name = "comments")
    private String comments;
     @Column(name = "created_at")
    private OffsetDateTime createdAt;
     @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assessment_id", nullable = false)
    private Assessment assessment;
    public void setAssessment(Assessment value) { assessment = value; }

    public Long getId() { return id; }
    public String getCriterionCode() { return criterionCode; }
    public void setCriterionCode(String value) { this.criterionCode = value; }
    public String getCriterionNameSnapshot() { return criterionNameSnapshot; }
    public void setCriterionNameSnapshot(String value) { this.criterionNameSnapshot = value; }
    public Integer getWeight() { return weight; }
    public void setWeight(Integer value) { this.weight = value; }
    public Integer getScore() { return score; }
    public void setScore(Integer value) { this.score = value; }
    public String getComments() { return comments; }
    public void setComments(String value) { this.comments = value; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime value) { this.createdAt = value; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime value) { this.updatedAt = value; }
}
