package com.example.microservices.auth.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.microservices.auth.entity.User;

/**
 * JpaRepository gives us save/findAll/findById/deleteById for free -
 * same as every other service in this project.
 *
 * We only ADD the queries our login and admin user-management flows need.
 * Spring reads the method NAME and writes the SQL itself ("derived query
 * methods"), so none of these needs a @Query.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // Used by login: find the user trying to log in. Case-sensitive on purpose.
    Optional<User> findByUsername(String username);

    // Used by ADMIN user management: is this username already taken?
    boolean existsByUsername(String username);

    // Used by ADMIN user management: is this email already taken?
    boolean existsByEmail(String email);

    // Used when ADDING/changing employeeId: one login per employee.
    Optional<User> findByEmployeeId(Long employeeId);

    // Used by the role-safety rule: "how many OTHER administrators could still
    // log in if this account lost its admin rights?" - counted with IdNot so
    // the account being edited is excluded.
    //
    // ENABLED only (a switched-off admin is not a safety net), and IdNot so the
    // answer is about the REMAINING administrators rather than a raw total.
    // Zero means the account we are about to demote/disable is the last way
    // into user management, and the operation must be refused.
    long countByRoles_NameAndEnabledTrueAndIdNot(String roleName, Long id);

    // Used by GET /auth/users - stable ordering so the list does not shuffle
    // between calls (same reason the other services order their list APIs).
    List<User> findAllByOrderByIdAsc();
}
