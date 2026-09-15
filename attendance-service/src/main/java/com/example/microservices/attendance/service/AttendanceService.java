package com.example.microservices.attendance.service;

import java.time.LocalTime;
import java.util.List;

import com.example.microservices.attendance.dto.AttendanceRequest;
import com.example.microservices.attendance.dto.AttendanceResponse;

/**
 * Business contract of attendance-service. Implementation: AttendanceServiceImpl.
 */
public interface AttendanceService {

    AttendanceResponse createAttendance(AttendanceRequest request);

    List<AttendanceResponse> getAllAttendance();

    AttendanceResponse getAttendanceById(Long id);

    List<AttendanceResponse> getAttendanceByEmployee(Long employeeId);

    AttendanceResponse updateAttendance(Long id, AttendanceRequest request);

    AttendanceResponse markCheckOut(Long id, LocalTime checkOut);

    void deleteAttendance(Long id);
}
