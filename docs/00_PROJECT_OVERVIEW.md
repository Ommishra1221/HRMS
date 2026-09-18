# 00 · Project Overview

> Last reviewed: written from current source code (September 2026 state of the repo)
> Source of truth: this repository's actual source code — not the older guide files

## 1. What is HRMS?

HRMS (**Human Resource Management System**) is a small but complete company-HR platform:

- an ADMIN maintains the **employee directory**,
- employees **apply for leave**, which is recorded and reviewed,
- the company records **daily attendance** (check-in / check-out),
- the company generates monthly **payslips** and marks them paid,
- accounts are **created by an administrator** — there is no public signup.

Instead of one big Spring Boot application, it is split into **five independent
microservices** behind a **single API Gateway**, with a **React** frontend.

## 2. The services at a glance

| Service | Port | Database (logical) | Responsibility |
|---|---:|---|---|
| Discovery Server (Eureka) | 8761 | — | Service discovery ("phone book") |
| API Gateway | 8080 | — | Single entry point for the browser |
| Employee Service | 8081 | employee_schema | Employee master data |
| Leave Service | 8082 | leave_schema | Leave requests |
| Attendance Service | 8083 | attendance_schema | Daily attendance records |
| Payroll Service | 8084 | payroll_schema | Monthly payslips |
| Auth Service | 8085 | auth_schema | Login, accounts, roles, JWT |
| React Frontend | 5173 | — | The user interface |

> **Naming note (doc vs code):** older documentation called the databases
> `employee_db`, `leave_db`, … as if they were five separate PostgreSQL databases.
> The actual code uses **one** PostgreSQL database named `HRMS` with **five private
> schemas** (`employee_schema`, `leave_schema`, `attendance_schema`, `payroll_schema`,
> `auth_schema`). Isolation is by schema, not by database — see
> [03_DATABASE_ARCHITECTURE.md](03_DATABASE_ARCHITECTURE.md).

## 3. What each role can do (business view)

There are exactly three roles — no signup, only login:

- **ADMIN** — full write authority: manages employees, leaves, attendance, payroll,
  and user accounts (create accounts, change roles, enable/disable).
- **HR** — operational read-only: views employees, leaves, attendance and payroll;
  never writes.
- **EMPLOYEE** — self-service only: views **their own** profile/leave/attendance/payroll,
  may apply for leave and edit/delete their **own PENDING** leave. Never sees anyone
  else's data.

Full rules: [04_SECURITY_AND_ROLES.md](04_SECURITY_AND_ROLES.md).

## 4. The five business rules every service enforces

1. **A new leave is always PENDING** (`LeaveServiceImpl.createLeave`).
2. **One attendance record per employee per day** (409 on duplicates,
   `AttendanceServiceImpl`).
3. **One payslip per employee per month** (409 on duplicates,
   `PayrollServiceImpl`).
4. **netSalary is computed by the server** as `basic + allowances − deductions`,
   with `BigDecimal` — the browser never sends it.
5. **PAID is terminal and immutable** — a paid payslip cannot be re-paid, edited
   or deleted (409 in `markPaid`, `updatePayroll`, `deletePayroll`).

## 5. Technology stack (all actually used)

| Layer | Technology | Where |
|---|---|---|
| Backend | Java + Spring Boot (Boot 4.1.x line, Spring Security 7-style config) | all services |
| Data | Spring Data JPA + PostgreSQL + Hibernate (`ddl-auto=update`) | all services |
| Discovery | Netflix Eureka (`discovery-server`) | :8761 |
| Routing | Spring Cloud Gateway (WebFlux) | :8080 |
| Inter-service calls | OpenFeign + Spring Cloud LoadBalancer | leave/attendance/payroll → employee |
| Security | Spring Security, BCrypt, JJWT (HS512) | auth + all services |
| Frontend | React 19 + Vite + React Router, plain CSS design system | :5173 |
| HTTP client | Axios (single `axiosInstance` with a JWT interceptor) | frontend |

## 6. How to run the whole system

Startup order matters (each service registers with Eureka and needs the DB up):

```
1. PostgreSQL (database HRMS on localhost:5432)
2. discovery-server        :8761
3. employee-service        :8081
4. leave-service           :8082
5. attendance-service      :8083
6. payroll-service         :8084
7. auth-service            :8085
8. api-gateway             :8080
9. hrms-frontend           :5173   (npm install && npm run dev)
```

Seeded demo accounts (created by `DataSeeder` in auth-service):

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@123` | ROLE_ADMIN |
| `hr` | `Hr@123` | ROLE_HR |
| `emp01` | `Emp01@123` | ROLE_EMPLOYEE (linked to employee id 1) |

> The `DataSeeder` originals (`admin123` / `hr123` / `employee123`) were rotated
> through the ADMIN user-management API, and `employee` was renamed `emp01`.
> This local database also has extra demo accounts: `hr02` / `Hr02@123` and
> `emp02`–`emp06` (linked to employees 2–6).

Then open `http://localhost:5173` and sign in. Eureka's dashboard at
`http://localhost:8761` shows every registered instance.

## 7. Where to go next

Continue to [01_MICROSERVICES_ARCHITECTURE.md](01_MICROSERVICES_ARCHITECTURE.md).
