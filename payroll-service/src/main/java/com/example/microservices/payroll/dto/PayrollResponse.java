package com.example.microservices.payroll.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * PayrollResponse = the payroll JSON we send back.
 *
 * The "employee" field is the microservices part: PayrollService fills it by
 * CALLING employee-service over HTTP at request time. The data is not
 * duplicated in payroll_db - it is composed live from two services.
 */
public class PayrollResponse {

    private Long id;

    private Long employeeId;

    private String month; // yyyy-MM

    private BigDecimal basicSalary;

    private BigDecimal allowances;

    private BigDecimal deductions;

    // Computed in the service: basicSalary + allowances - deductions
    private BigDecimal netSalary;

    private String status; // PENDING, PAID

    private LocalDate paymentDate;

    // Filled by PayrollService via the Feign call
    private EmployeeResponse employee;

    public PayrollResponse() {
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

    public String getMonth() {
        return month;
    }

    public void setMonth(String month) {
        this.month = month;
    }

    public BigDecimal getBasicSalary() {
        return basicSalary;
    }

    public void setBasicSalary(BigDecimal basicSalary) {
        this.basicSalary = basicSalary;
    }

    public BigDecimal getAllowances() {
        return allowances;
    }

    public void setAllowances(BigDecimal allowances) {
        this.allowances = allowances;
    }

    public BigDecimal getDeductions() {
        return deductions;
    }

    public void setDeductions(BigDecimal deductions) {
        this.deductions = deductions;
    }

    public BigDecimal getNetSalary() {
        return netSalary;
    }

    public void setNetSalary(BigDecimal netSalary) {
        this.netSalary = netSalary;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDate getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(LocalDate paymentDate) {
        this.paymentDate = paymentDate;
    }

    public EmployeeResponse getEmployee() {
        return employee;
    }

    public void setEmployee(EmployeeResponse employee) {
        this.employee = employee;
    }
}
