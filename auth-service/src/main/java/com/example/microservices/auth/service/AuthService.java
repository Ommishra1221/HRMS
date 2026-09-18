package com.example.microservices.auth.service;

import com.example.microservices.auth.dto.AuthResponse;
import com.example.microservices.auth.dto.LoginRequest;
import com.example.microservices.auth.dto.UserResponse;

/**
 * The authentication contract of auth-service. AuthServiceImpl is the real
 * brain; the controller only knows this interface (same layering as
 * PayrollService / AttendanceService / LeaveService).
 *
 * Note what is NOT here any more: register(). Public signup was removed, so
 * creating an account is now an ADMIN operation and lives in UserService.
 */
public interface AuthService {

    /** Verify username + password (BCrypt check) and issue a JWT. */
    AuthResponse login(LoginRequest request);

    /** The currently authenticated user, read from the JWT in the request. */
    UserResponse getCurrentUser();
}
