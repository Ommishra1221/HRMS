package com.example.microservices.auth.service;

import java.util.List;
import java.util.Set;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.microservices.auth.dto.CreateUserRequest;
import com.example.microservices.auth.dto.UpdateUserRequest;
import com.example.microservices.auth.dto.UserResponse;
import com.example.microservices.auth.entity.Role;
import com.example.microservices.auth.entity.RoleName;
import com.example.microservices.auth.entity.User;
import com.example.microservices.auth.exception.DuplicateUserException;
import com.example.microservices.auth.exception.OperationNotAllowedException;
import com.example.microservices.auth.exception.UserNotFoundException;
import com.example.microservices.auth.repository.RoleRepository;
import com.example.microservices.auth.repository.UserRepository;

/**
 * UserServiceImpl = the ADMIN's toolbox: create / list / read / update /
 * enable-disable / change role.
 *
 * EVERY RULE THAT KEEPS THIS SAFE lives in this class, not in the controller:
 *
 *  1. ROLE WHITELIST   - roles arrive as text and go through RoleName.from(),
 *                        so "SUPERUSER" is a 400, never a row.
 *  2. ONE ROLE ONLY    - setRoles(Set.of(role)) always REPLACES, so an account
 *                        can never accumulate permissions.
 *  3. DUPLICATES       - username/email/employeeId collisions are 409 with a
 *                        message that says WHICH field clashed.
 *  4. NO LOCKOUT       - an admin may not demote or disable themselves, and
 *                        the LAST remaining admin may not be demoted, disabled
 *                        or switched to another role. Without this rule a
 *                        single careless request would leave an installation
 *                        with nobody able to create users at all.
 *  5. HASHING          - passwords are BCrypt-encoded here, on every path that
 *                        accepts one (create AND admin reset). The plain text
 *                        exists only as a local variable.
 */
@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;

    public UserServiceImpl(UserRepository userRepository,
                           RoleRepository roleRepository,
                           PasswordEncoder passwordEncoder,
                           UserMapper userMapper) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.userMapper = userMapper;
    }

    // ------------------------------------------------------------------
    // CREATE
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        String username = request.getUsername().trim();
        String email = request.getEmail().trim();

        // STEP 1: uniqueness. The DB unique constraints are the last line of
        // defense; these checks turn a raw SQL error into a readable 409.
        if (userRepository.existsByUsername(username)) {
            throw new DuplicateUserException("Username is already taken: " + username);
        }
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateUserException("Email is already registered: " + email);
        }
        assertEmployeeLinkIsFree(request.getEmployeeId(), null);

        // STEP 2: role - whitelisted, never invented by the client.
        Role role = resolveRole(RoleName.from(request.getRole()));

        // STEP 3: build + HASH + save. This one line is the difference between
        // a secure app and a data-breach headline.
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName());
        user.setEmployeeId(request.getEmployeeId());
        user.setEnabled(true);
        // Set.of(...) is a ONE-element set: this account gets exactly the one
        // role the admin asked for, and nothing else.
        user.setRoles(Set.of(role));

        return userMapper.toResponse(userRepository.save(user));
    }

    // ------------------------------------------------------------------
    // READ
    // ------------------------------------------------------------------
    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepository.findAllByOrderByIdAsc().stream()
                .map(userMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        return userMapper.toResponse(findUserOrThrow(id));
    }

    // ------------------------------------------------------------------
    // UPDATE (profile fields + optional password reset)
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public UserResponse updateUser(Long id, UpdateUserRequest request) {
        User user = findUserOrThrow(id);

        // Each field is applied ONLY when supplied - a null means "leave it".
        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            String username = request.getUsername().trim();
            if (!username.equals(user.getUsername()) && userRepository.existsByUsername(username)) {
                throw new DuplicateUserException("Username is already taken: " + username);
            }
            user.setUsername(username);
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String email = request.getEmail().trim();
            if (!email.equals(user.getEmail()) && userRepository.existsByEmail(email)) {
                throw new DuplicateUserException("Email is already registered: " + email);
            }
            user.setEmail(email);
        }

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }

        if (request.isChangeEmployeeId()) {
            assertEmployeeLinkIsFree(request.getEmployeeId(), user.getId());
            user.setEmployeeId(request.getEmployeeId());
        }

        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            // An admin-issued reset. Re-hashed; the old hash is simply replaced
            // (JWTs already issued stay valid until they expire - a known and
            // accepted trade-off of stateless tokens, see docs/services/AUTH_SERVICE.md).
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        return userMapper.toResponse(userRepository.save(user));
    }

    // ------------------------------------------------------------------
    // ENABLE / DISABLE
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public UserResponse setEnabled(Long id, boolean enabled) {
        User user = findUserOrThrow(id);

        if (!enabled) {
            // Rule 4a: no self-lockout.
            if (user.getUsername().equals(currentUsername())) {
                throw new OperationNotAllowedException(
                        "You cannot disable your own account. Ask another administrator.");
            }
            // Rule 4b: never switch off the LAST route into user management.
            // "Last" means: no OTHER enabled admin would be left. In the normal
            // case the caller is an enabled admin, so this passes; it fires when
            // the account being disabled is the only enabled administrator left
            // (e.g. the request came from an admin whose own account was since
            // switched off but whose token is still valid).
            assertNotLastEnabledAdmin(user);
        }

        user.setEnabled(enabled);
        return userMapper.toResponse(userRepository.save(user));
    }

    // ------------------------------------------------------------------
    // CHANGE ROLE
    // ------------------------------------------------------------------
    @Override
    @Transactional
    public UserResponse changeRole(Long id, RoleName role) {
        User user = findUserOrThrow(id);

        // Rule 4a/4b. Enforced even before comparing, because "demote myself"
        // and "demote the last admin" are both permanent lockouts.
        boolean losingAdmin = isAdmin(user) && role != RoleName.ADMIN;
        if (losingAdmin) {
            if (user.getUsername().equals(currentUsername())) {
                throw new OperationNotAllowedException(
                        "You cannot change your own role away from ADMIN. Ask another administrator.");
            }
            assertNotLastEnabledAdmin(user);
        }

        // setRoles(Set.of(...)) REPLACES the set: one account = one role. Any
        // leftover roles_roles link rows are removed by Hibernate.
        user.setRoles(Set.of(resolveRole(role)));

        return userMapper.toResponse(userRepository.save(user));
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private User findUserOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("User not found with id: " + id));
    }

    /**
     * The ROLE_ prefix belongs to Spring Security; the roles table stores the
     * long form. orElseGet = idempotent creation: if a role row is missing
     * (fresh database, seeder not finished, old data set) we create it here
     * instead of failing. A unique constraint on roles.name backs this up, so
     * a race can never produce two ROLE_HR rows.
     */
    private Role resolveRole(RoleName roleName) {
        return roleRepository.findByName(roleName.toAuthority())
                .orElseGet(() -> roleRepository.save(new Role(roleName.toAuthority())));
    }

    /**
     * One login per employee: employeeId is unique in the users table, so a
     * second account for the same employee is a 409, not a silent duplicate.
     * @param ownerId the user being edited (their own value must not clash with
     *                itself) - null while creating.
     */
    private void assertEmployeeLinkIsFree(Long employeeId, Long ownerId) {
        if (employeeId == null) {
            return;
        }
        userRepository.findByEmployeeId(employeeId).ifPresent(existing -> {
            if (ownerId == null || !existing.getId().equals(ownerId)) {
                throw new DuplicateUserException(
                        "Employee " + employeeId + " is already linked to the account '" + existing.getUsername() + "'");
            }
        });
    }

    private boolean isAdmin(User user) {
        return user.getRoles().stream()
                .anyMatch(role -> RoleName.ADMIN.toAuthority().equals(role.getName()));
    }

    /**
     * Rule 4b, shared by "disable" and "demote": refuse if this account is the
     * last enabled administrator that could still manage users.
     *
     * Counted with IdNot, so the question really is "would anyone be left?":
     *   - caller is an enabled admin  -> at least the caller remains -> allowed
     *   - target is the only enabled one (stale-token / DB-tampering case)
     *                                 -> refused, nobody could undo it
     */
    private void assertNotLastEnabledAdmin(User target) {
        boolean targetIsEnabledAdmin = isAdmin(target) && target.isEnabled();
        if (!targetIsEnabledAdmin) {
            return; // disabling/demoting a non-admin can never lock anyone out
        }
        long otherEnabledAdmins = userRepository.countByRoles_NameAndEnabledTrueAndIdNot(
                RoleName.ADMIN.toAuthority(), target.getId());
        if (otherEnabledAdmins == 0) {
            throw new OperationNotAllowedException(
                    "This is the last enabled administrator - the account cannot be demoted or disabled");
        }
    }

    /** Who is calling - taken from the token, not from the request body. */
    private String currentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null ? null : authentication.getName();
    }
}
