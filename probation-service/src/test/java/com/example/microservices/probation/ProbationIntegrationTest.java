package com.example.microservices.probation;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import com.example.microservices.probation.client.*;
import com.example.microservices.probation.domain.Criteria;
import com.example.microservices.probation.dto.ProbationDtos.*;
import tools.jackson.databind.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProbationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean EmployeeClient employees;
    @MockitoBean ReviewerClient reviewers;
    static final String SECRET="probation-test-secret-which-is-only-for-isolated-automated-tests-1234567890";
    long employeeId;
    @BeforeEach void setup() {
        employeeId=ThreadLocalRandom.current().nextLong(1_000_000_000L,9_000_000_000_000L);
        when(employees.get(anyLong())).thenAnswer(i -> new EmployeeSummary(i.getArgument(0),"Employee "+i.getArgument(0),"test@example.invalid","Engineering"));
        when(reviewers.get(anyLong())).thenAnswer(i -> new Reviewer(i.getArgument(0),"manager"+i.getArgument(0),"Reporting manager", ((Long)i.getArgument(0))+10000));
    }
    String token(String role,long userId,Long employee) {
        var b=Jwts.builder().subject("test-"+userId).claim("userId",userId).claim("roles",List.of("ROLE_"+role))
            .issuedAt(new Date()).expiration(Date.from(Instant.now().plusSeconds(3600)));
        if(employee!=null) b.claim("employeeId",employee);
        return b.signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }
    String hr() { return token("HR",10,null); }
    String admin() { return token("ADMIN",1,null); }
    String manager() { return token("EMPLOYEE",20,10020L); }
    String subject() { return token("EMPLOYEE",30,employeeId); }
    MockHttpServletRequestBuilder request(MockHttpServletRequestBuilder req,String bearer,Object body) {
        req.header("Authorization","Bearer "+bearer).contentType("application/json");
        if(body!=null) req.content(json.writeValueAsString(body)); return req;
    }
    JsonNode perform(MockHttpServletRequestBuilder req,String bearer,Object body,int status) throws Exception {
        var result=mvc.perform(request(req,bearer,body)).andExpect(status().is(status)).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    Map<String,Object> creation() {
        return new HashMap<>(Map.of("employeeId",employeeId,"probationStartDate","2026-01-01","probationEndDate","2026-06-30","reviewDueDate","2026-06-15","reportingManagerUserId",20,"initialRemarks","Private HR preparation"));
    }
    JsonNode create() throws Exception { return perform(post("/probation/assessments"),hr(),creation(),201); }
    long id(JsonNode a) { return a.path("assessment").path("id").asLong(); }
    long version(JsonNode a) { return a.path("assessment").path("version").asLong(); }
    JsonNode action(JsonNode a,String path,String bearer,Object extras,int expected) throws Exception {
        var body=new HashMap<String,Object>(); body.put("version",version(a));
        if(extras instanceof Map<?,?> map) map.forEach((k,v)->body.put(k.toString(),v));
        return perform(post("/probation/assessments/"+id(a)+"/"+path),bearer,body,expected);
    }
    JsonNode evaluate(JsonNode a) throws Exception {
        var ratings=Criteria.ALL.stream().map(c -> Map.of("criterionCode",c.code(),"score",4,"comments","Observed work evidence")).toList();
        return perform(put("/probation/assessments/"+id(a)+"/evaluation"),manager(),Map.of("version",version(a),"ratings",ratings,"strengths","Reliable delivery","areasForImprovement","Planning","developmentRecommendations","Mentoring","recommendation","CONFIRMED","overallScore",1),200);
    }
    JsonNode forwarded() throws Exception {
        var a=create(); a=action(a,"send-for-evaluation",hr(),null,200); a=evaluate(a);
        a=action(a,"submit-evaluation",manager(),null,200);
        return action(a,"forward-for-approval",hr(),Map.of("remarks","Private HR deliberation"),200);
    }
    @Test void completeLifecycleRedactsEmployeeDataAndBlocksUnassignedUsers() throws Exception {
        var a=create(); long assessmentId=id(a);
        perform(get("/probation/assessments/"+assessmentId),manager(),null,403);
        a=action(a,"send-for-evaluation",hr(),null,200);
        perform(get("/probation/assessments/"+assessmentId),token("EMPLOYEE",40,999L),null,403);
        action(a,"decision",hr(),Map.of("decision","CONFIRMED"),403);
        a=evaluate(a); assertEquals(4.0,a.path("assessment").path("overallScore").asDouble());
        var employee=perform(get("/probation/assessments/"+assessmentId),subject(),null,200);
        assertFalse(employee.has("ratings")); assertFalse(employee.has("history")); assertFalse(employee.has("initialRemarks"));
        a=action(a,"submit-evaluation",manager(),null,200);
        a=action(a,"return-to-manager",hr(),Map.of("remarks","Add planning evidence"),200);
        assertEquals("RETURNED_TO_MANAGER",a.path("assessment").path("status").asText());
        a=evaluate(a); a=action(a,"submit-evaluation",manager(),null,200);
        a=action(a,"forward-for-approval",hr(),Map.of("remarks","Private HR deliberation"),200);
        var managerView=perform(get("/probation/assessments/"+assessmentId),manager(),null,200);
        assertFalse(managerView.toString().contains("Private HR deliberation"));
        var completed=action(a,"decision",admin(),Map.of("decision","CONFIRMED","remarks","Confidential rationale","publishedComments","Probation completed successfully"),200);
        var own=perform(get("/probation/me"),subject(),null,200);
        assertTrue(own.toString().contains("Probation completed successfully"));
        assertFalse(own.toString().contains("Confidential rationale")); assertFalse(own.toString().contains("Private HR"));
        assertFalse(own.toString().contains("ratings"));
        action(completed,"decision",admin(),Map.of("decision","CONFIRMED"),409);
        assertTrue(completed.path("history").size()>=9);
        perform(get("/probation/employees/"+employeeId+"/history"),token("EMPLOYEE",40,999L),null,403);
    }
    @Test void overlapAndInvalidDatesAreRejectedWithoutResettingData() throws Exception {
        create(); perform(post("/probation/assessments"),hr(),creation(),409);
        var invalid=creation(); invalid.put("employeeId",ThreadLocalRandom.current().nextLong(1_000_000_000L,9_000_000_000_000L)); invalid.put("reviewDueDate","2027-01-01");
        perform(post("/probation/assessments"),hr(),invalid,400);
    }
    @Test void missingBadAndIdentitylessTokensAreRejected() throws Exception {
        mvc.perform(get("/probation/me")).andExpect(status().isUnauthorized());
        perform(get("/probation/me"),"garbage",null,401);
        var missingId=Jwts.builder().subject("x").claim("roles",List.of("ROLE_ADMIN")).expiration(Date.from(Instant.now().plusSeconds(100)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        perform(get("/probation/assessments"),missingId,null,401);
    }
    @Test void staleVersionsAndBypassTransitionsAreRejected() throws Exception {
        var a=create(); action(a,"forward-for-approval",hr(),Map.of("remarks","Bypass"),409);
        var sent=action(a,"send-for-evaluation",hr(),null,200);
        action(a,"send-for-evaluation",hr(),null,409);
        action(sent,"submit-evaluation",manager(),null,409);
        perform(put("/probation/assessments/"+id(sent)+"/evaluation"),token("EMPLOYEE",40,999L),Map.of("version",version(sent),"ratings",List.of()),403);
        perform(put("/probation/assessments/"+id(sent)+"/evaluation"),token("EMPLOYEE",20,999L),Map.of("version",version(sent),"ratings",List.of()),403);
    }
    @Test void extensionCreatesSeparateLinkedCycleAndCannotChangeFinalRecord() throws Exception {
        var a=forwarded(); action(a,"decision",admin(),Map.of("decision","EXTENDED","revisedEndDate","2026-09-30"),400);
        a=action(a,"decision",admin(),Map.of("decision","EXTENDED","remarks","Allow development time","revisedEndDate","2026-09-30"),200);
        var follow=creation(); follow.put("previousAssessmentId",id(a)); follow.put("probationStartDate","2026-07-01"); follow.put("probationEndDate","2026-09-30"); follow.put("reviewDueDate","2026-09-15");
        perform(post("/probation/assessments"),hr(),follow,201);
        perform(post("/probation/assessments"),hr(),follow,409);
        var finalId=id(a);
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("update probation_schema.probation_assessments set decision_remarks='tamper' where id=?",finalId));
        assertThrows(org.springframework.dao.DataAccessException.class,()->jdbc.update("delete from probation_schema.probation_assessment_history where assessment_id=?",finalId));
    }
    @Test void twoConcurrentDecisionsCannotBothSucceed() throws Exception {
        var a=forwarded(); var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<Integer> call=()-> { start.await(); return mvc.perform(request(post("/probation/assessments/"+id(a)+"/decision"),admin(),Map.of("version",version(a),"decision","CONFIRMED"))).andReturn().getResponse().getStatus(); };
            var first=executor.submit(call); var second=executor.submit(call); start.countDown();
            var statuses=new ArrayList<>(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))); Collections.sort(statuses);
            assertEquals(List.of(200,409),statuses);
            assertEquals(1,jdbc.queryForObject("select count(*) from probation_schema.probation_assessment_history where assessment_id=? and action='DECISION_PUBLISHED'",Integer.class,id(a)));
        }
    }
    @Test void reassignmentArchivesOldEvidenceAndRevokesPreviousManager() throws Exception {
        var a=create(); a=action(a,"send-for-evaluation",hr(),null,200); a=evaluate(a);
        a=action(a,"reassign",hr(),Map.of("reportingManagerUserId",21,"remarks","Reporting line changed"),200);
        perform(get("/probation/assessments/"+id(a)),manager(),null,403);
        var next=perform(get("/probation/assessments/"+id(a)),token("EMPLOYEE",21,10021L),null,200);
        assertTrue(next.path("ratings").get(0).path("score").isNull());
        assertFalse(next.toString().contains("Observed work evidence"));
        assertTrue(a.toString().contains("Observed work evidence"));
    }
    @Test void downstreamFailuresAreSanitizedAndTransactionDoesNotWrite() throws Exception {
        var request=feign.Request.create(feign.Request.HttpMethod.GET,"http://internal/users",Map.of(),null,StandardCharsets.UTF_8,null);
        when(reviewers.get(20L)).thenThrow(new feign.FeignException.ServiceUnavailable("secret internal trace",request,"password-hash".getBytes(),Map.of()));
        var response=perform(post("/probation/assessments"),hr(),creation(),503);
        assertFalse(response.toString().contains("secret")); assertFalse(response.toString().contains("password"));
        assertEquals(0,jdbc.queryForObject("select count(*) from probation_schema.probation_assessments where employee_id=?",Integer.class,employeeId));
    }
    @Test void queuesStatisticsAndPaginationAreAuthorizedAndScoped() throws Exception {
        var a=create(); a=action(a,"send-for-evaluation",hr(),null,200);
        var assignments=perform(get("/probation/manager/assignments?size=1"),manager(),null,200);
        assertEquals(1,assignments.path("content").size());
        var empty=perform(get("/probation/manager/assignments"),token("EMPLOYEE",999,999L),null,200);
        assertEquals(0,empty.path("totalElements").asLong());
        var mine=perform(get("/probation/assessments?employeeId="+employeeId),subject(),null,200);
        assertEquals(1,mine.path("totalElements").asLong()); assertFalse(mine.toString().contains("managerName"));
        var stats=perform(get("/probation/statistics"),hr(),null,200); assertTrue(stats.path("active").asLong()>0);
        perform(get("/probation/statistics"),subject(),null,403);
        perform(get("/probation/assessments?size=101"),hr(),null,400);
        perform(get("/probation/assessments?status=INVALID"),hr(),null,400);
        var capabilities=perform(get("/probation/capabilities"),manager(),null,200); assertTrue(capabilities.path("hasAssignments").asBoolean());
        var wrongLink=perform(get("/probation/manager/assignments"),token("EMPLOYEE",20,999L),null,200);
        assertEquals(0,wrongLink.path("totalElements").asLong());
        assertFalse(perform(get("/probation/capabilities"),token("EMPLOYEE",20,999L),null,200).path("hasAssignments").asBoolean());
    }
    @Test void overlappingConcurrentCreationsCannotBothSucceed() throws Exception {
        var body=creation(); var start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<Integer> call=()-> { start.await(); return mvc.perform(request(post("/probation/assessments"),hr(),body)).andReturn().getResponse().getStatus(); };
            var one=executor.submit(call); var two=executor.submit(call); start.countDown();
            var statuses=new ArrayList<>(List.of(one.get(20,TimeUnit.SECONDS),two.get(20,TimeUnit.SECONDS))); Collections.sort(statuses);
            assertEquals(List.of(201,409),statuses);
        }
    }
    @Test void nonConfirmationIsRecordedWithoutChangingExternalEmployeeRecords() throws Exception {
        var a=forwarded();
        action(a,"decision",admin(),Map.of("decision","NOT_CONFIRMED","remarks","Evidence-based decision","publishedComments","Your review has concluded."),200);
        var mine=perform(get("/probation/me"),subject(),null,200);
        assertTrue(mine.toString().contains("NOT_CONFIRMED")); assertFalse(mine.toString().contains("Evidence-based decision"));
        verify(employees,never()).list(); // This module performs validation reads; it has no employee mutation client.
    }
}
