package com.example.microservices.auth.entity;

import com.example.microservices.auth.exception.InvalidRoleException;

/**
 * RoleName = THE COMPLETE LIST OF ROLES THAT MAY EXIST IN THIS APPLICATION.
 *
 * There are exactly three: ADMIN, HR, EMPLOYEE. Nothing else. Ever.
 *
 * WHY AN ENUM AND NOT JUST A STRING?
 * A String is open-ended: a client could POST {"role":"SUPERUSER"} and - if we
 * blindly saved it - the roles table would slowly fill with roles nobody
 * coded behaviour for. An enum makes the valid set part of the COMPILED code:
 * the only way to reach it is RoleName.from(...), which rejects garbage with a
 * 400 BEFORE anything is written to the database.
 *
 * The enum constant is the SHORT name ("ADMIN"); the database and Spring
 * Security both use the LONG name ("ROLE_ADMIN"). The ROLE_ prefix is a Spring
 * Security convention: hasRole("ADMIN") actually looks for the authority
 * string "ROLE_ADMIN". Keeping the mapping in ONE place (toAuthority()) means
 * the two spellings can never drift apart.
 */
public enum RoleName {

    ADMIN,
    HR,
    EMPLOYEE;

    /** The String Spring Security and the roles table both speak: "ROLE_ADMIN". */
    public String toAuthority() {
        return "ROLE_" + name();
    }

    /**
     * Parse whatever a client sent into a valid RoleName - or reject it.
     *
     * Accepted spellings (all case-insensitive, whitespace tolerated):
     *   "ADMIN"  "admin"  "Role_Admin"  "ROLE_ADMIN"   -> RoleName.ADMIN
     *
     * Rejected loudly (400): "SUPERUSER", "MANAGER", "", null.
     *
     * @throws InvalidRoleException if the value is not one of the three roles
     */
    public static RoleName from(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new InvalidRoleException(messageFor(raw));
        }
        String cleaned = raw.trim().toUpperCase();
        // Tolerate the long form so the same endpoint accepts "ADMIN" and
        // "ROLE_ADMIN" - we always store the long form internally.
        if (cleaned.startsWith("ROLE_")) {
            cleaned = cleaned.substring("ROLE_".length());
        }
        try {
            return RoleName.valueOf(cleaned);
        } catch (IllegalArgumentException ex) {
            throw new InvalidRoleException(messageFor(raw));
        }
    }

    private static String messageFor(String raw) {
        return "Invalid role: '" + raw + "' (allowed: ADMIN, HR, EMPLOYEE)";
    }
}
