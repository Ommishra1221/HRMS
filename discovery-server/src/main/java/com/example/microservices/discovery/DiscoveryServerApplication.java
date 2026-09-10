package com.example.microservices.discovery;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

/**
 * The Eureka Server = the SERVICE REGISTRY ("phone book") of our system.
 *
 * HOW IT WORKS:
 * 1. Every service (employee, leave, gateway) starts up and REGISTERs itself:
 *        "Hello, I am 'employee-service' at 192.168.x.x:8081"
 * 2. Each client then sends a heartbeat every ~30 seconds.
 *    No heartbeat for ~90 seconds -> Eureka drops the entry.
 * 3. Callers ask Eureka "where is employee-service?" and get the CURRENT
 *    list of live instances - no hard-coded URLs anywhere.
 *
 * BEFORE / AFTER in our project:
 *   Before: leave-service had  employee.service.url=http://localhost:8081
 *           api-gateway had    uri=http://localhost:8081
 *           -> move the service, restart every caller.
 *   After:  both just use the NAME 'employee-service' and ask this registry.
 *
 * This dashboard (http://localhost:8761) shows every live instance live.
 */
@SpringBootApplication
// Switches on the registry endpoints (/eureka/apps, dashboard, heartbeats).
@EnableEurekaServer
public class DiscoveryServerApplication {

	public static void main(String[] args) {
		SpringApplication.run(DiscoveryServerApplication.class, args);
	}

}
