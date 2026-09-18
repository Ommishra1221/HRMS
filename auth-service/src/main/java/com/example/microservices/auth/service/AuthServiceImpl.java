package com.example.microservices.auth.service;

import java.util.List;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.microservices.auth.dto.AuthResponse;
import com.example.microservices.auth.dto.LoginRequest;
import com.example.microservices.auth.dto.UserResponse;
import com.example.microservices.auth.entity.User;
import com.example.microservices.auth.exception.InvalidCredentialsException;
import com.example.microservices.auth.exception.UserNotFoundException;
import com.example.microservices.auth.repository.UserRepository;
import com.example.microservices.auth.security.JwtUtil;

/**
 * THE HEART OF auth-service - and now a very small heart, on purpose.
 *
 * There are exactly TWO flows left:
 *
 * LOGIN: verify the password against the stored BCrypt hash with Spring's
 *        AuthenticationManager, then issue a JWT.
 * ME:    the JWT filter already authenticated the request; just read who.
 *
 * Account CREATION moved to UserServiceImpl, because creating an account is no
 * longer something an anonymous visitor may do - it is an ADMIN action.
 *
 * SECURITY RULE: the plain password exists ONLY as a method parameter here.
 * It is never logged, never stored, and never returned - only its BCrypt
 * hash is ever persisted.
 */
@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserMapper userMapper;

    public AuthServiceImpl(UserRepository userRepository,
                           AuthenticationManager authenticationManager,
                           JwtUtil jwtUtil,
                           UserMapper userMapper) {
        this.userRepository = userRepository;
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.userMapper = userMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        try {
            // Spring's standard authentication. Under the hood:
            //   CustomUserDetailsService.loadUserByUsername() -> our users table
            //   + the enabled flag check
            //   + BCrypt comparison of the typed password against the stored hash.
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));
            // Reaching this line means the password was correct AND the
            // account is enabled.
        } catch (AuthenticationException ex) {
            // Unknown user, WRONG PASSWORD, and DISABLED ACCOUNT all land here
            // and all get the SAME vague message. Telling them apart would let
            // anyone enumerate valid usernames, so we never do.
            throw new InvalidCredentialsException("Invalid username or password");
        }

        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new InvalidCredentialsException("Invalid username or password"));

        // THE JWT IS BORN HERE: username as subject, plus id + role +
        // employeeId as claims. The employeeId is what makes employee
        // self-service possible later ("my payslips", "my leaves") without
        // trusting an id sent by the browser.
        String token = jwtUtil.generateToken(
                user.getUsername(),
                user.getId(),
                user.getEmployeeId(),
                userMapper.roleNames(user));

        List<String> roleNames = userMapper.roleNames(user);

        AuthResponse response = new AuthResponse();
        response.setToken(token);
        response.setTokenType("Bearer");
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setEmail(user.getEmail());
        response.setFullName(user.getFullName());
        response.setRoles(roleNames);
        response.setEmployeeId(user.getEmployeeId());
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getCurrentUser() {
        // The JwtAuthenticationFilter put the username (the token's subject)
        // into SecurityContextHolder before this method ever runs.
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found: " + username));

        return userMapper.toResponse(user);
    }
}
