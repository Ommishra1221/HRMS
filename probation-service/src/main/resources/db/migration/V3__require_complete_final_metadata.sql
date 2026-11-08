-- Make both branches explicit: PostgreSQL CHECK constraints otherwise accept NULL.
ALTER TABLE probation_schema.probation_assessments
ADD CONSTRAINT probation_complete_final_metadata CHECK (
    CASE WHEN final_decision IS NULL THEN
        status NOT IN ('CONFIRMED','EXTENDED','NOT_CONFIRMED')
        AND decision_date IS NULL AND decided_by IS NULL AND published_at IS NULL
    ELSE
        final_decision IN ('CONFIRMED','EXTENDED','NOT_CONFIRMED') AND status = final_decision
        AND decision_date IS NOT NULL AND decided_by IS NOT NULL AND published_at IS NOT NULL
    END
);
