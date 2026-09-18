package com.example.microservices.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One instance = one row in the "roles" table of auth_db.
 *
 * A Role is just a named permission level: ROLE_ADMIN, ROLE_HR, ROLE_EMPLOYEE.
 * Spring Security checks these names when we say "only ADMIN may do X".
 * (The ROLE_ prefix is a Spring Security convention - the framework's
 * hasRole("ADMIN") actually looks for the authority string "ROLE_ADMIN".)
 *
 * Why a table and not a String on User? So several users can SHARE one role
 * and renaming "ROLE_HR" happens in one place - classic normalization.
 */
@Entity
@Table(name = "roles")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Unique name, e.g. "ROLE_ADMIN". nullable=false + unique=the DB enforces it.
    @Column(nullable = false, unique = true, length = 50)
    private String name;

    public Role() {
        // JPA needs a no-argument constructor
    }

    public Role(String name) {
        this.name = name;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
