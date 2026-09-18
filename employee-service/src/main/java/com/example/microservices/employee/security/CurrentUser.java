package com.example.microservices.employee.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * CurrentUser = the authenticated caller, resolved from the JWT.
 *
 * This is the OWNERSHIP half of the authorization model. Role gates ("only
 * ADMIN may delete") live in @PreAuthorize; but "an EMPLOYEE may only read
 * their OWN profile" needs the caller's identity, and the ONLY trustworthy
 * source of that identity is the signed token - never a parameter, path
 * variable or body field the client sent.
 *
 * The filter parks two things in the SecurityContext:
 *   - authorities: ROLE_ADMIN / ROLE_HR / ROLE_EMPLOYEE (exactly one)
 *   - principal:   AuthUser(username, employeeId)
 *
 * and this class hands them to the service layer in a readable form:
 *
 *   CurrentUser caller = CurrentUser.get();
 *   if (caller.isEmployee() && !id.equals(caller.employeeId())) {
 *       throw new ForbiddenOperationException("Employees may only view their own profile");
 *   }
 *
 * employeeId is null for ADMIN/HR accounts (they have no employee link), so
 * isEmployee() && hasEmployeeLink() together mean "a real self-service user".
 */
public final class CurrentUser {

    /**
     * The security principal the filter builds from the JWT: the username
     * (the token's "sub") plus the employeeId claim (null for admin/HR).
     */
    public record AuthUser(String username, Long employeeId) {
    }

    private final Authentication authentication;

    private CurrentUser(Authentication authentication) {
        this.authentication = authentication;
    }

    /**
     * Reads the caller out of Spring Security's context. Because every
     * endpoint in this service requires authentication, the principal is
     * always our AuthUser by the time a controller runs - if it is not, the
     * filter chain was misconfigured, which is a programming error, not a
     * client error (hence IllegalStateException -> 500, never a silent fallthrough).
     */
    public static CurrentUser get() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean present = authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof AuthUser;
        if (!present) {
            throw new IllegalStateException(
                    "No authenticated user in the SecurityContext - JwtAuthenticationFilter did not run");
        }
        return new CurrentUser(authentication);
    }

    /** The username the token was issued for (the "sub" claim). */
    public String username() {
        return authentication.getName();
    }

    /**
     * The employee this account belongs to, straight from the JWT - the
     * server-side identity used for every ownership check. Null for admin/HR.
     */
    public Long employeeId() {
        return authentication.getPrincipal() instanceof AuthUser user ? user.employeeId() : null;
    }

    /** true when the token actually carries an employeeId claim. */
    public boolean hasEmployeeLink() {
        return employeeId() != null;
    }

    public boolean isAdmin() {
        return hasRole("ADMIN");
    }

    public boolean isHr() {
        return hasRole("HR");
    }

    public boolean isEmployee() {
        return hasRole("EMPLOYEE");
    }

    /** "ADMIN" -> authority "ROLE_ADMIN" (the ROLE_ prefix is Spring's convention). */
    private boolean hasRole(String role) {
        String authority = "ROLE_" + role;
        return authentication.getAuthorities().stream()
                .anyMatch(granted -> authority.equals(granted.getAuthority()));
    }
}
