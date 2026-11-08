package com.example.microservices.probation;

import java.time.LocalDate;
import java.util.List;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import com.example.microservices.probation.domain.*;
import com.example.microservices.probation.dto.ProbationDtos.DecisionRequest;
import com.example.microservices.probation.exception.ProbationException;
import com.example.microservices.probation.service.WorkflowRules;
import com.example.microservices.probation.security.CurrentUser;

class WorkflowRulesTest {
    @Test void datesMustBeOrderedAndReviewInsidePeriod() {
        var start=LocalDate.of(2026,1,1); var end=start.plusMonths(3);
        WorkflowRules.dates(start,end,end);
        assertThrows(ProbationException.class,()->WorkflowRules.dates(end,start,start));
        assertThrows(ProbationException.class,()->WorkflowRules.dates(start,end,end.plusDays(1)));
        assertThrows(ProbationException.class,()->WorkflowRules.dates(start,end,start.minusDays(1)));
    }
    @Test void weightedScoreIsCalculatedOnServerAndEmptyDraftHasNoAverage() {
        var a=new AssessmentRating(); a.setScore(5); a.setWeight(2);
        var b=new AssessmentRating(); b.setScore(2); b.setWeight(1);
        assertEquals(new BigDecimal("4.00"),Criteria.average(List.of(a,b)));
        assertNull(Criteria.average(List.of()));
        b.setScore(6); assertThrows(ProbationException.class,()->Criteria.average(List.of(a,b)));
    }
    @Test void incompleteRatingsAndFeedbackCannotBeSubmitted() {
        var a=new Assessment(); a.setStatus(AssessmentStatus.MANAGER_EVALUATION_IN_PROGRESS);
        assertThrows(ProbationException.class,()->WorkflowRules.complete(a));
        var r=new AssessmentRating(); r.setWeight(1); r.setScore(3); r.setComments("Evidence"); a.getRatings().add(r);
        a.setRecommendation(Decision.CONFIRMED); a.setStrengths("Quality"); a.setAreasForImprovement("Speed"); a.setDevelopmentRecommendations("Coaching");
        WorkflowRules.complete(a);
        r.setComments(" "); assertThrows(ProbationException.class,()->WorkflowRules.complete(a));
    }
    @Test void transitionsAndFinalImmutabilityAreExplicit() {
        for(var status:AssessmentStatus.values()) {
            var a=new Assessment(); a.setStatus(status);
            if(status.isFinal()) assertThrows(ProbationException.class,()->WorkflowRules.require(a,status));
            else WorkflowRules.require(a,status);
        }
        var a=new Assessment(); a.setStatus(AssessmentStatus.DRAFT);
        assertThrows(ProbationException.class,()->WorkflowRules.require(a,AssessmentStatus.PENDING_ADMIN_APPROVAL));
    }
    @Test void extensionAndNonConfirmationRequireReasons() {
        var a=new Assessment(); a.setProbationEndDate(LocalDate.of(2026,6,30));
        assertThrows(ProbationException.class,()->WorkflowRules.decision(a,new DecisionRequest(0L,Decision.EXTENDED,"",LocalDate.of(2026,9,30),null)));
        assertThrows(ProbationException.class,()->WorkflowRules.decision(a,new DecisionRequest(0L,Decision.EXTENDED,"Reason",a.getProbationEndDate(),null)));
        assertThrows(ProbationException.class,()->WorkflowRules.decision(a,new DecisionRequest(0L,Decision.NOT_CONFIRMED," ",null,null)));
        WorkflowRules.decision(a,new DecisionRequest(0L,Decision.EXTENDED,"Coaching needed",a.getProbationEndDate().plusMonths(1),null));
        WorkflowRules.decision(a,new DecisionRequest(0L,Decision.CONFIRMED,null,null,null));
    }
    @Test void rolesAndMissingPrincipalFailClosed() {
        var hr=new CurrentUser(1L,"hr",null,"HR"); hr.requireOffice();
        assertThrows(ProbationException.class,()->hr.requireRole("ADMIN"));
        assertThrows(ProbationException.class,()->new CurrentUser(2L,"employee",2L,"EMPLOYEE").requireOffice());
        assertThrows(ProbationException.class,CurrentUser::get);
    }
}
