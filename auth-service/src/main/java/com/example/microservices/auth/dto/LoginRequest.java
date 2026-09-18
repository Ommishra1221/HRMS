package com.example.microservices.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * LoginRequest = the JSON a client sends to POST /auth/login.
 */
public class LoginRequest {

    @NotBlank(message = "username is required")
    private String username;

    @NotBlank(message = "password is required")
    private String password;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
