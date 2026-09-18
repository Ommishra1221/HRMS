# Leave Service

> Last reviewed: written from current source code
> Source of truth: `leave-service/src/main/java/com/example/microservices/leave/**`
> Service: leave-service · Port: 8082 · Database: HRMS / leave_schema

## 1. What is this service?
Records **leave requests** (SICK / CASUAL / EARNED with a date range and a status).
It is the project's showcase service: it combines **Feign data composition**, the
**PENDING lifecycle**, and the **strictest ownership rules**.

## 2. Why does it exist?
Leave is its own business area with its own data, rules (statuses, who-may-edit-what)
and lifecycle. Isolating it keeps employee data untouched by leave logic and lets the
two evolve independently.

## 3. What does this service own?
- **Database:** `leave_schema` — only the `leaves` table.
- **Entities:** `Leave`.
- **Business responsibility:** apply-for-leave, list/read (role-scoped), edit/delete
  under the PENDING rule.
- **What it does NOT own:** employee records (it stores `employee_id` and calls
  employee-service for details), attendance, payroll, users.

## 4. Port and configuration
```properties
spring.application.name=leave-service
server.port=8082
spring.jpa.properties.hibernate.default_schema=leave_schema
app.jwt.secret=…                        # shared secret (verify-only service)
eureka.client.service-url.defaultZone=http://localhost:8761/eureka
```
Gateway route: `Path=/api/leaves/** → lb://leave-service, StripPrefix=1`.
OpenFeign + LoadBalancer dependencies in `pom.xml` (employee-service lookup).

## 5. Folder structure
Same skeleton as employee-service (config / controller / service / repository /
entity / dto / security / exception) plus one extra package:

```
└── client/EmployeeClient.java     the Feign interface - the cross-service bridge
```

## 6. Database
```
leave_schema.leaves
┌─────────────┬──────────────┬────────────────────────────────┐
│ column      │ type         │ notes                          │
├─────────────┼──────────────┼────────────────────────────────┤
│ id          │ BIGSERIAL PK │                                │
│ employee_id │ BIGINT       │ NOT NULL - plain number, no FK │
│ leave_type  │ VARCHAR      │ SICK / CASUAL / EARNED         │
│ from_date   │ DATE         │ NOT NULL                       │
│ to_date     │ DATE         │ NOT NULL                       │
│ reason      │ VARCHAR      │ optional                       │
│ status      │ VARCHAR      │ PENDING (created) / APPROVED / │
│             │              │ REJECTED                       │
└─────────────┴──────────────┴────────────────────────────────┘
```
Cross-service reference: `employee_id` → employee_schema (validated via Feign).

## 7. Entity — `Leave`

| Field | WHAT | WHY | WHO SETS IT | WHO MAY CHANGE IT |
|---|---|---|---|---|
| `id` | PK | reference | DB | nobody |
| `employeeId` | whose leave | ownership + composition | EMPLOYEE: forced to JWT value; ADMIN: any | ADMIN (employee edits can't move it) |
| `leaveType` | SICK/CASUAL/EARNED | policy category | requester (or ADMIN) | owner while PENDING, ADMIN always |
| `fromDate`/`toDate` | the range | the actual request | requester | owner while PENDING, ADMIN always |
| `reason` | explanation | reviewer context | requester | owner while PENDING, ADMIN always |
| `status` | PENDING/APPROVED/REJECTED | lifecycle | service sets PENDING on create | no approve API exists yet (see §10 note) |

## 8. DTOs
- **`LeaveRequest`** (in): `employeeId` `@NotNull`, `leaveType` `@NotBlank`,
  `fromDate`/`toDate` `@NotNull`, `reason` optional. For an EMPLOYEE call the
  `employeeId` in the body must equal the JWT's — otherwise 403; the server,
  not the client, is the authority on identity.
- **`LeaveResponse`** (out): all leave fields **plus a composed `employee` object**
  (id/name/email/department fetched live via Feign). A missing employee is rendered
  by the UI as "employee lookup failed" instead of failing the whole list.

## 9. Repository
```java
public interface LeaveRepository extends JpaRepository<Leave, Long> {
    List<Leave> findByEmployeeId(Long employeeId);
}
```
`findByEmployeeId` is a **derived query** — Spring Data generates
`SELECT * FROM leaves WHERE employee_id = ?` from the method name. It is the
ownership-scoped "list my leaves" query (the employeeId comes from the JWT).

## 10. Service layer — `LeaveServiceImpl`

```
POST /leaves  →  role gate (ADMIN|EMPLOYEE)  →  createLeave()
   ├─ CurrentUser: if EMPLOYEE → body employeeId MUST equal JWT employeeId (else 403)
   ├─ fetchEmployeeOrThrow(employeeId)      ← Feign validation (404 / 503)
   ├─ status = "PENDING"                    ← business rule
   └─ save() → 201 (response includes composed employee)

GET /leaves  →  getAllLeaves()
   └─ EMPLOYEE? findByEmployeeId(JWT employeeId)  :  findAll()

GET /leaves/{id}  →  getLeaveById()
   ├─ findById → 404 if absent
   ├─ EMPLOYEE && row.employeeId != JWT employeeId → 403
   └─ compose employee via Feign → 200

PUT /leaves/{id}  →  updateLeave()
   ├─ 404 if absent
   ├─ EMPLOYEE: ownership 403 → PENDING-only 403 → employeeId FORCE-OVERWRITTEN
   │            with the JWT value (edits are content-only)
   ├─ ADMIN may re-assign employeeId (existence re-validated via Feign)
   └─ save → 200

DELETE /leaves/{id}  →  deleteLeave()
   └─ 404 → EMPLOYEE: ownership 403 + PENDING-only 403 → delete → 204
```

Business rules in plain language:
1. **A new leave is always PENDING.** (Note: there is **no approve/reject endpoint
   yet** — current implementation; a `PATCH /leaves/{id}/approve` ADMIN endpoint is
   the natural next step.)
2. **Employees can only be themselves.** Body identity ≠ JWT identity → 403, on
   create *and* on edit.
3. **Self-service ends when the leave stops being PENDING.** Approved/rejected
   requests are frozen for the owner; ADMIN keeps full control.

## 11. Controller — `LeaveController`

| METHOD PATH | PURPOSE | SUCCESS | FAILURE | AUTHORIZATION |
|---|---|---|---|---|
| `POST /leaves` | apply | 201 + LeaveResponse | 400 / 403 / 404 / 503 | ADMIN, EMPLOYEE |
| `GET /leaves` | list (role-scoped) | 200 + list | — | ADMIN, HR, EMPLOYEE |
| `GET /leaves/{id}` | read one | 200 | 403 / 404 / 503 | ADMIN, HR, EMPLOYEE-own |
| `PUT /leaves/{id}` | edit | 200 | 403 (own+PENDING) / 404 | ADMIN, EMPLOYEE-own |
| `DELETE /leaves/{id}` | withdraw | 204 | 403 (own+PENDING) / 404 | ADMIN, EMPLOYEE-own |

## 12. Exception handling
`ResourceNotFoundException` → 404 · `ForbiddenOperationException` → 403 (ownership /
PENDING) · `EmployeeServiceException` → passthrough (404/409/…) · `FeignException` →
**503** "Employee service is currently unavailable" · `AccessDeniedException` → 403 ·
validation → 400 · catch-all → 500.

## 13. Service-to-service communication (the Feign showcase)
```
LeaveServiceImpl.fetchEmployeeOrThrow(5)
   ↓
EmployeeClient (interface - Feign builds the HTTP client at startup)
   ↓  FeignTokenRelay adds "Authorization: Bearer <caller's JWT>"
Eureka: "employee-service" → 8081 (LoadBalancer picks an instance)
   ↓
employee-service: GET /employees/5   (its own security runs: role+ownership)
   ↓
EmployeeResponse JSON → embedded into LeaveResponse.employee
```
Not-found → 404 to the browser; unreachable → 503. The relay matters: the internal
call happens *as the original user*, so employee-service's ownership checks still
apply — there is no trusted "service account" backdoor.

## 14. Full request lifecycle
- **CREATE:** `POST /api/leaves` → 201 (rules above).
- **READ:** `GET /api/leaves` — ADMIN/HR see everything, EMPLOYEE silently receives
  only their own rows; `GET /api/leaves/17` — 200/403/404.
- **UPDATE:** `PUT /api/leaves/17` — employee edits a PENDING own row → 200; an
  APPROVED one → 403 "Only PENDING…"; another employee's row → 403.
- **DELETE:** `DELETE /api/leaves/17` — same guards → 204 or 403.

## 15. Frontend connection
```
LeaveList.jsx → useLeaves() → leaveApi.getLeaves() → GET /api/leaves
LeaveFormPage → leaveApi.createLeave()/updateLeave()
LeaveDetail   → leaveApi.getLeave(id) / deleteLeave(id)
```
The form has an **employee mode**: for EMPLOYEE the picker is replaced with a
read-only "You (own employee record)" field, the payload id comes from
`useAuth().employeeId` (the JWT claim surfaced by AuthContext), `useEmployees(false)`
skips the ADMIN-only directory call, and non-PENDING requests show a lock alert with
a disabled submit.

## 16. Security / role rules
ADMIN: full CRUD, any employee. HR: read-only. EMPLOYEE: own rows only, PENDING-only
edits/deletes, identity always forced from the JWT. See
[04_SECURITY_AND_ROLES.md](../04_SECURITY_AND_ROLES.md).

## 17. Beginner mistakes
- Trusting `request.employeeId` for an employee call (the service must force it).
- Doing the Feign call before the ownership check (wasted HTTP + error-order bugs).
- Returning `Leave` instead of `LeaveResponse` (no employee composition, leaks shape).
- Forgetting the `FeignException` → 503 translation and showing raw stack traces.
- Assuming employees can edit APPROVED leave — they cannot; only ADMIN could (and
  currently no API changes status at all).

## 18. Interview questions
- **Why Feign instead of RestTemplate?** Declarative interface + Eureka name lookup + load balancing with zero client code; see `EmployeeClient`.
- **How do you know employee 5 exists?** `fetchEmployeeOrThrow` — an HTTP check through Feign; 404 propagates, downtime becomes 503.
- **Why store employeeId and not the employee object?** Leave owns leave data; embedding a copy would go stale and violate database-per-service.
- **Where is the ownership rule?** In `LeaveServiceImpl`, comparing `leave.employeeId` with `CurrentUser.employeeId()` (the JWT claim) — never the URL or body.
- **Why can't HR apply leave for someone?** POST/PUT/DELETE are gated `hasAnyRole('ADMIN','EMPLOYEE')` — HR is read-only by design.

## 19. Quick revision
1. Port 8082, `leave_schema`, one table.
2. `EmployeeClient` = Feign; Eureka resolves the name.
3. `fetchEmployeeOrThrow` → 404/503 semantics.
4. New leaves are PENDING; no approve API exists yet.
5. GET scoped per role; employee list is silently scoped via `findByEmployeeId`.
6. Ownership + PENDING checks in the service, identity from the JWT only.
7. Edits force-overwrite employeeId for employees.
8. Composed response embeds a live employee object.
9. HR never writes leaves.
10. `FeignTokenRelay` forwards the caller's token on every Feign call.

## 20. One-minute explanation
"Leave-service owns the leaves table on 8082. It stores just an employeeId and asks
employee-service for details through a Feign client — a Java method call that becomes
a load-balanced HTTP request via Eureka, carrying the caller's own JWT. On create it
validates the employee over HTTP, forces a PENDING status, and for employee callers
overwrites the body's employeeId with the JWT's claim — the client never decides
identity. Reads are role-scoped, and employees may edit or delete only their own
PENDING requests; those checks live in LeaveServiceImpl using CurrentUser, not in the
URL rules."
