package com.example.microservices.leave.service;

import java.util.List;

import com.example.microservices.leave.dto.LeaveRequest;
import com.example.microservices.leave.dto.LeaveResponse;

/**
 * Business contract of leave-service. Implementation: LeaveServiceImpl.
 */
public interface LeaveService {

    LeaveResponse createLeave(LeaveRequest request);

    List<LeaveResponse> getAllLeaves();

    LeaveResponse getLeaveById(Long id);

    LeaveResponse updateLeave(Long id, LeaveRequest request);

    void deleteLeave(Long id);
}
