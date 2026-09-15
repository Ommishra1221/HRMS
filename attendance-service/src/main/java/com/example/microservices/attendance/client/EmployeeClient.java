package com.example.microservices.attendance.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import com.example.microservices.attendance.dto.EmployeeResponse;

/**
 * The microservice communication piece of attendance-service.
 *
 * An OpenFeign client: just an INTERFACE. At startup, Spring Cloud OpenFeign
 * reads the annotations and generates a proxy class that performs real HTTP
 * calls. The name must equal the TARGET service's spring.application.name.
 *
 * At call time:
 *   1. proxy asks Eureka: "live instances of 'employee-service'?"
 *   2. Spring Cloud LoadBalancer picks one instance
 *   3. request goes to: GET http://<chosen-instance>/employees/{id}
 *   4. JSON response is deserialized into our EmployeeResponse DTO
 *
 * The name must equal the TARGET service's spring.application.name.
 */
@FeignClient(name = "employee-service")
public interface EmployeeClient {

    // This maps to GET http://localhost:8081/employees/{id}
    @GetMapping("/employees/{id}")
    EmployeeResponse getEmployeeById(@PathVariable("id") Long id);
}
