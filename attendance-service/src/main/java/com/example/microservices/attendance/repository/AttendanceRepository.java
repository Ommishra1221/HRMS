package com.example.microservices.attendance.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.microservices.attendance.entity.Attendance;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long> {

    // Derived queries: Spring Data JPA generates the SQL from the method NAME.

    // All records of one employee, newest first.
    List<Attendance> findByEmployeeIdOrderByAttendanceDateDesc(Long employeeId);

    // Guards against duplicates: one record per employee per day.
    Optional<Attendance> findByEmployeeIdAndAttendanceDate(Long employeeId, LocalDate attendanceDate);
}
