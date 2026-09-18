package com.example.microservices.auth.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.microservices.auth.entity.Role;

/**
 * Same free CRUD as every repository in the project. The only extra query we
 * need: find a role by its name when assigning roles to a new user.
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {

    // "ROLE_ADMIN" -> the Role row. Used when registering a user.
    Optional<Role> findByName(String name);
}
