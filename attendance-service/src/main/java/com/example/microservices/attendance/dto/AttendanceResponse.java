package com.example.microservices.attendance.dto;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * AttendanceResponse = the attendance JSON we send back.
 *
 * The "employee" field is the microservices part: AttendanceService fills it
 * by CALLING employee-service over HTTP at request time. The data is not
 * duplicated in attendance_db - it is composed live from two services.
 */
public class AttendanceResponse {

    private Long id;

    private Long employeeId;

    private LocalDate attendanceDate;

    private String status;

    private LocalTime checkIn;

    private LocalTime checkOut;

    // Filled by AttendanceService via the Feign call
    private EmployeeResponse employee;

    public AttendanceResponse() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public EmployeeResponse getEmployee() {
        return employee;
    }

    public void setEmployee(EmployeeResponse employee) {
        this.employee = employee;
    }
}