package com.example.microservices.employee.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.microservices.employee.entity.Employee;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {

}