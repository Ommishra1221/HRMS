package com.example.microservices.leave.service;

import java.util.List;

import com.example.microservices.leave.dto.LeaveRequest;
import com.example.microservices.leave.dto.LeaveResponse;

/**
 * Business contract of leave-service. Implementation: LeaveServiceImpl.
 *
 * Same shape as before authorization was added - the role gates live on the
 * controller/SecurityConfig and the ownership + PENDING rules inside the
 * impl, so the contract the frontend already uses is unchanged.
 */
public interface LeaveService {

    LeaveResponse createLeave(LeaveRequest request);

    List<LeaveResponse> getAllLeaves();

    LeaveResponse getLeaveById(Long id);

    LeaveResponse updateLeave(Long id, LeaveRequest request);

    void deleteLeave(Long id);
}
