package com.example.microservices.probation.client;

import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import com.example.microservices.probation.dto.ProbationDtos.EmployeeSummary;

@FeignClient(name="employee-service")
public interface EmployeeClient {
    @GetMapping("/employees/{id}") EmployeeSummary get(@PathVariable("id") Long id);
    @GetMapping("/employees") List<EmployeeSummary> list();
}
