package com.example.microservices.auth.service;

import java.util.List;

import org.springframework.stereotype.Component;

import com.example.microservices.auth.dto.UserResponse;
import com.example.microservices.auth.entity.Role;
import com.example.microservices.auth.entity.User;

/**
 * UserMapper = User entity -> UserResponse DTO, in ONE place.
 *
 * Why a class at all? AuthServiceImpl (/auth/me) and UserServiceImpl (every
 * admin endpoint) both have to convert a user for the outside world. Copying
 * those four lines into two services is exactly how a `password` field
 * eventually leaks from one of them - the mapper is the single choke point
 * where we guarantee the hash never leaves.
 */
@Component
public class UserMapper {

    public UserResponse toResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setEmail(user.getEmail());
        response.setFullName(user.getFullName());
        response.setEmployeeId(user.getEmployeeId());
        response.setEnabled(user.isEnabled());
        // Names come from the Role rows, always the long form: "ROLE_ADMIN".
        response.setRoles(user.getRoles().stream().map(Role::getName).toList());
        return response;
    }

    /** Convenience for the login response, which needs the same role list. */
    public List<String> roleNames(User user) {
        return user.getRoles().stream().map(Role::getName).toList();
    }
}
