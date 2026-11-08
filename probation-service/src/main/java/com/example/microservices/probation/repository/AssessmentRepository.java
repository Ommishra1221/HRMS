package com.example.microservices.probation.repository;

import com.example.microservices.probation.domain.Assessment;
import org.springframework.data.jpa.repository.*;

public interface AssessmentRepository extends JpaRepository<Assessment,Long>, JpaSpecificationExecutor<Assessment> {
    boolean existsByReportingManagerUserId(Long userId);
    boolean existsByPreviousAssessmentId(Long id);
}
