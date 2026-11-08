package com.example.microservices.probation.domain;

public enum AssessmentStatus {
    DRAFT, PENDING_MANAGER_EVALUATION, MANAGER_EVALUATION_IN_PROGRESS,
    PENDING_HR_REVIEW, RETURNED_TO_MANAGER, PENDING_ADMIN_APPROVAL,
    CONFIRMED, EXTENDED, NOT_CONFIRMED;

    public boolean isFinal() { return this == CONFIRMED || this == EXTENDED || this == NOT_CONFIRMED; }
    public boolean isManagerEditable() {
        return this == PENDING_MANAGER_EVALUATION || this == MANAGER_EVALUATION_IN_PROGRESS || this == RETURNED_TO_MANAGER;
    }
}
