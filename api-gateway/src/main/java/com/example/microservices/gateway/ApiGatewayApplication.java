package com.example.microservices.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * The API Gateway is a REAL Spring Boot application, just with a different job:
 *
 * - employee-service / leave-service: contain business logic (JPA, Feign...)
 * - api-gateway: contains NO business logic. Its only job is to sit in front
 *   of the services, receive every frontend request, and FORWARD it to the
 *   right service based on routing rules in application.properties.
 *
 * The frontend (React) will ONLY ever know this single address:
 *     http://localhost:8080
 *
 * It never learns that employee-service lives on 8081 or leave-service on 8082.
 * That is the "single entry point" pattern.
 */
@SpringBootApplication
public class ApiGatewayApplication {

	public static void main(String[] args) {
		SpringApplication.run(ApiGatewayApplication.class, args);
	}

}
