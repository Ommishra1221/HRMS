package com.example.microservices.leave;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
// Without this line, Spring ignores @FeignClient interfaces completely.
// With it, Spring scans this package (and sub-packages) for @FeignClient
// interfaces and builds the HTTP-proxy beans for them.
@EnableFeignClients
public class LeaveServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(LeaveServiceApplication.class, args);
	}

}
