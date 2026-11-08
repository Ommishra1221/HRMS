package com.example.microservices.auth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties={
    "spring.datasource.url=jdbc:postgresql://127.0.0.1:55436/probation_test",
    "spring.datasource.username=probation_test", "spring.datasource.password=",
    "spring.jpa.properties.hibernate.default_schema=auth_verification",
    "eureka.client.enabled=false", "spring.cloud.discovery.enabled=false"})
@AutoConfigureMockMvc
class ProbationReviewerSecurityTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Value("${app.jwt.secret}") String secret;
    String token(String role) {
        return Jwts.builder().subject("admin").claim("userId",1).claim("roles",List.of("ROLE_"+role))
            .expiration(Date.from(Instant.now().plusSeconds(600)))
            .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
    }
    @Test void hrCanSelectEligibleReviewersWithoutGainingUserManagementAccess() throws Exception {
        var suffix=Long.toString(System.nanoTime());
        var body=Map.of("username","reviewer"+suffix,"email",suffix+"@example.invalid","password","IsolatedTest123","role","EMPLOYEE","employeeId",Long.parseLong(suffix),"fullName","Reviewer Test");
        var created=mvc.perform(post("/auth/users").header("Authorization","Bearer "+token("ADMIN")).contentType("application/json").content(json.writeValueAsString(body)))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id=json.readTree(created).path("id").asLong();
        var reviewer=mvc.perform(get("/auth/probation-reviewers/"+id).header("Authorization","Bearer "+token("HR")))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertFalse(reviewer.contains("password")); assertFalse(reviewer.contains("email")); assertFalse(reviewer.contains("roles"));
        mvc.perform(get("/auth/probation-reviewers?search=reviewer"+suffix).header("Authorization","Bearer "+token("HR")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/auth/users").header("Authorization","Bearer "+token("HR"))).andExpect(status().isForbidden());
        mvc.perform(get("/auth/probation-reviewers?size=101").header("Authorization","Bearer "+token("HR"))).andExpect(status().isBadRequest());
        mvc.perform(post("/auth/users").header("Authorization","Bearer "+token("HR")).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isForbidden());
        mvc.perform(get("/auth/probation-reviewers").header("Authorization","Bearer "+token("EMPLOYEE"))).andExpect(status().isForbidden());
        mvc.perform(patch("/auth/users/"+id+"/status").header("Authorization","Bearer "+token("ADMIN")).contentType("application/json").content("{\"enabled\":false}"))
            .andExpect(status().isOk());
        mvc.perform(get("/auth/probation-reviewers/"+id).header("Authorization","Bearer "+token("HR"))).andExpect(status().isNotFound());
    }
}
