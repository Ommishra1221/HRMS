package com.example.microservices.employee.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when an authenticated caller is not allowed to touch the resource -
 * the ownership half of the authorization model (the role half is
 * @PreAuthorize / SecurityConfig).
 *
 * Classic case: an EMPLOYEE token for employeeId 25 asking for
 * GET /employees/26. The role gate passes (EMPLOYEE may read "/employees/*"),
 * but the service layer compares the path id with CurrentUser.employeeId()
 * (resolved from the JWT, never from the URL alone) and throws this ->
 * GlobalExceptionHandler answers 403 Forbidden.
 *
 * Deliberately 403 and not 404: the caller IS authenticated and the rule that
 * failed is permission, not existence. (404 would also be defensible for
 * "not yours = invisible", but this project reports role/ownership failures
 * as 403 - matching auth-service's AccessDenied behaviour.)
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
