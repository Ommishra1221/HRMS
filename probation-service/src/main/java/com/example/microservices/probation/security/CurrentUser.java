package com.example.microservices.probation.security;

import org.springframework.security.core.context.SecurityContextHolder;
import com.example.microservices.probation.exception.ProbationException;

public record CurrentUser(Long userId, String username, Long employeeId, String role) {
    public static CurrentUser get() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof CurrentUser user))
            throw ProbationException.forbidden();
        return user;
    }
    public boolean isOffice() { return role.equals("ADMIN") || role.equals("HR"); }
    public void requireRole(String expected) { if (!role.equals(expected)) throw ProbationException.forbidden(); }
    public void requireOffice() { if (!isOffice()) throw ProbationException.forbidden(); }
}
