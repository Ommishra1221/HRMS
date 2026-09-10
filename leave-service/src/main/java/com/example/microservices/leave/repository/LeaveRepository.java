package com.example.microservices.leave.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.microservices.leave.entity.Leave;

/**
 * Same idea as EmployeeRepository: Spring Data JPA generates the SQL for us.
 * We get save(), findById(), findAll(), deleteById() for free.
 */
public interface LeaveRepository extends JpaRepository<Leave, Long> {

    // Spring Data can also derive queries from method names if we need them,
    // e.g. "give me all leaves of one employee":
    // List<Leave> findByEmployeeId(Long employeeId);
}
