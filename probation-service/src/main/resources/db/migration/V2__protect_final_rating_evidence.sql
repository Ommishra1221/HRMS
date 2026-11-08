CREATE FUNCTION probation_schema.protect_final_ratings() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target_id BIGINT;
BEGIN
    target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.assessment_id ELSE NEW.assessment_id END;
    IF EXISTS (SELECT 1 FROM probation_schema.probation_assessments WHERE id = target_id AND final_decision IS NOT NULL) THEN
        RAISE EXCEPTION 'Finalized assessment ratings are immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER probation_final_ratings_immutable BEFORE INSERT OR UPDATE OR DELETE ON probation_schema.probation_assessment_ratings
FOR EACH ROW EXECUTE FUNCTION probation_schema.protect_final_ratings();
