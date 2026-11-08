package com.example.microservices.probation.service;

import java.time.*;
import java.util.*;
import java.util.function.Function;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import com.example.microservices.probation.client.ReferenceDirectory;
import com.example.microservices.probation.domain.*;
import com.example.microservices.probation.dto.ProbationDtos.*;
import com.example.microservices.probation.exception.ProbationException;
import com.example.microservices.probation.repository.*;
import com.example.microservices.probation.security.CurrentUser;
import tools.jackson.databind.ObjectMapper;
import static com.example.microservices.probation.domain.AssessmentStatus.*;

@Service
@Transactional(readOnly=true)
public class ProbationServiceImpl implements ProbationService {
    private final AssessmentRepository assessments;
    private final HistoryRepository history;
    private final ReferenceDirectory directory;
    private final AssessmentMapper mapper;
    private final ObjectMapper json;
    public ProbationServiceImpl(AssessmentRepository assessments, HistoryRepository history, ReferenceDirectory directory,
        AssessmentMapper mapper, ObjectMapper json) {
        this.assessments=assessments; this.history=history; this.directory=directory; this.mapper=mapper; this.json=json;
    }

    @Override @Transactional
    public AssessmentView create(CreateAssessment request) {
        var user=CurrentUser.get(); user.requireRole("HR");
        WorkflowRules.dates(request.probationStartDate(),request.probationEndDate(),request.reviewDueDate());
        var employee=directory.employee(request.employeeId());
        var a=new Assessment();
        a.setEmployeeId(employee.id()); a.setEmployeeName(employee.name()); a.setEmployeeDepartment(employee.department());
        a.setProbationStartDate(request.probationStartDate()); a.setProbationEndDate(request.probationEndDate());
        a.setReviewDueDate(request.reviewDueDate()); a.setInitialRemarks(trim(request.initialRemarks()));
        a.setPreviousAssessmentId(request.previousAssessmentId());
        validateParent(a);
        assign(a,request.reportingManagerUserId());
        a.setStatus(DRAFT); a.setCriteriaVersion(Criteria.POLICY_VERSION);
        var now=OffsetDateTime.now(ZoneOffset.UTC);
        a.setCreatedBy(user.userId()); a.setCreatedAt(now); a.setUpdatedBy(user.userId()); a.setUpdatedAt(now);
        for (var c:Criteria.ALL) {
            var rating=new AssessmentRating(); rating.setAssessment(a); rating.setCriterionCode(c.code());
            rating.setCriterionNameSnapshot(c.name()); rating.setWeight(c.weight()); rating.setCreatedAt(now); rating.setUpdatedAt(now);
            a.getRatings().add(rating);
        }
        assessments.saveAndFlush(a);
        audit(a,null,"CREATED",request.initialRemarks());
        return detail(a);
    }

    @Override @Transactional
    public AssessmentView update(Long id, UpdateAssessment request) {
        CurrentUser.get().requireRole("HR");
        var a=load(id); WorkflowRules.require(a,DRAFT); version(a,request.version());
        WorkflowRules.dates(request.probationStartDate(),request.probationEndDate(),request.reviewDueDate());
        a.setProbationStartDate(request.probationStartDate()); a.setProbationEndDate(request.probationEndDate());
        a.setReviewDueDate(request.reviewDueDate()); a.setInitialRemarks(trim(request.initialRemarks()));
        validateParent(a);
        return changed(a,DRAFT,"DRAFT_UPDATED",request.initialRemarks());
    }

    private void validateParent(Assessment a) {
        if (a.getPreviousAssessmentId()==null) return;
        var parent=load(a.getPreviousAssessmentId());
        if (parent.getStatus()!=EXTENDED || !parent.getEmployeeId().equals(a.getEmployeeId()))
            throw ProbationException.badRequest("Follow-up cycles must reference an EXTENDED assessment for the same employee");
        if (!a.getProbationStartDate().equals(parent.getProbationEndDate().plusDays(1)) || !a.getProbationEndDate().equals(parent.getRevisedEndDate()))
            throw ProbationException.badRequest("Follow-up dates must cover the approved extension period");
        if (a.getId()==null && assessments.existsByPreviousAssessmentId(parent.getId()))
            throw ProbationException.conflict("A follow-up cycle already exists for this extension");
    }

    private void assign(Assessment a, Long reviewerId) {
        var reviewer=directory.reviewer(reviewerId);
        if (reviewer.employeeId()==null || reviewer.employeeId().equals(a.getEmployeeId()))
            throw ProbationException.badRequest("The reporting manager must be linked to a different employee");
        directory.employee(reviewer.employeeId()); // auth's employee link is soft; validate it through its owner.
        a.setReportingManagerUserId(reviewer.id()); a.setManagerEmployeeId(reviewer.employeeId()); a.setManagerName(reviewer.displayName());
    }

    @Override public Object get(Long id) {
        var a=load(id); var user=CurrentUser.get();
        if (user.isOffice()) return detail(a);
        if (Objects.equals(a.getEmployeeId(),user.employeeId())) return mapper.outcome(a);
        requireManager(a);
        if (a.getStatus()==DRAFT) throw ProbationException.forbidden();
        return detail(a);
    }

    @Override public PageResult<?> list(int page,int size,String search,AssessmentStatus status,Long employeeId,boolean manager,boolean mine) {
        var user=CurrentUser.get();
        boolean outcomes=mine || (!user.isOffice() && !manager);
        Specification<Assessment> filter=(root,q,cb) -> cb.conjunction();
        if (manager) {
            if (!user.role().equals("EMPLOYEE") || user.employeeId()==null)
                filter=filter.and((r,q,c) -> c.disjunction());
            else filter=filter.and((r,q,c) -> c.and(c.equal(r.get("reportingManagerUserId"),user.userId()),
                c.equal(r.get("managerEmployeeId"),user.employeeId()),c.notEqual(r.get("status"),DRAFT)));
        } else if (outcomes) {
            if (user.employeeId()==null) throw ProbationException.forbidden();
            filter=filter.and((r,q,c) -> c.equal(r.get("employeeId"),user.employeeId()));
            // Employee-supplied filters can only narrow an authorized result, never reveal another employee.
            if (employeeId!=null && !employeeId.equals(user.employeeId())) throw ProbationException.forbidden();
        } else user.requireOffice();
        if (employeeId!=null) filter=filter.and((r,q,c) -> c.equal(r.get("employeeId"),employeeId));
        if (status!=null) filter=filter.and((r,q,c) -> c.equal(r.get("status"),status));
        if (search!=null && !search.isBlank()) {
            String term="%"+search.toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
            filter=filter.and((r,q,c) -> c.or(c.like(c.lower(r.get("employeeName")),term,'\\'),c.like(c.lower(r.get("managerName")),term,'\\')));
        }
        var result=assessments.findAll(filter,PageRequest.of(page,size,Sort.by(Sort.Order.desc("createdAt"),Sort.Order.desc("id"))));
        return outcomes ? page(result,mapper::outcome) : page(result,mapper::summary);
    }

    @Override @Transactional public AssessmentView send(Long id, VersionRequest request) {
        CurrentUser.get().requireRole("HR");
        var a=load(id); WorkflowRules.require(a,DRAFT); version(a,request.version());
        directory.employee(a.getEmployeeId()); assign(a,a.getReportingManagerUserId());
        a.setStatus(PENDING_MANAGER_EVALUATION);
        return changed(a,DRAFT,"SENT_FOR_EVALUATION",null);
    }

    @Override @Transactional public AssessmentView evaluate(Long id, EvaluationRequest request) {
        var a=load(id); requireManager(a); version(a,request.version());
        WorkflowRules.require(a,PENDING_MANAGER_EVALUATION,MANAGER_EVALUATION_IN_PROGRESS,RETURNED_TO_MANAGER);
        var previous=a.getStatus();
        var submitted=new HashMap<String,RatingInput>();
        for (var input:request.ratings()) {
            if (submitted.put(input.criterionCode(),input)!=null) throw ProbationException.badRequest("Duplicate criterion code");
            if (input.score()!=null && (input.score()<1 || input.score()>5)) throw ProbationException.badRequest("Scores must be between 1 and 5");
        }
        var known=a.getRatings().stream().map(AssessmentRating::getCriterionCode).collect(java.util.stream.Collectors.toSet());
        if (!known.containsAll(submitted.keySet())) throw ProbationException.badRequest("Unknown criterion code");
        var now=OffsetDateTime.now(ZoneOffset.UTC);
        // PUT replaces the current draft. Omitted criteria become unscored; snapshots never change.
        for (var rating:a.getRatings()) {
            var input=submitted.get(rating.getCriterionCode());
            rating.setScore(input==null?null:input.score()); rating.setComments(input==null?null:trim(input.comments())); rating.setUpdatedAt(now);
        }
        a.setStrengths(trim(request.strengths())); a.setAreasForImprovement(trim(request.areasForImprovement()));
        a.setDevelopmentRecommendations(trim(request.developmentRecommendations())); a.setRecommendation(request.recommendation());
        a.setOverallScore(Criteria.average(a.getRatings())); a.setStatus(MANAGER_EVALUATION_IN_PROGRESS);
        return changed(a,previous,"EVALUATION_SAVED",null);
    }

    @Override @Transactional public AssessmentView submit(Long id, VersionRequest request) {
        var a=load(id); requireManager(a); version(a,request.version());
        WorkflowRules.require(a,MANAGER_EVALUATION_IN_PROGRESS,RETURNED_TO_MANAGER);
        WorkflowRules.complete(a);
        var previous=a.getStatus(); a.setOverallScore(Criteria.average(a.getRatings())); a.setStatus(PENDING_HR_REVIEW);
        return changed(a,previous,"EVALUATION_SUBMITTED",null);
    }

    @Override @Transactional public AssessmentView returnToManager(Long id, ReviewRequest request) {
        CurrentUser.get().requireRole("HR"); var a=load(id);
        version(a,request.version()); WorkflowRules.require(a,PENDING_HR_REVIEW);
        requireRemarks(request.remarks()); a.setHrReviewRemarks(trim(request.remarks())); a.setStatus(RETURNED_TO_MANAGER);
        return changed(a,PENDING_HR_REVIEW,"RETURNED_TO_MANAGER",request.remarks());
    }

    @Override @Transactional public AssessmentView forward(Long id, ReviewRequest request) {
        CurrentUser.get().requireRole("HR"); var a=load(id);
        version(a,request.version()); WorkflowRules.require(a,PENDING_HR_REVIEW); WorkflowRules.complete(a);
        requireRemarks(request.remarks()); a.setHrReviewRemarks(trim(request.remarks())); a.setStatus(PENDING_ADMIN_APPROVAL);
        return changed(a,PENDING_HR_REVIEW,"FORWARDED_FOR_APPROVAL",request.remarks());
    }

    @Override @Transactional public AssessmentView decide(Long id, DecisionRequest request) {
        var user=CurrentUser.get(); user.requireRole("ADMIN"); var a=load(id);
        if (a.getReportingManagerUserId().equals(user.userId())) throw ProbationException.forbidden();
        version(a,request.version()); WorkflowRules.require(a,PENDING_ADMIN_APPROVAL); WorkflowRules.complete(a);
        WorkflowRules.decision(a,request);
        a.setStatus(AssessmentStatus.valueOf(request.decision().name())); a.setFinalDecision(request.decision());
        a.setDecisionRemarks(trim(request.remarks())); a.setPublishedComments(trim(request.publishedComments()));
        a.setRevisedEndDate(request.revisedEndDate()); a.setDecidedBy(user.userId());
        var now=OffsetDateTime.now(ZoneOffset.UTC); a.setDecisionDate(now); a.setPublishedAt(now);
        return changed(a,PENDING_ADMIN_APPROVAL,"DECISION_PUBLISHED",request.remarks());
    }

    @Override @Transactional public AssessmentView reassign(Long id, ReassignRequest request) {
        CurrentUser.get().requireOffice(); var a=load(id); version(a,request.version());
        WorkflowRules.require(a,DRAFT,PENDING_MANAGER_EVALUATION,MANAGER_EVALUATION_IN_PROGRESS,RETURNED_TO_MANAGER);
        if (a.getReportingManagerUserId().equals(request.reportingManagerUserId())) throw ProbationException.badRequest("Choose a different reporting manager");
        requireRemarks(request.remarks()); var previous=a.getStatus();
        // Preserve the former reviewer's evidence before starting a separate assignment draft.
        audit(a,previous,"ASSIGNMENT_ARCHIVED",request.remarks());
        assign(a,request.reportingManagerUserId());
        for (var rating:a.getRatings()) { rating.setScore(null); rating.setComments(null); rating.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC)); }
        a.setStrengths(null); a.setAreasForImprovement(null); a.setDevelopmentRecommendations(null); a.setRecommendation(null); a.setOverallScore(null); a.setHrReviewRemarks(null);
        if (previous!=DRAFT) a.setStatus(PENDING_MANAGER_EVALUATION);
        return changed(a,previous,"REASSIGNED",request.remarks());
    }

    @Override public Statistics statistics() {
        CurrentUser.get().requireOffice();
        long active=count(DRAFT,PENDING_MANAGER_EVALUATION,MANAGER_EVALUATION_IN_PROGRESS,PENDING_HR_REVIEW,RETURNED_TO_MANAGER,PENDING_ADMIN_APPROVAL);
        long pendingManager=count(PENDING_MANAGER_EVALUATION,MANAGER_EVALUATION_IN_PROGRESS,RETURNED_TO_MANAGER);
        long pendingHr=count(PENDING_HR_REVIEW);
        long pendingAdmin=count(PENDING_ADMIN_APPROVAL);
        Specification<Assessment> completed=(r,q,c) -> r.get("status").in(CONFIRMED,EXTENDED,NOT_CONFIRMED);
        var recent=assessments.findAll(completed,PageRequest.of(0,5,Sort.by(Sort.Order.desc("publishedAt"),Sort.Order.desc("id"))));
        return new Statistics(active,pendingManager,pendingHr,pendingAdmin,assessments.count(completed),recent.map(mapper::summary).getContent());
    }
    private long count(AssessmentStatus... statuses) {
        return assessments.count((r,q,c) -> r.get("status").in((Object[])statuses));
    }
    @Override public Capabilities capabilities() {
        var user=CurrentUser.get();
        if (!user.role().equals("EMPLOYEE") || user.employeeId()==null) return new Capabilities(false);
        return new Capabilities(assessments.exists((r,q,c) -> c.and(c.equal(r.get("reportingManagerUserId"),user.userId()),
            c.equal(r.get("managerEmployeeId"),user.employeeId()),c.notEqual(r.get("status"),DRAFT))));
    }
    private Assessment load(Long id) { return assessments.findById(id).orElseThrow(() -> new ProbationException(HttpStatus.NOT_FOUND,"Assessment not found")); }
    private void version(Assessment a, Long expected) {
        if (expected==null || !expected.equals(a.getVersion())) throw ProbationException.conflict("This assessment changed. Reload it before trying again");
    }
    private void requireManager(Assessment a) {
        var user=CurrentUser.get();
        if (!user.role().equals("EMPLOYEE") || !a.getReportingManagerUserId().equals(user.userId())
            || !Objects.equals(user.employeeId(),a.getManagerEmployeeId()) || Objects.equals(user.employeeId(),a.getEmployeeId())) throw ProbationException.forbidden();
    }
    private AssessmentView changed(Assessment a, AssessmentStatus previous,String action,String remarks) {
        a.setUpdatedBy(CurrentUser.get().userId()); a.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        assessments.saveAndFlush(a); audit(a,previous,action,remarks); return detail(a);
    }
    private void audit(Assessment a, AssessmentStatus previous,String action,String remarks) {
        var h=new AssessmentHistory(); h.setAssessmentId(a.getId()); h.setAction(action); h.setPreviousStatus(previous==null?null:previous.name());
        h.setNewStatus(a.getStatus().name()); h.setPerformedBy(CurrentUser.get().userId()); h.setPerformedAt(OffsetDateTime.now(ZoneOffset.UTC));
        h.setRemarks(trim(remarks)); h.setEvidenceSnapshot(json.writeValueAsString(mapper.evidence(a))); history.saveAndFlush(h);
    }
    private AssessmentView detail(Assessment a) { return mapper.detail(a,history.findByAssessmentIdOrderByIdAsc(a.getId()),CurrentUser.get()); }
    private static String trim(String s) { return s==null?null:s.trim(); }
    private static void requireRemarks(String remarks) { if (WorkflowRules.blank(remarks)) throw ProbationException.badRequest("Review remarks are required"); }
    private static <T> PageResult<T> page(Page<Assessment> p,Function<Assessment,T> convert) {
        return new PageResult<>(p.map(convert).getContent(),p.getTotalElements(),p.getTotalPages(),p.getNumber(),p.getSize());
    }
}
