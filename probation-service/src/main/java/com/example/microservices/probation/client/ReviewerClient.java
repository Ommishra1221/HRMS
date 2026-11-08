package com.example.microservices.probation.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import com.example.microservices.probation.dto.ProbationDtos.*;

@FeignClient(name="auth-service")
public interface ReviewerClient {
    @GetMapping("/auth/probation-reviewers/{id}") Reviewer get(@PathVariable("id") Long id);
    @GetMapping("/auth/probation-reviewers") PageResult<Reviewer> list(@RequestParam("page") int page, @RequestParam("size") int size, @RequestParam("search") String search);
}
