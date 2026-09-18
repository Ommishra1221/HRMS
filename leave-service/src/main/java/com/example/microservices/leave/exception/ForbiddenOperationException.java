package com.example.microservices.leave.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when an authenticated caller is not allowed to touch the resource -
 * the ownership half of the authorization model (the role half is
 * @PreAuthorize / SecurityConfig).
 *
 * Cases in this service:
 * - an EMPLOYEE reads/edits/deletes another employee's leave  -> 403
 * - an EMPLOYEE creates a leave with somebody else's employeeId -> 403
 * - an EMPLOYEE edits/deletes a leave that is not PENDING     -> 403
 *
 * The employeeId used in every comparison comes from CurrentUser (the JWT),
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
