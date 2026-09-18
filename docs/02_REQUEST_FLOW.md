# 02 · Request Flow

> Last reviewed: written from current source code
> Source of truth: controller/service/filter classes in each service

This document traces real requests end-to-end. Every name below is an actual class or
method in this repository.

## 0. The common path every request takes

```
Browser (axiosInstance adds Authorization: Bearer <JWT>)
   ↓
API Gateway :8080          Path=/api/{service}/** → StripPrefix=1 → lb://service-name
   ↓                       (header is forwarded, NOT verified here)
Service :8081-8085         JwtAuthenticationFilter — verify signature + exp
   ↓                       roles → authorities → SecurityContextHolder
SecurityConfig URL rules   coarse role gate (401 / 403 decided here)
   ↓
Controller                 thin: maps HTTP ↔ Java only
   ↓
ServiceImpl                business rules + OWNERSHIP check (CurrentUser)
   ↓
Repository                 derived queries
   ↓
Service's own schema       employee/leave/attendance/payroll/auth_schema
```

Status codes come from three layers: the security filter chain (401/403),
`@PreAuthorize` (403), and `GlobalExceptionHandler` (400/403/404/409/500) — plus
503 when a Feign call to employee-service fails.

---

## 1. LOGIN (the only public request)

```
Browser: POST /api/auth/login  {"username":"emp01","password":"Emp01@123"}
   ↓ Gateway → auth-service: POST /auth/login        (permitAll in SecurityConfig)
AuthController.login()
   ↓
AuthServiceImpl.login()
   ↓
AuthenticationManager.authenticate()
   ↓
CustomUserDetailsService.loadUserByUsername()
   ↓
UserRepository.findByUsername()          → auth_schema.users
   ↓
BCrypt compare( typed password, stored hash )
   ↓  (wrong password / unknown user / disabled account → SAME vague 401)
JwtUtil.generateToken(sub=username, userId, roles=[ROLE_…], employeeId?)
   ↓
AuthResponse { token, id, username, roles, employeeId }
   ↓
Browser: AuthContext stores token in localStorage.hrms_token
```

**Why the same 401 for every failure:** distinguishing "wrong password" from "no such
user" or "disabled" would let attackers enumerate valid usernames.

## 2. EMPLOYEE CREATION (a plain ADMIN CRUD write)

```
Browser: POST /api/employees  {"name":"…","email":"…","department":"…"}
   ↓ Gateway → employee-service: POST /employees
JwtAuthenticationFilter → authorities=[ROLE_ADMIN]
SecurityConfig + @PreAuthorize("hasRole('ADMIN')")    (HR/EMPLOYEE → 403)
   ↓
EmployeeController.createEmployee(@Valid EmployeeRequest)
   ↓  (@NotBlank validation fails → 400)
EmployeeServiceImpl.createEmployee()
   ↓
EmployeeRepository.save()      → INSERT INTO employee_schema.employees
   ↓
201 Created + EmployeeResponse JSON
```

Frontend: `EmployeeFormPage → EmployeeForm → employeeApi.createEmployee → axiosInstance`.

## 3. LEAVE CREATION (write + Feign validation + ownership)

```
Browser: POST /api/leaves  {"employeeId":1,"leaveType":"SICK","fromDate":"…","toDate":"…"}
   ↓ Gateway → leave-service: POST /leaves
JwtAuthenticationFilter → authorities (ADMIN **or** EMPLOYEE; HR → 403)
   ↓
LeaveController.createLeave()
   ↓
LeaveServiceImpl.createLeave()
   ├─ CurrentUser caller = CurrentUser.get()
   ├─ if EMPLOYEE: body employeeId MUST equal caller.employeeId()  → else 403
   ├─ fetchEmployeeOrThrow(employeeId)
   │     ↓ FeignTokenRelay adds the caller's JWT
   │     ↓ EmployeeClient → Eureka → employee-service: GET /employees/{id}
   │     ↓ (unknown employee → 404; employee-service down → 503)
   ├─ leave.setStatus("PENDING")            ← business rule
   └─ LeaveRepository.save()                → leave_schema.leaves
   ↓
201 Created + LeaveResponse (leave fields + composed employee object)
```

Note the composed response: `leave.employee.name` was fetched live over HTTP —
leave_schema stores only the id.

## 4. PAYROLL CREATION (server-side money)

```
Browser: POST /api/payroll  {"employeeId":1,"month":"2026-09","basicSalary":50000,…}
   ↓ Gateway → payroll-service: POST /payroll     (ADMIN only — HR/EMPLOYEE → 403)
PayrollController.createPayroll()
   ↓
PayrollServiceImpl.createPayroll()
   ├─ fetchEmployeeOrThrow(employeeId)          (Feign, 404/503 as above)
   ├─ duplicate check: findByEmployeeIdAndMonth → already exists → 409
   ├─ new Payroll { status = "PENDING" }
   └─ PayrollRepository.save()                  → payroll_schema.payrolls
   ↓
201 Created + PayrollResponse
```

**netSalary is never accepted from the client.** `PayrollRequest` has no such field;
`PayrollResponse.netSalary` is filled by `computeNetSalary()`:

```java
private BigDecimal computeNetSalary(Payroll payroll) {
    return payroll.getBasicSalary()
            .add(payroll.getAllowances())
            .subtract(payroll.getDeductions());
}
```

`BigDecimal` with `precision = 12, scale = 2` — never `double` — because money must
not suffer binary floating-point rounding errors.

## 5. EMPLOYEE SELF-SERVICE READ (ownership in action)

```
JWT (issued at login) contains: …,"roles":["ROLE_EMPLOYEE"],"employeeId":1…
   ↓
Browser: GET /api/leaves/17            ← the URL's "17" is a REQUEST, not PROOF
   ↓ Gateway → leave-service: GET /leaves/17
LeaveServiceImpl.getLeaveById(17)
   ├─ row loaded: leave.employeeId == 1
   ├─ CurrentUser.get().isEmployee() && 17's employeeId != 1?
   │        └─ if the row belonged to employee 2 → ForbiddenOperationException → 403
   └─ compose + return 200
```

The same pattern guards `GET /employees/{id}` (own id only),
`GET /employees/me` (id from JWT, no path variable at all), attendance and payroll
reads, and `?employeeId=` query filters — for an EMPLOYEE the filter is **forced**
to the JWT value, so a query parameter cannot widen the view.

```
ROLE AUTHORIZATION: "Is this role allowed to call this kind of endpoint at all?"
        (SecurityConfig URL rules + @PreAuthorize)
RESOURCE OWNERSHIP: "Does this specific row belong to the caller?"
        (ServiceImpl via CurrentUser — identity ONLY from the JWT)
```

## 6. EVERY OTHER CRUD LIFECYCLE (quick table)

| Action | Endpoint (via /api) | Role gate | Extra rules that can reject |
|---|---|---|---|
| List employees | `GET /employees` | ADMIN, HR | — |
| Read employee | `GET /employees/{id}` | ADMIN, HR, EMPLOYEE(own) | ownership |
| Update employee | `PUT /employees/{id}` | ADMIN | 404 |
| Delete employee | `DELETE /employees/{id}` | ADMIN | 404 |
| List leaves | `GET /leaves` | all three (employee → own rows) | — |
| Read leave | `GET /leaves/{id}` | all three (employee → own) | ownership |
| Update leave | `PUT /leaves/{id}` | ADMIN, EMPLOYEE(own) | ownership + PENDING only |
| Delete leave | `DELETE /leaves/{id}` | ADMIN, EMPLOYEE(own) | ownership + PENDING only |
| List attendance | `GET /attendance` | all three (employee → own) | — |
| Checkout | `PATCH /attendance/{id}/checkout` | ADMIN | 400 if before checkIn |
| List payroll | `GET /payroll` | all three (employee → own) | — |
| Mark PAID | `PATCH /payroll/{id}/paid` | ADMIN | 409 if already PAID |
| Update payslip | `PUT /payroll/{id}` | ADMIN | 409 if PAID; 409 duplicate month |
| Delete payslip | `DELETE /payroll/{id}` | ADMIN | 409 if PAID |
| Login | `POST /auth/login` | public | 401 |
| Who am I | `GET /auth/me` | any authenticated | — |
| User management | `/auth/users/**` (6 endpoints) | ADMIN | 409 duplicates, 403 self/last-admin rules |

Deeper reads: [services/AUTH_SERVICE.md](services/AUTH_SERVICE.md) for the security
filter chain, [04_SECURITY_AND_ROLES.md](04_SECURITY_AND_ROLES.md) for the full
role/ownership matrix.
