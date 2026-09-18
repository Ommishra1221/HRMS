# 04 · Security and Roles

> Last reviewed: written from current source code
> Source of truth: `SecurityConfig`, `JwtAuthenticationFilter`, `JwtUtil`, `CurrentUser`, `RoleName`, service impls in all five services

## 1. The model in one picture

```
              ┌──────────────────────────────┐
              │  POST /auth/login  (public)  │
              └──────────────┬───────────────┘
                             ▼
     JWT = header.payload.signature  (HS512, shared secret)
                             │
        every request carries it:  Authorization: Bearer eyJ…
                             ▼
┌───────────────────────────────────────────────────────────┐
│ JwtAuthenticationFilter  (each service)                   │
│   signature valid? not expired? → authorities + principal │
└──────────────┬────────────────────────────────────────────┘
               ▼
┌──────────────────────────────┐   ┌──────────────────────────────────┐
│ STEP 1: ROLE AUTHORIZATION   │   │ STEP 2: RESOURCE OWNERSHIP       │
│ SecurityConfig URL rules     │ → │ ServiceImpl + CurrentUser        │
│ + @PreAuthorize              │   │ "does this ROW belong to you?"   │
│ "may your ROLE touch this    │   │ identity comes ONLY from the JWT │
│  KIND of endpoint?"          │   │ (employeeId claim)               │
└──────────────────────────────┘   └──────────────────────────────────┘
               ▼
        Controller → business logic
```

The two steps are different questions. Step 1 knows your role; Step 2 knows your row.
Both must pass.

## 2. Exactly three roles, no signup

`RoleName` (auth-service) is a **compile-time whitelist**:

```java
public enum RoleName { ADMIN, HR, EMPLOYEE; }
```

- `RoleName.from("SUPERUSER")` → `InvalidRoleException` → **400** — an arbitrary role
  can never be stored.
- Every account holds **exactly one** role (`setRoles(Set.of(role))` replaces, never
  accumulates).
- `DataSeeder` seeds the three role rows + three demo accounts; there is **no**
  `/auth/register` endpoint, no `register()` in any frontend API file, no signup
  route or page. The only public endpoint in the whole system is `POST /auth/login`.

## 3. The JWT (what actually travels)

auth-service signs with `app.jwt.secret` (all five services share it — that is the
whole trust model). Claims issued by `JwtUtil.generateToken`:

```
sub        = username
userId     = users.id in auth_schema
roles      = ["ROLE_EMPLOYEE"]        ← exactly one of the three
employeeId = 1                        ← PRESENT ONLY for employee-linked accounts
                                        (omitted entirely for admin/HR - never null)
iat, exp   = issued at / expires (24 h)
```

Signed, **not encrypted** — anyone can read it (that's why no password is ever
inside), but only secret-holders can produce a valid signature. One flipped payload
character → signature mismatch → 401.

## 4. Login: disabled users, and why all failures look identical

`CustomUserDetailsService.loadUserByUsername()` returns Spring's principal with the
account's `enabled` flag. A disabled account raises `DisabledException`, which
`AuthServiceImpl` translates into the **same** `401 Invalid username or password` as
a wrong password — telling them apart would confirm the username exists
(user-enumeration resistance). Disabled users therefore cannot authenticate, and
in-flight tokens of a newly disabled user still work until expiry (stateless
trade-off — role/ownership checks still apply to every request).

## 5. ADMIN-only user management (server-side enforced, twice)

`UserController` is `@PreAuthorize("hasRole('ADMIN')")` at class level **and**
`/auth/users/**` is `hasRole("ADMIN")` in SecurityConfig — two independent locks.
Inside `UserServiceImpl`:

- role whitelist via `RoleName.from` (400 otherwise);
- duplicate username/email/employeeId → **409** (`employee_id` is also UNIQUE in the
  table);
- you cannot disable yourself (403);
- the last enabled ADMIN cannot be demoted or disabled (403) — no lockout;
- BCrypt on every create and password-reset path; plain password exists only as a
  local variable.

## 6. ROLE authorization matrix (coarse gates, per service)

**Employee-service** (`SecurityConfig` + `@PreAuthorize`):

| Endpoint | Rule |
|---|---|
| `POST /employees` | ADMIN |
| `PUT /employees/{id}` | ADMIN |
| `DELETE /employees/{id}` | ADMIN |
| `GET /employees` | ADMIN, HR |
| `GET /employees/me` | any authenticated (service resolves own profile; ADMIN/HR → 403 no link) |
| `GET /employees/{id}` | ADMIN, HR, EMPLOYEE (service then restricts employee to own id) |

**Leave-service:** GET = ADMIN+HR+EMPLOYEE; POST/PUT/DELETE = ADMIN+EMPLOYEE only
(HR is read-only); then ownership + PENDING rules per row.
**Attendance-service:** GET = all three; POST/PUT/PATCH(checkout)/DELETE = ADMIN only.
**Payroll-service:** GET = all three; POST/PUT/DELETE/`PATCH /{id}/paid` = ADMIN only.

## 7. RESOURCE OWNERSHIP matrix (fine gates — identity from the JWT)

| Service | Employee may… | Rejects with |
|---|---|---|
| employee | `GET /employees/{own id}`, `GET /employees/me` | 403 `ForbiddenOperationException` otherwise |
| leave | list/read **own** rows; create with body employeeId **= JWT employeeId**; update/delete **own PENDING** rows (edit also force-overwrites employeeId) | 403 |
| attendance | list/read **own** rows; `?employeeId=` **forced** to JWT value | 403 |
| payroll | list/read **own** payslips; `?employeeId=` **forced** to JWT value | 403 |

The canonical example:

```
JWT claims:        employeeId = 10,  ROLE_EMPLOYEE
Request:           GET /employees/20
ServiceImpl:       20 != 10  →  ForbiddenOperationException  →  HTTP 403
Request:           GET /employees/10  →  200 OK
```

The id in the URL/body/query is a **request**, never **proof**. The proof is the
signature on the token. ADMIN/HR pass ownership gates freely (they are allowed to
see everyone); EMPLOYEE passes only where the row belongs to them.

## 8. 401 vs 403 vs the rest

| Code | Meaning here | Raised by |
|---|---|---|
| **401** | no token / bad signature / expired / disabled at login | `authenticationEntryPoint` in each `SecurityConfig` |
| **403** | valid identity, role or ownership refuses | `accessDeniedHandler` (URL rules), `@PreAuthorize` (via `GlobalExceptionHandler`), `ForbiddenOperationException` (ownership/lifecycle) |
| **404** | authenticated fine, row does not exist | `ResourceNotFoundException` / `NotFoundException` family |
| **409** | business conflict (duplicate, already PAID) | `EmployeeServiceException` with CONFLICT |
| **400** | malformed input / unknown role | `@Valid` + `MethodArgumentNotValidException`, `InvalidRoleException` |
| **503** | employee-service unreachable during composition | `FeignException` handler |

All bodies share one shape: `{ timestamp, status, error, message }` — the frontend's
axios interceptor and toasts read `message`.

## 9. Why this project does it this way

| Decision | Why |
|---|---|
| JWT, stateless | any service can authenticate a request with no session store and no auth-service call |
| Shared signing secret | the services only *verify*; only auth-service *issues* |
| BCrypt, never SHA/plain | slow + salted per hash; verification only, never decryption |
| Role gates in SecurityConfig **and** `@PreAuthorize` | two independent locks — a remapped route cannot silently widen access |
| Ownership in the service layer | finer-grained than any URL pattern ("row #17 is yours") needs the data itself |
| `employeeId` claim in the token | lets every service resolve "me" without an extra auth-service call |
| Vague 401 on login failures | user-enumeration resistance |
| No gateway JWT check (current) | simpler learning topology; gateway-level verification is the documented *future* improvement |

Continue to the per-service docs: [services/AUTH_SERVICE.md](services/AUTH_SERVICE.md)
is the deep dive on everything above.
