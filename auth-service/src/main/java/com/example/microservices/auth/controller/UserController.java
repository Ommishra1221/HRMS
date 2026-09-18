package com.example.microservices.auth.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.microservices.auth.dto.CreateUserRequest;
import com.example.microservices.auth.dto.UpdateRoleRequest;
import com.example.microservices.auth.dto.UpdateStatusRequest;
import com.example.microservices.auth.dto.UpdateUserRequest;
import com.example.microservices.auth.dto.UserResponse;
import com.example.microservices.auth.entity.RoleName;
import com.example.microservices.auth.service.UserService;

import jakarta.validation.Valid;

/**
 * UserController = ADMIN-only account management, mounted at /auth/users.
 *
 * Through the gateway the React app calls these as /api/auth/users/...
 * (StripPrefix=1 drops /api), so NO gateway change was needed for this feature.
 *
 *   POST   /auth/users              create an HR / EMPLOYEE (or another ADMIN)
 *   GET    /auth/users              list every account
 *   GET    /auth/users/{id}         one account
 *   PUT    /auth/users/{id}         update profile / reset password
 *   PATCH  /auth/users/{id}/status  enable or disable the account
 *   PATCH  /auth/users/{id}/role    replace the account's role
 *
 * WHY @PreAuthorize ON THE CLASS *AND* A hasRole RULE IN SecurityConfig?
 * Two independent locks on purpose:
 *   - the URL rule (/auth/users/** -> hasRole("ADMIN")) is the coarse gate;
 *   - @PreAuthorize travels WITH the method, so if someone later maps this
 *     controller somewhere else, or calls a method internally, it is STILL
 *     refused. A single misplaced annotation can no longer open up account
 *     creation to the whole internet.
 *
 * The refusal is a 403 with the project's JSON error shape - translated by
 * GlobalExceptionHandler's AccessDeniedException handler.
 */
@RestController
@RequestMapping("/auth/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    // POST http://localhost:8085/auth/users - 201 Created (a resource was born).
    // 409 if the username/email/employeeId is taken, 400 if the role is not
    // one of ADMIN / HR / EMPLOYEE.
    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.createUser(request));
    }

    // GET http://localhost:8085/auth/users - 200 with every account.
    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    // GET http://localhost:8085/auth/users/7 - 200, or 404 when it does not exist.
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    // PUT http://localhost:8085/auth/users/7 - partial update: only the fields
    // present in the body are applied. To UNLINK an employee, send
    // "employeeId": null together with "changeEmployeeId": true.
    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long id,
                                                   @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    // PATCH http://localhost:8085/auth/users/7/status - {"enabled": false}
    // Disabling keeps every row of history the account is attached to; it only
    // removes the ability to log in. 403 if you try to disable yourself or the
    // last remaining administrator.
    @PatchMapping("/{id}/status")
    public ResponseEntity<UserResponse> setEnabled(@PathVariable Long id,
                                                   @Valid @RequestBody UpdateStatusRequest request) {
        return ResponseEntity.ok(userService.setEnabled(id, request.getEnabled()));
    }

    // PATCH http://localhost:8085/auth/users/7/role - {"role": "HR"}
    // The role is whitelisted (400 for anything but ADMIN/HR/EMPLOYEE) and the
    // account ends up with EXACTLY that one role.
    @PatchMapping("/{id}/role")
    public ResponseEntity<UserResponse> changeRole(@PathVariable Long id,
                                                   @Valid @RequestBody UpdateRoleRequest request) {
        return ResponseEntity.ok(userService.changeRole(id, RoleName.from(request.getRole())));
    }
}
