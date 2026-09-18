# Auth Service

> Last reviewed: written from current source code
> Source of truth: `auth-service/src/main/java/com/example/microservices/auth/**`
> Service: auth-service · Port: 8085 · Database: HRMS / auth_schema

The security foundation of HRMS. It is the **only** service that issues tokens, the
only one with a public endpoint, and the only one that stores credentials.

## 1. What is this service?
Two things: the **login door** (verify credentials, issue a JWT) and the **account
back office** (ADMIN creates users, assigns the single role, enables/disables).
It deliberately does **not** know what an employee, leave or payslip is.

## 2. Why does it exist?
Authentication must happen exactly once and be trusted everywhere. Centralising it
means one password store, one role model, one token issuer — and because the other
services share the signing secret, they can verify tokens locally with **no**
auth-service call per request (stateless).

## 3. What does this service own?
- **Database:** `auth_schema` — `users`, `roles`, `users_roles`.
- **Entities:** `User`, `Role`, `RoleName` (enum whitelist).
- **Business responsibility:** login, `/me`, account CRUD, role assignment,
  enable/disable.
- **What it does NOT own:** employee data. `users.employee_id` is a plain number
  pointing at employee-service; the link is soft and is validated nowhere here.

## 4. Port and configuration
```properties
spring.application.name=auth-service
server.port=8085
spring.jpa.properties.hibernate.default_schema=auth_schema
app.jwt.secret=hrms-learning-demo-secret-…    # shared with all four other services
app.jwt.expiration-ms=86400000                # 24 h
```
Gateway route: `Path=/api/auth/** → lb://auth-service, StripPrefix=1`.
No Feign, no outbound HTTP at all — it looks nobody up.

## 5. Folder structure
```
auth-service/src/main/java/com/example/microservices/auth/
├── AuthServiceApplication.java
├── config/SecurityConfig.java        the access map + 401/403 JSON + BCrypt bean
├── config/DataSeeder.java            3 roles + admin/hr/employee demo accounts
├── controller/AuthController.java    POST /auth/login, GET /auth/me
├── controller/UserController.java    6 ADMIN endpoints under /auth/users
├── service/AuthService(+Impl)        login + me
├── service/UserService(+Impl)        account management rules
├── service/UserMapper.java           entity ↔ DTO + role-name mapping
├── repository/UserRepository.java, RoleRepository.java
├── entity/User.java, Role.java, RoleName.java
├── dto/LoginRequest, AuthResponse, UserResponse, CreateUserRequest,
│        UpdateUserRequest, UpdateRoleRequest, UpdateStatusRequest
├── security/JwtUtil.java             THE only token class (sign + verify)
├── security/JwtAuthenticationFilter.java
├── security/CustomUserDetailsService.java
└── exception/…  GlobalExceptionHandler + typed exceptions
```

## 6. Database
```
auth_schema.users
┌─────────────┬───────────────────────────────────────────────────┐
│ id          │ PK                                                │
│ username    │ UNIQUE NOT NULL                                   │
│ email       │ UNIQUE NOT NULL                                   │
│ password    │ BCrypt hash ("$2a$10$…", 60 chars) - never plain  │
│ full_name   │ optional display name                             │
│ employee_id │ UNIQUE, nullable - soft link to employee-service  │
│ enabled     │ boolean, false = cannot log in                    │
└─────────────┴───────────────────────────────────────────────────┘
auth_schema.roles          (ROLE_ADMIN, ROLE_HR, ROLE_EMPLOYEE - exactly 3 rows)
auth_schema.users_roles    (user_id, role_id - @ManyToMany join table)
```
One login per employee: `employee_id` is UNIQUE at the DB level *and* checked with a
readable 409 in `UserServiceImpl`.

## 7. Entity — `User`

| Field | WHAT | WHY | WHO SETS IT | WHO MAY CHANGE IT |
|---|---|---|---|---|
| `id` | PK | JWT `userId` claim | DB | nobody |
| `username` | login name | JWT `sub`; unique | ADMIN | ADMIN (409 on clash) |
| `email` | contact | unique | ADMIN | ADMIN (409) |
| `password` | BCrypt **hash** | authentication | ADMIN (create/reset) | ADMIN only; never returned |
| `fullName` | display name | UI | ADMIN | ADMIN |
| `employeeId` | employee link | self-service identity | ADMIN | ADMIN; UNIQUE; nullable |
| `enabled` | on/off switch | disable without deleting | ADMIN | ADMIN; cannot disable self or last enabled admin |
| `roles` | exactly one role | authorization | ADMIN via role endpoints | ADMIN; `Set.of(role)` replaces (never accumulates) |

`setRoles` defensively copies into a **mutable** `HashSet` — handing Hibernate an
immutable `Set.of(...)` breaks collection updates.

## 8. DTOs (entities never leave this service — the hash must not leak)

| DTO | Direction | Fields / notes |
|---|---|---|
| `LoginRequest` | in | `username` `@NotBlank`, `password` `@NotBlank` |
| `AuthResponse` | out | `token`, `tokenType="Bearer"`, `id`, `username`, `email`, `fullName`, `roles` (e.g. `["ROLE_HR"]`), `employeeId` |
| `UserResponse` | out | like AuthResponse without token; carries `enabled` |
| `CreateUserRequest` | in | username (3–100, charset-restricted), email `@Email`, password (6–100), fullName ≤150, **role required** (ADMIN/HR/EMPLOYEE), optional employeeId |
| `UpdateUserRequest` | in | partial: only non-null fields applied; `password` = admin reset; `changeEmployeeId` flag allows un-linking |
| `UpdateRoleRequest` | in | `role` — whitelisted by `RoleName.from` (400 otherwise) |
| `UpdateStatusRequest` | in | `enabled` boolean |

## 9. Repository
```java
Optional<User> findByUsername(String username);                 // login + /me
boolean existsByUsername(String username); boolean existsByEmail(String email);
Optional<User> findByEmployeeId(Long employeeId);               // one-login-per-employee check
long countByRoles_NameAndEnabledTrueAndIdNot(String roleName, Long id); // last-admin guard
```
The last one reads: "how many OTHER enabled ROLE_ADMIN users exist besides this id?" —
the SQL for "would anyone still be able to manage users?"

## 10. Service layer

**Login — `AuthServiceImpl.login()`**
```
POST /auth/login (public)
   ↓ AuthenticationManager.authenticate(new UsernamePasswordAuthenticationToken(...))
   ↓ CustomUserDetailsService.loadUserByUsername()   → UserRepository → users row
   ↓   enabled flag checked here (disabled → DisabledException)
   ↓ BCrypt: encoder.matches(typedPassword, storedHash)
   ↓ any failure → InvalidCredentialsException → 401 "Invalid username or password"
        (SAME message for unknown user / wrong password / disabled - anti-enumeration)
   ↓ JwtUtil.generateToken(sub, userId, roles, employeeId?)   ← the token is born
   ↓ AuthResponse { token, roles, employeeId, … }
```

**Accounts — `UserServiceImpl`** (all ADMIN-only, twice-locked: URL rule + class
`@PreAuthorize`):
- create: uniqueness (409s) → `RoleName.from` whitelist (400) → BCrypt → `Set.of(role)`;
- update: per-field partial apply, duplicate re-checks, optional password re-hash;
- `setEnabled(false)`: 403 if target is yourself; 403 if last enabled admin;
- `changeRole`: same two guards before demoting an admin; replacement is `Set.of(role)`;
- `assertNotLastEnabledAdmin` counts other enabled admins — no lockout possible.

## 11. Controller

| METHOD PATH | PURPOSE | SUCCESS | FAILURE | AUTHORIZATION |
|---|---|---|---|---|
| `POST /auth/login` | issue JWT | 200 + AuthResponse | 401 (uniform) / 400 | **public** |
| `GET /auth/me` | who am I | 200 + UserResponse | 401 | any authenticated |
| `POST /auth/users` | create account | 201 | 400 / 409 | ADMIN |
| `GET /auth/users` | list accounts | 200 | — | ADMIN |
| `GET /auth/users/{id}` | one account | 200 | 404 | ADMIN |
| `PUT /auth/users/{id}` | update / reset password | 200 | 400 / 404 / 409 | ADMIN |
| `PATCH /auth/users/{id}/status` | enable/disable | 200 | 403 (self / last admin) | ADMIN |
| `PATCH /auth/users/{id}/role` | replace role | 200 | 400 / 403 | ADMIN |

## 12. Exception handling
`InvalidCredentialsException` → 401 · `InvalidTokenException` → 401 ·
`DuplicateUserException` → 409 · `UserNotFoundException` → 404 ·
`InvalidRoleException` → 400 · `OperationNotAllowedException` → 403 ·
`AccessDeniedException` → 403 · validation → 400 · 500 catch-all. Same JSON shape
everywhere.

## 13. Service-to-service communication
**None.** No Feign client exists in this service — auth looks nobody up. Its only
connection to the other services is the **shared JWT secret**: employee/leave/
attendance/payroll verify the tokens this service signs. (The `employeeId` claim's
*target* lives in employee-service, but auth never calls it.)

## 14. The security chain, step by step (READ THIS TWICE)

```
LOGIN (issue)                                EVERY OTHER REQUEST (verify)
Browser → POST /api/auth/login               Browser → Authorization: Bearer eyJ…
  ↓ Gateway → auth-service                     ↓ Gateway forwards the header untouched
AuthController → AuthServiceImpl              JwtAuthenticationFilter (each service)
  ↓ AuthenticationManager                       ├─ header missing? → stay anonymous → 401
  ↓ CustomUserDetailsService                    ├─ JwtUtil.validateToken: signature + exp
  ↓ UserRepository (auth_schema)                ├─ roles → SimpleGrantedAuthority list
  ↓ BCrypt matches                              ├─ empty roles claim → treated as anonymous
  ↓ JwtUtil.generateToken                       └─ principal = AuthUser(username, employeeId)
  ↓ AuthResponse.token                                credentials = the raw token
localStorage.hrms_token ←──────────────        ↓ SecurityConfig URL rules (401/403)
axiosInstance interceptor adds header          ↓ @PreAuthorize (method lock)
on EVERY api call                              ↓ Controller → ServiceImpl
                                               ↓ CurrentUser → ownership check
                                               ↓ business logic → repository
```

**JWT anatomy with a real example:**

```
HEADER   {"alg":"HS512"}                                   → which algorithm
PAYLOAD  {"sub":"employee","userId":3,
          "roles":["ROLE_EMPLOYEE"],"employeeId":1,
          "iat":1760000000,"exp":1760086400}                → the claims
SIGNATURE  HMAC-SHA512(base64(header).base64(payload), secret)
```

- **Signed, not encrypted:** anyone can Base64-decode the payload (so no password
  inside — ever), but a single changed character invalidates the signature.
- **Stateless:** no session is stored; the token *is* the proof until `exp`.
- **employeeId claim:** the engine of every ownership check in the other services.

## 15. Frontend connection
```
Login.jsx → AuthContext.login() → authApi.login() → POST /api/auth/login
   → token persisted (localStorage.hrms_token) + user cached
axiosInstance request interceptor → Authorization header on every call
response interceptor → 401 on protected calls → wipe token → redirect /login
AuthContext on mount → GET /api/auth/me → refresh the cached profile
```
There is no register page, no `register()` API function, and no signup route —
deliberately deleted.

## 16. Security / role rules
Exactly three roles (`RoleName` enum — a compile-time whitelist; anything else → 400).
ADMIN: creates accounts, assigns the single role, enables/disables; cannot demote/
disable themselves or the last enabled admin. HR/EMPLOYEE: `/auth/users/**` returns
403 before any logic runs. Only `/auth/login` is public. Full matrix:
[04_SECURITY_AND_ROLES.md](../04_SECURITY_AND_ROLES.md).

## 17. Beginner mistakes
- Returning the `User` entity (leaks the hash) instead of `UserResponse`.
- Storing plain passwords or hashing in the controller instead of the service.
- Putting a password into a JWT claim "for convenience".
- Confusing signed vs encrypted and shipping "hidden" data in the payload.
- Testing role rules only in the UI — the backend URL rule + `@PreAuthorize` are the
  real gates; Postman proves them.
- Expecting a disabled user's in-flight token to die immediately (stateless: it
  expires; role/ownership checks still apply per request).

## 18. Interview questions
- **Walk me through login.** Controller → AuthenticationManager → CustomUserDetailsService → UserRepository → BCrypt match → JwtUtil signs claims → token in AuthResponse.
- **Why BCrypt over SHA-256?** Slow by design + per-hash salt; verification-only, built for passwords.
- **Why JWT over sessions?** Stateless: any service verifies locally with the shared secret; no session store, no auth call per request.
- **How does another service trust this token?** Same `app.jwt.secret`; signature + expiry verified by its own filter.
- **How do you prevent privilege escalation?** Roles arrive only through ADMIN-only endpoints; `RoleName.from` whitelists (400); role replacement is `Set.of(role)`; self/last-admin demotions 403.
- **Where is authorization enforced?** Three layers: SecurityConfig URL rules, `@PreAuthorize`, and ownership checks in service code with `CurrentUser`.
- **Why is a wrong password and an unknown username the same 401?** User-enumeration resistance.

## 19. Quick revision
1. Port 8085; only service with a public endpoint; no Feign.
2. Owns users/roles/users_roles in auth_schema; BCrypt hashes only.
3. Roles: exactly ADMIN / HR / EMPLOYEE — enum whitelist, one per account.
4. No signup: `POST /auth/login` is the only public door; ADMIN creates accounts.
5. JWT claims: sub, userId, roles[1], employeeId (only if linked), iat, exp (24 h).
6. Disabled accounts fail login with the same vague 401 as a wrong password.
7. `/auth/users/**` is double-locked (URL rule + class `@PreAuthorize`).
8. No self-lockout: self-disable and last-admin demote/disable are 403.
9. Duplicates: username/email/employeeId → 409 (employee_id also UNIQUE).
10. UserMapper/DTOs ensure the hash never leaves the service.

## 20. One-minute explanation
"Auth-service is the security core on 8085. Login is the system's only public
endpoint: AuthenticationManager loads the account via CustomUserDetailsService,
BCrypt verifies the password, and JwtUtil signs a 24-hour HS512 token carrying
sub, userId, exactly one role, and employeeId when the account is linked to an
employee. There's no signup — an ADMIN creates accounts through double-locked
/auth/users endpoints, with a closed three-role enum, duplicate 409s, and guards
against self- and last-admin lockout. Every other service shares the signing secret,
so they verify tokens locally, and the employeeId claim is what powers all the
ownership checks downstream."
