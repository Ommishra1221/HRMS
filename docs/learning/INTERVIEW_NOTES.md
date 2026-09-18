# Interview Notes — HRMS Edition

> Last reviewed: written from current source code

Concise, accurate answers grounded in this codebase. Practise saying them out loud.

## Architecture

**Q: Explain this project in 30 seconds.**
A five-service HRMS: Employee (directory), Leave, Attendance, Payroll, Auth — behind
a Spring Cloud Gateway (8080) with Eureka discovery (8761), one PostgreSQL database
split into five private schemas, and a React SPA that talks only to the gateway. JWT
authentication with three roles, and employee self-service enforced by ownership
checks against the token.

**Q: Why microservices here?**
Clean data ownership (five disjoint tables), independent deployment/scaling, and it
teaches each pattern (discovery, gateway, Feign, per-service security) in isolation.
The honest cost: network hops replace method calls, and cross-service reads need
composition.

**Q: Why database-per-service — and why schemas?**
Isolation of evolution: no shared tables means no hidden coupling. This deployment
uses one PostgreSQL instance with `hibernate.default_schema` per service — logically
equivalent to separate databases at a fraction of ops overhead; real production
could split instances without code changes.

**Q: Why store employeeId instead of a @ManyToOne to Employee?**
A cross-schema FK is impossible, and a JPA relation would drag employee structure
into leave-service. A plain Long keeps services decoupled; validity is checked over
HTTP (Feign) at write time, details fetched live for composition.

## Communication

**Q: What happens when POST /leaves is called?**
Gateway strips /api → leave-service's JWT filter authenticates → role gate
(ADMIN/EMPLOYEE only) → `LeaveServiceImpl.createLeave` → for employees the body's
employeeId must equal the JWT claim → Feign validates the employee exists (token
relayed) → status set to PENDING → saved to leave_schema → 201 with a composed
response embedding the employee object.

**Q: What if employee-service is down during that call?**
`FeignException` → handler → 503 to the browser. Writes never save an unvalidated
employee; reads that need names fail loudly rather than returning nameless rows.

**Q: Why Feign over RestTemplate/WebClient?**
Declarative: an interface + annotations, Eureka-name based, load-balanced for free.
See `EmployeeClient`.

## Security

**Q: Walk me through login.**
`AuthController.login` → `AuthenticationManager.authenticate` →
`CustomUserDetailsService` loads the user from auth_schema → enabled flag checked →
BCrypt compares → on success `JwtUtil.generateToken(sub, userId, roles, employeeId)`
→ AuthResponse. Every failure mode returns the same 401 message (anti-enumeration).

**Q: Why JWT? Why stateless?**
Any service can verify locally with the shared secret — no session store, no
auth-service call per request. 24-hour HS512 tokens.

**Q: How is authorization enforced — where exactly?**
Three layers: (1) `SecurityConfig` URL rules, (2) `@PreAuthorize` on methods,
(3) ownership checks in service implementations using `CurrentUser` — identity taken
only from the JWT's `employeeId` claim, never from URL/body/query values.

**Q: An employee sends employeeId=26 for leave — but their token says 25. What happens?**
403. On create the body id must match the claim; on update the service force-
overwrites the body id with the claim; the id in a request is a request, never proof.

**Q: How do you prevent someone promoting themselves to ADMIN?**
Roles change only through `/auth/users/**` (URL rule + class `@PreAuthorize`, both
ADMIN-only). The role value passes a compile-time enum whitelist (anything else 400),
and one role per account is enforced by replacement, not accumulation.

**Q: Why BCrypt instead of SHA-256?**
Designed for passwords: slow with a configurable work factor and a per-hash salt.
SHA is a fast general digest — wrong tool.

## Payroll specifics

**Q: Where is netSalary computed and why?**
In `PayrollServiceImpl.computeNetSalary` — `basic + allowances − deductions` with
BigDecimal. The request DTO has no netSalary field, so a client cannot influence it;
money is never trusted from the browser.

**Q: What does "PAID is immutable" mean in code?**
`markPaid` 409s on a second call; `updatePayroll` 409s on any PAID row; `deletePayroll`
409s on a PAID row. Only ADMIN reaches any of them (role gate).

**Q: One payslip per month — enforced where?**
`findByEmployeeIdAndMonth` checked on create and on update → 409. (A DB unique
constraint would be the hardening step.)

## Frontend

**Q: How does the SPA authenticate?**
AuthContext stores the JWT in localStorage; an axios request interceptor adds the
Bearer header; a 401 response interceptor clears the session and redirects to
/login. The token is refreshed from `/auth/me` on load.

**Q: Is hiding buttons security?**
No — it's UX. The backend re-checks everything; the UI mirrors server rules so users
never see dead controls.

**Q: Why do employee screens reuse /leaves, /attendance, /payrolls?**
The backend scopes employee tokens to their own rows — duplicating pages/routes would
add code, not security. The nav just labels them "My …".

## Debugging / ops questions

**Q: A service returns 401 right after startup — first suspects?**
Missing/expired token, or `app.jwt.secret` mismatch between services; then clock skew.

**Q: 503 on leave reads?**
employee-service down or not registered — check Eureka's dashboard at :8761.

**Q: 404 from the gateway but the service works on its own port?**
Path/StripPrefix mismatch: the gateway serves `/api/employees/**` and forwards
`/employees/**`; you probably called `/employees/**` through 8080.
