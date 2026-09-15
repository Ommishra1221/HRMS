package com.example.microservices.attendance.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * AttendanceRequest = the JSON a client sends when creating/updating an
 * attendance record.
 *
 * The client must give us an existing employeeId. We will VERIFY that the
 * employee really exists by calling employee-service over HTTP (Feign).
 */
public class AttendanceRequest {

    @NotNull(message = "employeeId is required")
    private Long employeeId;

    @NotNull(message = "attendanceDate is required")
    private LocalDate attendanceDate;

    @NotBlank(message = "status is required")
    private String status;

    private LocalTime checkIn;

    private LocalTime checkOut;

    public AttendanceRequest() {
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public LocalDate getAttendanceDate() {
        return attendanceDate;
    }

    public void setAttendanceDate(LocalDate attendanceDate) {
        this.attendanceDate = attendanceDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalTime getCheckIn() {
        return checkIn;
    }

    public void setCheckIn(LocalTime checkIn) {
        this.checkIn = checkIn;
    }

    public LocalTime getCheckOut() {
        return checkOut;
    }

    public void setCheckOut(LocalTime checkOut) {
        this.checkOut = checkOut;
    }
}