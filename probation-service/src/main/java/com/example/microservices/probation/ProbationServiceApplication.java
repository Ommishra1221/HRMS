package com.example.microservices.probation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class ProbationServiceApplication {
    public static void main(String[] args) { SpringApplication.run(ProbationServiceApplication.class, args); }
}
