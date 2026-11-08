package com.example.microservices.probation.service;

import java.time.LocalDate;
import java.util.Set;
import com.example.microservices.probation.domain.*;
import com.example.microservices.probation.dto.ProbationDtos.DecisionRequest;
import com.example.microservices.probation.exception.ProbationException;

public final class WorkflowRules {
    private WorkflowRules() {}
    public static void dates(LocalDate start, LocalDate end, LocalDate due) {
        if (start == null || end == null || due == null || end.isBefore(start) || due.isBefore(start) || due.isAfter(end))
            throw ProbationException.badRequest("Review due date must be within a valid probation start/end period");
    }
    public static void require(Assessment a, AssessmentStatus... allowed) {
        if (a.getStatus().isFinal()) throw ProbationException.conflict("Finalized assessments cannot be changed");
        if (!Set.of(allowed).contains(a.getStatus()))
            throw ProbationException.conflict("This action is not allowed while the assessment is " + a.getStatus());
    }
    public static void complete(Assessment a) {
        if (a.getRatings().isEmpty() || a.getRatings().stream().anyMatch(r -> r.getScore()==null || r.getScore()<1 || r.getScore()>5 || blank(r.getComments()))
            || a.getRecommendation()==null || blank(a.getStrengths()) || blank(a.getAreasForImprovement()) || blank(a.getDevelopmentRecommendations()))
            throw ProbationException.badRequest("Complete every criterion score and comment, strengths, improvement areas, development recommendations and manager recommendation before submission");
    }
    public static void decision(Assessment a, DecisionRequest request) {
        if (request.decision()==null) throw ProbationException.badRequest("Final decision is required");
        if (request.decision()!=Decision.CONFIRMED && blank(request.remarks()))
            throw ProbationException.badRequest("A reason is required for extension or non-confirmation");
        if (request.decision()==Decision.EXTENDED) {
            if (request.revisedEndDate()==null || !request.revisedEndDate().isAfter(a.getProbationEndDate()))
                throw ProbationException.badRequest("An extension requires an approved end date after the current end date");
        } else if (request.revisedEndDate()!=null) throw ProbationException.badRequest("A revised end date applies only to an extension");
    }
    public static boolean blank(String text) { return text==null || text.isBlank(); }
}
