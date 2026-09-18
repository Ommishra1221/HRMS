package com.example.microservices.payroll.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.example.microservices.payroll.dto.PayrollRequest;
import com.example.microservices.payroll.dto.PayrollResponse;

/**
 * Business contract of payroll-service. Implementation: PayrollServiceImpl.
 */
public interface PayrollService {

    PayrollResponse createPayroll(PayrollRequest request);

    List<PayrollResponse> getAllPayrolls();

    PayrollResponse getPayrollById(Long id);

    List<PayrollResponse> getPayrollsByEmployee(Long employeeId);

    PayrollResponse updatePayroll(Long id, PayrollRequest request);

    PayrollResponse markPaid(Long id, LocalDate paymentDate);

    void deletePayroll(Long id);
}
