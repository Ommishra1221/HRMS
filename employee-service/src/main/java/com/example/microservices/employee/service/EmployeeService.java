package com.example.microservices.employee.service;

import java.util.List;

import com.example.microservices.employee.dto.EmployeeRequest;
import com.example.microservices.employee.dto.EmployeeResponse;

/**
 * The interface is a "contract": the controller knows WHAT it can ask for,
 * without knowing HOW it is done. The implementation lives in ServiceImpl.
 * (This interface/impl split is a very common professional pattern.)
 */
public interface EmployeeService {

    EmployeeResponse createEmployee(EmployeeRequest request);

    List<EmployeeResponse> getAllEmployees();

    EmployeeResponse getEmployeeById(Long id);

    EmployeeResponse updateEmployee(Long id, EmployeeRequest request);

    void deleteEmployee(Long id);
}
