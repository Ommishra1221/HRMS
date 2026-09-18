package com.example.microservices.auth.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when the request is well formed and the caller IS an admin, but the
 * operation is still refused on safety grounds -> 403 Forbidden.
 *
 * The one rule that uses it: an ADMIN may not demote or disable THEMSELVES.
 * (Also refused: removing the last remaining administrator - see
 * UserServiceImpl.) Disabling the only admin would lock everyone out of user
 * management permanently, so we block it rather than trust the operator.
 *
 * 403 vs 401 - the difference matters:
 *   401 = "I do not know who you are"      (log in again)
 *   403 = "I know who you are, and no"     (logging in again will not help)
 */
public class OperationNotAllowedException extends RuntimeException {

    private final HttpStatus status;

    public OperationNotAllowedException(String message) {
        super(message);
        this.status = HttpStatus.FORBIDDEN;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
