package com.example.microservices.leave.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.microservices.leave.entity.Leave;

/**
 * Same idea as EmployeeRepository: Spring Data JPA generates the SQL for us.
 * We get save(), findById(), findAll(), deleteById() for free.
 */
public interface LeaveRepository extends JpaRepository<Leave, Long> {

    // Used by the EMPLOYEE ownership rule: an employee's "list all leaves"
    // is scoped to their own rows (employeeId comes from the JWT, not the
    // request). Spring Data derives the SQL from the method name.
    List<Leave> findByEmployeeId(Long employeeId);
}
