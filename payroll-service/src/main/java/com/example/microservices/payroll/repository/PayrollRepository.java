package com.example.microservices.payroll.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.microservices.payroll.entity.Payroll;

@Repository
public interface PayrollRepository extends JpaRepository<Payroll, Long> {

    // Derived queries: Spring Data JPA generates the SQL from the method NAME.

    // All payslips of one employee, newest month first.
    List<Payroll> findByEmployeeIdOrderByMonthDesc(Long employeeId);

    // Guards against duplicates: one payslip per employee per month.
    Optional<Payroll> findByEmployeeIdAndMonth(Long employeeId, String month);

    // The dashboard stat: how many payslips are still waiting to be paid.
    List<Payroll> findByStatus(String status);
}
