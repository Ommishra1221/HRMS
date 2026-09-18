package com.example.microservices.auth.dto;

import jakarta.validation.constraints.NotNull;

/**
 * UpdateStatusRequest = the JSON an ADMIN sends to PATCH /auth/users/{id}/status.
 *
 * { "enabled": true }  -> the account may log in again
 * { "enabled": false } -> the account is switched off (kept, not deleted)
 *
 * Why disable instead of delete? An ex-employee's payroll, leave and attendance
 * history must survive, and those rows reference the account that created
 * them. Switching the flag off keeps the audit trail intact while removing the
 * ability to authenticate.
 */
public class UpdateStatusRequest {

    // Boolean (the wrapper) not boolean (the primitive): with the primitive a
    // missing field would silently mean false and lock the account out. The
    // wrapper lets @NotNull catch an empty body as a 400.
    @NotNull(message = "enabled is required (true or false)")
    private Boolean enabled;

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }
}
