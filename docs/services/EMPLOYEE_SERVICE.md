# Employee Service

> Last reviewed: written from current source code
> Source of truth: `employee-service/src/main/java/com/example/microservices/employee/**`
> Service: employee-service · Port: 8081 · Database: HRMS / employee_schema

## 1. What is this service?
The **employee directory**: the single place that stores who works at the company —
name, email, department. It is the simplest CRUD service in HRMS and the template
every other service follows.

## 2. Why does it exist?
Employee master data is needed by *everything else* (leaves, attendance, payroll all
reference an employee). Centralising it in one service — with one owner and one API —
means every other service asks it over HTTP instead of keeping its own copy.

## 3. What does this service own?
- **Database:** `employee_schema` (inside the shared `HRMS` database) — only the
  `employees` table.
- **Entities:** `Employee`.
- **Business responsibility:** CRUD on the directory + EMPLOYEE self-service profile.
- **What it does NOT own:** leaves, attendance, payslips, user accounts. It knows
  nothing about them; other services merely store its id.

## 4. Port and configuration
```properties
spring.application.name=employee-service
server.port=8081
spring.jpa.properties.hibernate.default_schema=employee_schema
app.jwt.secret=hrms-learning-demo-secret-…        # same as auth-service: verify-only
eureka.client.service-url.defaultZone=http://localhost:8761/eureka
```
Gateway route: `Path=/api/employees/** → lb://employee-service, StripPrefix=1`.
Eureka: registers itself; fetches registry (no Feign needed here).

## 5. Folder structure
```
employee-service/src/main/java/com/example/microservices/employee/
├── EmployeeServiceApplication.java   @SpringBootApplication + @EnableDiscoveryClient
├── config/SecurityConfig.java        URL rules, 401/403 JSON writers
├── controller/EmployeeController.java  thin HTTP layer + @PreAuthorize
├── service/EmployeeService.java + EmployeeServiceImpl.java   ALL business logic
├── repository/EmployeeRepository.java  extends JpaRepository
├── entity/Employee.java              one row = one employee
├── dto/EmployeeRequest.java, EmployeeResponse.java
├── security/JwtUtil.java             verify-only token checks
├── security/JwtAuthenticationFilter.java  Bearer → SecurityContext
├── security/CurrentUser.java         the identity used for ownership checks
└── exception/ResourceNotFoundException.java, ForbiddenOperationException.java,
              GlobalExceptionHandler.java
```
`config` = Spring wiring; `controller` = HTTP in/out; `service` = rules;
`repository` = SQL; `dto` = API shapes; `security` = JWT plumbing;
`exception` = error translation.

## 6. Database
```
employee_schema.employees
┌────────────┬──────────────┬─────────────────────────────┐
│ column     │ type         │ notes                       │
├────────────┼──────────────┼─────────────────────────────┤
│ id         │ BIGSERIAL PK │ GenerationType.IDENTITY     │
│ name       │ VARCHAR      │ NOT NULL                    │
│ email      │ VARCHAR      │ NOT NULL, UNIQUE            │
│ department │ VARCHAR      │ NOT NULL                    │
└────────────┴──────────────┴─────────────────────────────┘
```
**Cross-service references:** other schemas store `employee_id` as a plain number
(leave/attendance/payroll) and `users.employee_id` in auth_schema points here.
This service stores *no* outbound references — it is the root of the graph.

## 7. Entity — `Employee`

| Field | WHAT | WHY | WHO SETS IT | WHO MAY CHANGE IT |
|---|---|---|---|---|
| `id` | surrogate PK | stable reference other services store | DB (`IDENTITY`) | nobody — immutable |
| `name` | display name | shown everywhere (lists, payslips) | ADMIN via POST/PUT | ADMIN only |
| `email` | work email | contact + natural uniqueness | ADMIN via POST/PUT | ADMIN only (unique → 409 risk is handled at account level, DB constraint here) |
| `department` | org unit | filters, org charts | ADMIN via POST/PUT | ADMIN only |

There is deliberately no `status`/`enabled` here — account enable/disable lives in
auth-service's `User.enabled`, a different concern in a different service.

## 8. DTOs
- **`EmployeeRequest`** (inbound, POST/PUT body): `name`, `email`, `department` —
  `@NotBlank` validation → 400 before the service runs. Why a DTO and not the entity:
  `id` must not be client-settable, and the request shape is a *contract*, not a
  database row.
- **`EmployeeResponse`** (outbound): `id`, `name`, `email`, `department`. Why not the
  entity: decouples API from storage; today identical fields, tomorrow you can add
  computed fields without touching the table.
- The Feign-facing shape of the *same* response is what other services embed in
  their own responses (`leave.employee.name`).

## 9. Repository
```java
public interface EmployeeRepository extends JpaRepository<Employee, Long> { }
```
No custom methods — `findAll()`, `findById()`, `save()`, `deleteById()` (and
`existsById()`) from `JpaRepository` cover every need. Each derived method represents
standard SQL: `findAll` → `SELECT * FROM employees`, `findById` → `… WHERE id = ?`,
`save` → `INSERT` or `UPDATE` depending on whether the entity has an id.

## 10. Service layer — `EmployeeServiceImpl` (the most important section)

```
Request → @Valid DTO → @PreAuthorize (role) → ServiceImpl
   → ownership check (CurrentUser) → Repository → employee_schema → Response DTO
```

- **`createEmployee`** — ADMIN only. Map request → entity, `save()` (DB generates
  `id`), return response.
- **`getAllEmployees`** — ADMIN/HR. Straight `findAll()` mapped to DTOs.
- **`getMyProfile`** — self-service. `CurrentUser.get()`; if the account has **no
  employeeId claim** → `ForbiddenOperationException` (403) "not linked to an employee
  profile"; loads `findById(caller.employeeId())` — **no id arrives from the client
  at all**.
- **`getEmployeeById(id)`** — the ownership showcase:
  ```java
  CurrentUser caller = CurrentUser.get();
  if (caller.isEmployee() && !id.equals(caller.employeeId())) {
      throw new ForbiddenOperationException("Employees may only view their own profile");
  }
  ```
  The path id is a request, the JWT is the proof. `20 != 10` → 403. Then normal
  `findById` (missing → 404).
- **`updateEmployee` / `deleteEmployee`** — ADMIN only (`@PreAuthorize` already
  rejected everyone else); update overwrites the three fields; delete checks
  `existsById` first for a clean 404.

## 11. Controller — `EmployeeController`

| METHOD PATH | PURPOSE | BODY | SUCCESS | FAILURE | AUTHORIZATION |
|---|---|---|---|---|---|
| `POST /employees` | create | EmployeeRequest | 201 + EmployeeResponse | 400 validation | ADMIN |
| `GET /employees` | list all | — | 200 + list | — | ADMIN, HR |
| `GET /employees/me` | own profile from JWT | — | 200 | 403 (no link) | authenticated |
| `GET /employees/{id}` | read one | — | 200 | 403 ownership / 404 | ADMIN, HR, EMPLOYEE-own |
| `PUT /employees/{id}` | update | EmployeeRequest | 200 | 400 / 404 | ADMIN |
| `DELETE /employees/{id}` | delete | — | 204 | 404 | ADMIN |

Every method carries `@PreAuthorize` **and** the URL rule exists in SecurityConfig —
two independent locks.

## 12. Exception handling
- `ResourceNotFoundException` → **404** (missing id).
- `ForbiddenOperationException` → **403** (ownership/self-service refusals).
- `MethodArgumentNotValidException` → **400** (field validation).
- `AccessDeniedException` → **403** (`@PreAuthorize` fired inside the servlet —
  without this handler the catch-all would return 500).
- `Exception` → **500** catch-all.
All produce `{ timestamp, status, error, message }`.

## 13. Service-to-service communication
**Inbound only.** This service never calls out (no Feign). It *is* the Feign target
for leave/attendance/payroll. Those callers relay the original user's JWT, so an
EMPLOYEE's internal lookup is authenticated *as that employee* — and the ownership
check you see in §10 is what keeps that lookup limited to their own record.

## 14. Full request lifecycle (real endpoints)
- **CREATE:** `POST /api/employees` → gateway strips `/api` → `POST /employees` →
  filter → `hasRole('ADMIN')` → `createEmployee` → `save()` → `201`.
- **READ:** `GET /api/employees/1` (ADMIN/HR: 200; EMPLOYEE: own id only, else 403) /
  `GET /api/employees/me` (JWT-resolved).
- **UPDATE:** `PUT /api/employees/1` → ADMIN → full overwrite → 200.
- **DELETE:** `DELETE /api/employees/1` → ADMIN → 204. (Referencing rows elsewhere
  keep the id; their Feign lookups of a deleted employee now return 404 → composed
  responses show "employee lookup failed".)

## 15. Frontend connection
```
EmployeeList.jsx → useEmployees() → employeeApi.getEmployees() → axiosInstance
  → GET http://localhost:8080/api/employees → gateway → GET /employees → this service
```
Write buttons render for ADMIN only (`isAdmin` from `useAuth()`), mirroring the
backend rules; `MyProfile.jsx` calls `getMyProfile()` (`GET /api/employees/me`).

## 16. Security / role rules
ADMIN: full CRUD. HR: read-only. EMPLOYEE: own profile only (`/me` or own id).
See [04_SECURITY_AND_ROLES.md](../04_SECURITY_AND_ROLES.md) for the full matrix.

## 17. Beginner mistakes
- Returning the entity instead of `EmployeeResponse`.
- Doing the ownership check in the controller — it belongs in the service with
  `CurrentUser`.
- Trying to create a `@ManyToOne` from another service to `Employee` — impossible
  and wrong across schemas.
- Forgetting that `/employees/me` must be matched **before** `/employees/{id}` in
  SecurityConfig ("me" would be parsed as an id).
- Confusing HR's read-only access with no access (HR lists the directory fine).

## 18. Interview questions
- **Why is this its own service?** Employee master data is the root reference of the domain; one owner, one API, one schema.
- **Why is there no FK from leaves to employees?** Different schemas/services; PostgreSQL can't enforce it — code validates via HTTP instead.
- **How does an employee see only their profile?** `/employees/me` resolves the id from the JWT's `employeeId` claim; `getEmployeeById` compares the path id against the claim and 403s.
- **Why are security rules in both the URL config and `@PreAuthorize`?** Defense in depth: a remapped route can't silently widen access.
- **What if employee-service is down?** Callers' Feign lookups fail → they answer 503; employee data is unavailable but nothing else corrupts.

## 19. Quick revision
1. Port 8081, schema `employee_schema`, one table `employees`.
2. Root of the data graph — stores no outbound references.
3. `EmployeeRepository` has zero custom methods.
4. `/employees/me` = JWT-resolved self-service (ADMIN/HR → 403).
5. Ownership: `caller.isEmployee() && !id.equals(caller.employeeId())` → 403.
6. Writes are ADMIN-only; HR read-only.
7. `ForbiddenOperationException` → 403; `ResourceNotFoundException` → 404.
8. `AccessDeniedException` handler prevents 500-instead-of-403.
9. Feign target of three services, with the caller's token relayed.
10. Email UNIQUE at DB level.

## 20. One-minute explanation
"Employee-service is the directory — one table in employee_schema, port 8081. It's the
simplest service and the pattern for the rest: a thin controller, a service that holds
every rule, a JpaRepository, DTOs at the boundary, and the shared JWT filter. It owns
nothing but employees; three other services store its id and fetch details over Feign,
relaying the caller's token so ownership still applies. Authorization is two-layered:
SecurityConfig and `@PreAuthorize` decide role access, and for EMPLOYEE tokens the
service compares the requested id with the `employeeId` claim from the JWT — the path
is a request, the token is the proof."
