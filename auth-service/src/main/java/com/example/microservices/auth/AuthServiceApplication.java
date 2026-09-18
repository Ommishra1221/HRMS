package com.example.microservices.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * auth-service = the security guard of the HRMS.
 *
 * It owns ONE job: prove who you are (login) and hand you a signed JWT that
 * says which of the three roles you hold (ADMIN / HR / EMPLOYEE).
 *
 * There is NO public signup: the only public endpoint is POST /auth/login.
 * Accounts are created by an ADMIN via /auth/users.
 *
 * Same registration pattern as employee/leave/attendance/payroll:
 * a Eureka client, discoverable by name "auth-service" on port 8085.
 *
 * NOTE: no @EnableFeignClients here - auth talks to nobody. Every other
 * service stays exactly as it was; JWT checking (when we add it there)
 * will be done at the gateway with a shared secret, not a Feign call.
 */
@SpringBootApplication
// Registers this service with Eureka under spring.application.name
// (auth-service) so the gateway can find it with lb://auth-service.
@EnableDiscoveryClient
public class AuthServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(AuthServiceApplication.class, args);
	}

}
