package com.example.microservices.leave.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import com.example.microservices.leave.dto.EmployeeResponse;

/**
 * ============================================================
 *  THE MICROSERVICE COMMUNICATION PIECE - read this carefully
 * ============================================================
 *
 * WHAT is this?
 * An OpenFeign client: just an INTERFACE. You never write an implementation.
 * At startup, Spring Cloud OpenFeign reads the annotations and generates a
 * class that does real HTTP calls - like an "HttpClient you declare, not code".
 *
 * HOW does it find employee-service NOW THAT EUREKA EXISTS?
 * Old way: url = "http://localhost:8081" (hard-coded location).
 * New way: name = "employee-service" ONLY. At call time:
 *
 *   1. employeeClient.getEmployeeById(7) triggers the generated proxy
 *   2. proxy asks Eureka: "live instances of 'employee-service'?"
 *      -> e.g. [192.168.1.5:8081]  (or SEVERAL instances if scaled!)
 *   3. Spring Cloud LoadBalancer picks one instance
 *   4. request goes to: GET http://<chosen-instance>/employees/7
 *   5. JSON response is deserialized into our EmployeeResponse DTO
 *
 * WHY is this better?
 * - employee-service can move/restart/scale - no config changes anywhere
 * - multiple instances = automatic load balancing, for free
 *
 * The name must equal the TARGET service's spring.application.name.
 */
@FeignClient(name = "employee-service")
public interface EmployeeClient {

    // This maps to GET http://localhost:8081/employees/{id}
    @GetMapping("/employees/{id}")
    EmployeeResponse getEmployeeById(@PathVariable("id") Long id);
}
