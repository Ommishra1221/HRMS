package com.example.microservices.payroll.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when an authenticated caller is not allowed to touch the resource -
 * the ownership half of the authorization model (the role half is
 * @PreAuthorize / SecurityConfig).
 *
 * Case in this service: an EMPLOYEE asks for a payslip whose employee_id is
 * not the employeeId in their JWT -> 403. (Writes - including mark-PAID -
 * are already gated to ADMIN by the URL rules, so ownership only ever
 * decides reads.)
 *
 * The employeeId used in the comparison comes from CurrentUser (the JWT),
 * NEVER from the request - that is the whole point of the ownership rule.
 *
 * Deliberately 403 and not 404: the caller IS authenticated and the rule that
 * failed is permission, not existence. This project reports role/ownership
 * failures as 403 - matching auth-service's AccessDenied behaviour.
 */
public class ForbiddenOperationException extends RuntimeException {

    private final HttpStatus status;

    public ForbiddenOperationException(String message) {
        super(message);
        this.status = HttpStatus.FORBIDDEN;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
