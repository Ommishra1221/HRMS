package com.example.microservices.auth.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.microservices.auth.dto.AuthResponse;
import com.example.microservices.auth.dto.LoginRequest;
import com.example.microservices.auth.dto.UserResponse;
import com.example.microservices.auth.service.AuthService;

import jakarta.validation.Valid;

/**
 * Front door of auth-service, listening on port 8085.
 *
 * POST /auth/login -> login() (PUBLIC - the only public endpoint there is)
 * GET  /auth/me    -> me()    (PROTECTED: needs "Authorization: Bearer <token>")
 *
 * There is NO /auth/register any more. Public signup was removed: accounts are
 * created by an ADMIN through UserController (/auth/users). The React app has
 * no registration page to call it with either.
 *
 * The gateway maps http://localhost:8080/api/auth/** -> here (StripPrefix=1),
 * so the React app only ever calls /api/auth/... on port 8080.
 *
 * All three roles use this same endpoint to log in - the role does not change
 * HOW you authenticate, only WHAT you may do afterwards.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    // POST http://localhost:8085/auth/login
    // 200 OK on success (token + user profile).
    // 401 "Invalid username or password" for a wrong password, an unknown
    // username, a disabled account, or a malformed body - all identical.
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    // GET http://localhost:8085/auth/me
    // SecurityConfig demands a valid JWT here; the filter already identified
    // the caller, we just look them up. Returns the user WITHOUT password hash.
    @GetMapping("/me")
    public ResponseEntity<UserResponse> me() {
        return ResponseEntity.ok(authService.getCurrentUser());
    }
}
