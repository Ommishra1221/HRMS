package com.example.microservices.probation.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import com.example.microservices.probation.exception.ProbationException;

/** Versioned central policy catalog. Each assessment snapshots names and weights at creation. */
public final class Criteria {
    private Criteria() {}
    public record Criterion(String code, String name, int weight) {}
    public static final String POLICY_VERSION = "1";
    public static final List<Criterion> ALL = List.of(
        new Criterion("WORK_QUALITY", "Work quality", 1),
        new Criterion("JOB_KNOWLEDGE", "Technical or job knowledge", 1),
        new Criterion("PRODUCTIVITY", "Productivity", 1),
        new Criterion("COMMUNICATION", "Communication", 1),
        new Criterion("TEAMWORK", "Teamwork", 1),
        new Criterion("RELIABILITY", "Reliability", 1),
        new Criterion("ADAPTABILITY", "Adaptability", 1),
        new Criterion("PROFESSIONAL_CONDUCT", "Professional conduct", 1));
    public static final Map<Integer, String> LABELS = Map.of(1, "Needs significant improvement", 2, "Developing", 3, "Meets expectations", 4, "Exceeds expectations", 5, "Outstanding");
    public static BigDecimal average(List<AssessmentRating> ratings) {
        var scored = ratings.stream().filter(r -> r.getScore() != null).toList();
        if (scored.isEmpty()) return null;
        for (var rating : scored) if (rating.getScore() < 1 || rating.getScore() > 5)
            throw ProbationException.badRequest("Scores must be between 1 and 5");
        int total = scored.stream().mapToInt(r -> r.getScore() * r.getWeight()).sum();
        int weights = scored.stream().mapToInt(AssessmentRating::getWeight).sum();
        return BigDecimal.valueOf(total).divide(BigDecimal.valueOf(weights), 2, RoundingMode.HALF_UP);
    }
}
