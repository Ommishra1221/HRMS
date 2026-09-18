package com.example.microservices.auth.config;

import java.util.Set;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.microservices.auth.entity.Role;
import com.example.microservices.auth.entity.RoleName;
import com.example.microservices.auth.entity.User;
import com.example.microservices.auth.repository.RoleRepository;
import com.example.microservices.auth.repository.UserRepository;

/**
 * DataSeeder = runs once at the END of startup, after the tables exist.
 *
 * WHAT IT GUARANTEES (and nothing more):
 * 1. The roles table holds EXACTLY the three application roles -
 *    ROLE_ADMIN, ROLE_HR, ROLE_EMPLOYEE - and never a fourth.
 * 2. One ready-to-use ADMIN account exists, so a fresh install is usable.
 * 3. Two demo accounts (an HR user and an EMPLOYEE user) exist so all three
 *    login paths can be exercised immediately. They are convenience data -
 *    delete them in production.
 *
 * IDEMPOTENT BY DESIGN: "if absent, create" - safe to run at every startup,
 * unlike plain INSERT scripts which would fail (or duplicate rows) on the
 * second boot.
 *
 * WHY A SEEDER AT ALL? There is no public registration any more, so without a
 * seeded admin nobody could ever create the FIRST account. That is the classic
 * bootstrap problem, and this class is the answer.
 *
 * PASSWORDS: every password below is BCrypt-hashed BEFORE it is stored. The
 * plain text appears in this file only because it is demo data you are meant
 * to log in with - never hardcode real credentials like this.
 */
@Component
public class DataSeeder implements ApplicationRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(RoleRepository roleRepository,
                      UserRepository userRepository,
                      PasswordEncoder passwordEncoder) {
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // ---- The complete role list. Three rows, forever. ----
        Role adminRole = ensureRole(RoleName.ADMIN);
        Role hrRole = ensureRole(RoleName.HR);
        Role employeeRole = ensureRole(RoleName.EMPLOYEE);

        // ---- The bootstrap administrator (the one account that MUST exist) ----
        ensureUser("admin", "admin@hrms.com", "admin123", "System Administrator", adminRole, null);

        // ---- Demo accounts so HR and EMPLOYEE logins are testable today ----
        ensureUser("hr", "hr@hrms.com", "hr123", "HR Manager", hrRole, null);
        // employeeId 1 is a SOFT link to employee 1 in employee-service: no
        // foreign key crosses databases, it is just "this login belongs to that
        // employee record". Re-point it any time with PUT /auth/users/{id}.
        ensureUser("employee", "employee@hrms.com", "employee123", "Demo Employee", employeeRole, 1L);

        // ---- Migration repair for an auth_db created by the OLD model ----
        // The previous version seeded `admin` with ROLE_ADMIN *and* ROLE_EMPLOYEE
        // (and allowed arbitrary role names). Under the new "exactly one role"
        // rule that account must hold ROLE_ADMIN only, so we normalise it here.
        // Idempotent: once repaired, this branch never fires again.
        userRepository.findByUsername("admin").ifPresent(admin -> {
            boolean alreadyCorrect = admin.getRoles().size() == 1
                    && admin.getRoles().stream().anyMatch(r -> RoleName.ADMIN.toAuthority().equals(r.getName()));
            if (!alreadyCorrect) {
                admin.setRoles(Set.of(adminRole));
                userRepository.save(admin);
            }
        });
    }

    /** Create the role row if it is missing; return it either way. */
    private Role ensureRole(RoleName roleName) {
        String authority = roleName.toAuthority(); // "ADMIN" -> "ROLE_ADMIN"
        return roleRepository.findByName(authority)
                .orElseGet(() -> roleRepository.save(new Role(authority)));
    }

    /**
     * Create the account if the seed slot is still free; never touch an
     * existing one.
     *
     * "Free" means BOTH of these:
     *   1. the username does not exist, AND
     *   2. for accounts that carry an employeeId link, that link is not owned
     *      by any other account.
     *
     * Check 2 is what keeps this seeder IDEMPOTENT after an admin edits the
     * demo accounts through /auth/users. Example: renaming the seeded
     * "employee" account to "emp01" frees the username but KEEPS the
     * employee_id = 1 link (users.employee_id is UNIQUE). Re-inserting the
     * old demo row on the next boot would collide with that unique index and
     * crash startup - so when the link is already owned, the seed slot is
     * treated as occupied and creation is skipped.
     */
    private void ensureUser(String username, String email, String rawPassword,
                            String fullName, Role role, Long employeeId) {
        if (userRepository.existsByUsername(username)) {
            return;
        }
        if (employeeId != null && userRepository.findByEmployeeId(employeeId).isPresent()) {
            return;
        }
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        // THE key line: a BCrypt hash goes into the database, never "admin123".
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setFullName(fullName);
        user.setEmployeeId(employeeId);
        user.setEnabled(true);
        // Exactly ONE role per account - this is what replaced the old
        // "admin holds every role" shortcut.
        user.setRoles(Set.of(role));
        userRepository.save(user);
    }
}
