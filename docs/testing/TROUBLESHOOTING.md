# Troubleshooting Guide

> Last reviewed: written from current source code

Ordered by "what you actually hit first". Every entry lists the real cause and the
real fix in this codebase.

## Startup & ordering

**Port already in use (`Web server failed to start. Port 8081 was already in use.`)**
Cause: a previous run is still alive.
Fix: kill the process on that port, or change `server.port` temporarily.

**Feign call fails immediately at startup-time request with `NameResolve`/503**
Cause: discovery-server not running, or the target service not yet registered.
Fix: start order — PostgreSQL → 8761 → 8081 → 8082/8083/8084 → 8085 → 8080 → 5173.
Check `http://localhost:8761` shows `EMPLOYEE-SERVICE` etc. as UP.

**Tables missing / schema empty**
Cause: wrong schema property, or the DB user lacks create rights.
Fix: verify `spring.jpa.properties.hibernate.default_schema=<own>_schema` and
`hbm2ddl.create_namespaces=true`; `ddl-auto=update` then creates tables on boot.

**`DataSeeder` didn't create accounts**
Cause: auth-service failed mid-startup (DB down) or you wiped only some tables.
Fix: the seeder is idempotent — restart auth-service; it recreates missing roles and
the three demo accounts.

## HTTP status decoder

| You see | Real causes in this project | Fix / next step |
|---|---|---|
| **401** on a protected call | no `Authorization` header; expired token (>24 h); tampered token; secret mismatch between services | re-login; verify `app.jwt.secret` is identical in all five properties files |
| **401** on login | wrong password, unknown username, or **disabled account** — all the same message on purpose | try `admin/Admin@123`; check `users.enabled` |
| **403** "Access denied…" | role gate: URL rule or `@PreAuthorize` refused your role | use the right account; check the matrix in `04_SECURITY_AND_ROLES.md` |
| **403** "You can only view/edit your own…" | ownership check in the service | expected for cross-employee access; verify the JWT's `employeeId` claim |
| **403** on user management | not ADMIN | only ADMIN reaches `/auth/users/**` |
| **404** | row doesn't exist, or you called the wrong path shape | through the gateway it's `/api/employees/...`; `/employees/me` only for employee-linked accounts |
| **409** | duplicate attendance day / duplicate payroll month / PAID payslip mutation / duplicate username-email-employeeId | read the message; it names the exact conflict |
| **400** | validation (`@NotBlank`, `@Email`, username `@Pattern`) or unknown role | fix the field named in `message` |
| **500** with `IllegalStateException: No authenticated user…` | filter chain misconfigured (filter didn't run) | check `SecurityConfig` still registers `JwtAuthenticationFilter` |
| **503** "Employee service is currently unavailable" | Feign couldn't reach employee-service | start 8081; check Eureka; then retry |

## CORS / frontend

**"blocked by CORS policy" in the browser console**
Cause: the request didn't come from `http://localhost:5173` (or `127.0.0.1:5173`), or
you bypassed the gateway and called a service port directly.
Fix: always call `http://localhost:8080/api/...`; the gateway owns the CORS config.

**Login works in Postman but the UI logs me straight out**
Cause: a 401 arrived on a later call — expired/invalid token, or a service rejected
the token (secret mismatch).
Fix: Network tab → find the 401 → follow the table above. The axios interceptor
redirects to `/login` *by design* on any protected-call 401.

**Buttons missing for the admin / employee sees "no permission" card**
Not a bug: role-based UI mirrors backend rules. Check the logged-in role chip in the
sidebar; employees legitimately have no Employees module or Users page.

**`GET /api/employees/me` returns 403 for admin/hr**
By design: those accounts have no employeeId link. Only employee-linked accounts
have a self-service profile.

## Data surprises

**Two attendance rows for the same employee/day? Impossible — but I got a 409!**
The service enforces one-record-per-day; the 409 *is* the enforcement working.

**A leave/payroll row shows "Unknown (id X)" in the UI**
The composed employee lookup failed (employee deleted, or employee-service was down
at read time). The row is intact; the name lookup is live and will recover.

**PAID payslip can't be edited or deleted**
By design — 409. PAID is terminal and immutable (PUT/PATCH/DELETE all refuse).

**A disabled user's token still works on the API**
Stateless JWT: the token is valid until `exp`. Role/ownership checks still constrain
it, and login is refused. (Killing in-flight tokens would need a token blacklist — a
future improvement.)

## Where to look while debugging

```
Gateway route didn't match?   api-gateway/application.properties (Path/StripPrefix)
Auth refused?                 service SecurityConfig → JwtAuthenticationFilter → JwtUtil
Role refused?                 SecurityConfig rule + @PreAuthorize on the controller
Data refused?                 *ServiceImpl (ownership, PENDING, duplicates, PAID)
Wrong status shape?           *GlobalExceptionHandler (JSON contract)
Data missing?                 Eureka dashboard → is the service registered?
```

## Still stuck?

1. Check the **console of the service that answered** (its logs name the layer).
2. Reproduce in **Postman** (removes the browser/CORS variables).
3. Compare with the expected flows in [02_REQUEST_FLOW.md](../02_REQUEST_FLOW.md).
4. Verify ports/registration at `http://localhost:8761`.
