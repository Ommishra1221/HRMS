# 03 · Database Architecture

> Last reviewed: written from current source code
> Source of truth: `*/src/main/resources/application.properties`, entity classes

## 1. The one fact that surprises everyone

All five services share **one PostgreSQL database** called `HRMS`, and each owns a
**private schema** inside it:

```
PostgreSQL server :5432
└── database "HRMS"
    ├── employee_schema    ← owned by employee-service (8081)
    ├── leave_schema       ← owned by leave-service     (8082)
    ├── attendance_schema  ← owned by attendance-service(8083)
    ├── payroll_schema     ← owned by payroll-service   (8084)
    └── auth_schema        ← owned by auth-service      (8085)
```

Each `application.properties` pins its service to exactly one schema:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/HRMS
spring.jpa.properties.hibernate.default_schema=employee_schema
spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true
```

`default_schema` makes Hibernate prefix **every** generated SQL statement with that
schema, and `create_namespaces=true` creates the schema on first boot. A service has
no JPA mappings for any other service's tables, so it cannot touch them.

> **Doc-vs-code note:** the older guides (and the diagrams above the code comments)
> speak of five separate databases (`employee_db`, `leave_db`, …). The *running code*
> uses the one-database/five-schemas layout shown here. Logically the rule is the
> same either way: **one owner per data slice, no direct cross-service SQL.**
> Connection details and credentials setup: [HRMS_DATABASE_SETUP.md](HRMS_DATABASE_SETUP.md).

## 2. What each schema contains (actual entities)

| Schema | Tables | JPA entity |
|---|---|---|
| employee_schema | `employees` | `Employee` (id, name, email UNIQUE, department) |
| leave_schema | `leaves` | `Leave` (id, employee_id, leave_type, from_date, to_date, reason, status) |
| attendance_schema | `attendance` | `Attendance` (id, employee_id, attendance_date, status, check_in, check_out) |
| payroll_schema | `payrolls` | `Payroll` (id, employee_id, month, basic_salary, allowances, deductions, payment_date, status) |
| auth_schema | `users`, `roles`, `users_roles` | `User`, `Role` |

`ddl-auto=update` creates/evolves these tables on startup. In production you would
use migration scripts (Flyway) instead — a documented future improvement.

## 3. Cross-service references are numbers, not foreign keys

```
leave_schema.leaves                 employee_schema.employees
┌─────────────────────┐             ┌──────────────────────┐
│ id            = 17  │             │ id           = 1     │
│ employee_id   = 1   ┼──── (soft) ─┼→ name  "Om Mishra"   │
│ leave_type = SICK    │   no FK,    │ email "om@x.com"     │
│ status    = PENDING  │   code only │ department "IT"      │
└─────────────────────┘             └──────────────────────┘
```

`Leave.employeeId` is `@Column(name="employee_id") Long` — no `@ManyToOne`, no
`@JoinColumn`, no constraint. Why:

- two schemas cannot share a foreign key constraint across service boundaries;
- a hard link would mean leave-service needs employee-schema *structure* knowledge;
- the number is enough — details are fetched live (Feign) when composing responses.

The same pattern exists in `Attendance.employeeId` and `Payroll.employeeId`, and in
`User.employeeId` (auth_schema → employee_schema).

## 4. The entity ↔ DTO rule at the database boundary

Entities never leave a service. Every controller hands back a **Response DTO**:

```
employee_schema.employees   →  Employee entity  →  EmployeeResponse DTO  →  JSON
auth_schema.users           →  User entity      →  UserResponse DTO     →  JSON
```

This is not pedantry: `User` holds a BCrypt hash. If entities were returned directly,
the hash would leak. DTOs are the waterproof wall.

## 5. Relationships inside one service

The only multi-table relationship in the whole project is auth's:

```
auth_schema.users        auth_schema.users_roles      auth_schema.roles
┌────────────┐          ┌──────────────────┐         ┌────────────────┐
│ id       1 │ 1 ──── * │ user_id │ role_id│ * ──── 1 │ id  name      │
│ username   │          └──────────────────┘         │ ROLE_ADMIN     │
│ password   │      (@JoinTable, auto-managed)       │ ROLE_HR        │
│ employee_id│                                        │ ROLE_EMPLOYEE  │
└────────────┘                                        └────────────────┘
```

Even here, roles are a closed set of exactly three rows, seeded by `DataSeeder`.

## 6. Why cross-service validation goes over HTTP

When leave-service receives `{"employeeId": 5, …}` it must be sure employee 5 exists.
It cannot `SELECT * FROM employee_schema.employees` — that breaks ownership — so:

```
leave-service                      employee-service
LeaveServiceImpl                   EmployeeController
   └─ fetchEmployeeOrThrow(5)         └─ GET /employees/5
        └─ EmployeeClient (Feign)  ─→     ↓
                                  EmployeeRepository
                                       ↓
                                  employee_schema.employees
```

- employee does not exist → employee-service answers 404 →
  `fetchEmployeeOrThrow` throws → caller answers **404** to the browser.
- employee-service is down → `FeignException` → caller answers **503**.

The browser never sees this choreography; it called one endpoint and got one answer.

## 7. Data-integrity rules enforced in code (because the DB can't)

| Rule | Where |
|---|---|
| One attendance row per employee per day | `AttendanceServiceImpl` duplicate check → 409 |
| One payslip per employee per month | `PayrollServiceImpl.findByEmployeeIdAndMonth` → 409 |
| netSalary = basic + allowances − deductions | `computeNetSalary()`, server-side |
| New leave starts PENDING | `LeaveServiceImpl.createLeave` |
| PAID payslips immutable (PUT/PATCH/DELETE all refuse) | `PayrollServiceImpl` → 409 |
| One login account per employee | `users.employee_id` UNIQUE + 409 check |
| Exactly one role per account | `setRoles(Set.of(role))` |

Continue to [04_SECURITY_AND_ROLES.md](04_SECURITY_AND_ROLES.md) or back to the
[learning path](README.md).
