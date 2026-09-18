package com.example.microservices.auth.service;

import java.util.List;

import com.example.microservices.auth.dto.CreateUserRequest;
import com.example.microservices.auth.dto.UpdateUserRequest;
import com.example.microservices.auth.dto.UserResponse;
import com.example.microservices.auth.entity.RoleName;

/**
 * UserService = ADMIN-only account management.
 *
 * Because public signup no longer exists, this IS the only way a user is
 * created. Every method here is reachable exclusively by an ADMIN token -
 * enforced twice: the URL rule in SecurityConfig (/auth/users/** ->
 * hasRole("ADMIN")) and @PreAuthorize on UserController.
 *
 * The service layer still enforces the SAFETY rules that a role check cannot
 * express (an admin may not lock everyone out by demoting or disabling the
 * last remaining administrator, nor their own account).
 */
public interface UserService {

    /** Create an account with exactly one role (ADMIN / HR / EMPLOYEE). */
    UserResponse createUser(CreateUserRequest request);

    /** Every account, id ascending. */
    List<UserResponse> getAllUsers();

    /** One account by its auth_db id, or 404. */
    UserResponse getUserById(Long id);

    /** Patch username/email/fullName/password/employeeId. Null fields are left alone. */
    UserResponse updateUser(Long id, UpdateUserRequest request);

    /** Switch an account on or off (keeps all data, blocks login). */
    UserResponse setEnabled(Long id, boolean enabled);

    /** Replace the account's single role. Refuses to demote the last ADMIN. */
    UserResponse changeRole(Long id, RoleName role);
}
