package com.example.microservices.probation.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.microservices.probation.domain.AssessmentHistory;

public interface HistoryRepository extends JpaRepository<AssessmentHistory,Long> {
    List<AssessmentHistory> findByAssessmentIdOrderByIdAsc(Long assessmentId);
}
