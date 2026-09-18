package com.example.microservices.payroll.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * PayrollRequest = the JSON a client sends when creating/updating a payroll
 * record.
 *
 * The client must give us an existing employeeId. We will VERIFY that the
 * employee really exists by calling employee-service over HTTP (Feign).
 */
public class PayrollRequest {

    @NotNull(message = "employeeId is required")
    private Long employeeId;

    @NotBlank(message = "month is required")
    private String month; // format: yyyy-MM, e.g. "2026-09"

    @NotNull(message = "basicSalary is required")
    @PositiveOrZero(message = "basicSalary must be zero or positive")
    private BigDecimal basicSalary;

    @NotNull(message = "allowances is required")
    @PositiveOrZero(message = "allowances must be zero or positive")
    private BigDecimal allowances;

    @NotNull(message = "deductions is required")
    @PositiveOrZero(message = "deductions must be zero or positive")
    private BigDecimal deductions;

    private LocalDate paymentDate;

    public PayrollRequest() {
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

    public LocalDate getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(LocalDate paymentDate) {
        this.paymentDate = paymentDate;
    }
}
