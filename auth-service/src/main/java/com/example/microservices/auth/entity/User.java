package com.example.microservices.auth.entity;

import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

/**
 * One instance = one row in the "users" table of auth_db.
 *
 * SECURITY RULE #1: the password field NEVER stores the plain text a user
 * typed. Before saving, AuthServiceImpl runs it through BCryptPasswordEncoder,
 * which stores a one-way hash like "$2a$10$Xk...". One-way = you can verify a
 * login attempt against it, but you can never read the original back.
 *
 * SECURITY RULE #2: this entity must NEVER be returned directly by a
 * controller - it contains the hash. That is why AuthResponse/UserResponse
 * DTOs exist: only clean fields (id, username, email, roles) ever leave.
 *
 * WHAT A USER ACCOUNT CARRIES (three roles, no more):
 *   - exactly ONE of ROLE_ADMIN / ROLE_HR / ROLE_EMPLOYEE
 *   - employeeId: WHICH employee in employee_db this account belongs to. It is a
 *     plain Long, NOT a JPA relation - auth_db must never point across
 *     databases (no shared tables, no cross-service foreign keys). The link is
 *     a soft one: employeeId 7 means "employee 7 in employee-service".
 *     NULL for accounts that are not tied to an employee (e.g. a pure admin).
 *   - enabled: an ADMIN can switch an account off without deleting it. A
 *     disabled user keeps their data but can no longer log in.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The login name. Unique = two users cannot have the same username.
    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    // The BCrypt HASH (60 chars), never the raw password.
    @Column(nullable = false)
    private String password;

    // Display name shown in the UI (optional convenience field).
    @Column(name = "full_name", length = 150)
    private String fullName;

    // The employee this account represents (employee-service owns the real
    // employee record). Nullable + unique: one login per employee, but an
    // admin/HR account may have none. Used for employee SELF-SERVICE: an
    // EMPLOYEE token says "my employeeId is 7", so the service layer can
    // scope reads to that employee instead of trusting an id from the URL.
    // columnDefinition is NOT set here on purpose - NULL is a legal value.
    @Column(name = "employee_id", unique = true)
    private Long employeeId;

    // Active flag. true = may log in, false = account is switched off.
    // columnDefinition adds a DEFAULT so that adding this column to an
    // ALREADY POPULATED users table works (a NOT NULL column with no default
    // cannot be added by ddl-auto=update to a table that has rows).
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean enabled = true;

    // Many users <-> many roles. Hibernate builds the link table
    // "users_roles" (user_id, role_id) automatically.
    // EAGER because we always need roles when checking permissions.
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "users_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new HashSet<>();

    public User() {
        // JPA needs a no-argument constructor
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public Set<Role> getRoles() {
        return roles;
    }

    /**
     * ALWAYS stores a MUTABLE copy, never the caller's set.
     *
     * Why this matters: Hibernate owns this collection. When a user is updated
     * (em.merge) Hibernate REPLACES its elements - it calls clear() on the set
     * it finds. Handing it an immutable set (Set.of(...), Set.copyOf(...),
     * java.util.List.of) makes that call throw
     * "UnsupportedOperationException: null" at startup or on save - a failure
     * whose stack trace points at Hibernate internals, not at the innocent
     * one-liner that caused it. Copying here fixes it for EVERY caller, once.
     */
    public void setRoles(Set<Role> roles) {
        this.roles = roles == null ? new HashSet<>() : new HashSet<>(roles);
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
