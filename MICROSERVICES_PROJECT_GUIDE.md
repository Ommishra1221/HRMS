# HRMS — Microservices Project Guide (Master Guide)

> Last reviewed: rewritten from current source code (September 2026)
> Source of truth: this repository's actual source code
>
> **This is the high-level entry point.** Detailed, per-service documentation lives in
> [`docs/`](docs/README.md) — this guide explains the system and links to it.

---

## 1. What is this project?

HRMS (**Human Resource Management System**) — a company-HR platform built as five
independent Spring Boot microservices plus a React frontend:

- **Employee** master data (the directory),
- **Leave** requests (apply → PENDING → reviewed),
- **Attendance** (one record per employee per day, check-in/check-out),
- **Payroll** (monthly payslips, server-computed net salary, PENDING → PAID),
- **Auth** (login, accounts, roles — **no public signup**),
- an **API Gateway** (8080) as the single browser entry point,
- **Eureka** (8761) for service discovery,
- a **React + Vite** frontend (5173) that talks only to the gateway.

## 2. Architecture at a glance

```
React Frontend :5173
        │   Authorization: Bearer <JWT>  (axios interceptor)
        ▼
API Gateway :8080   ── Path=/api/{service}/** , StripPrefix=1 , lb://… ──┐
        │                                                               │
        ▼                                                        Eureka :8761
┌──────────────────────────────────────────────────────────────────┐   (registry:
│ Employee :8081   Leave :8082   Attendance :8083                  │    who is up,
│ employee_schema  leave_schema   attendance_schema                │    where)
│                                                                  │
│ Payroll :8084                                    Auth :8085      │
│ payroll_schema                                   auth_schema     │
└──────────────────────────────────────────────────────────────────┘
        One PostgreSQL database "HRMS" — each service owns ONE private schema
        (Leave/Attendance/Payroll call Employee over OpenFeign; Auth calls nobody)
```

### Service map (values verified from `application.properties`)

| Service            | Port | Database (schema in `HRMS`) | Responsibility          | Doc |
|--------------------|-----:|-----------------------------|-------------------------|-----|
| Discovery Server   | 8761 | —                           | Service discovery       | [docs/services/DISCOVERY_SERVER.md](docs/services/DISCOVERY_SERVER.md) |
| API Gateway        | 8080 | —                           | Single entry point      | [docs/services/API_GATEWAY.md](docs/services/API_GATEWAY.md) |
| Employee Service   | 8081 | employee_schema             | Employee master data    | [docs/services/EMPLOYEE_SERVICE.md](docs/services/EMPLOYEE_SERVICE.md) |
| Leave Service      | 8082 | leave_schema                | Leave management        | [docs/services/LEAVE_SERVICE.md](docs/services/LEAVE_SERVICE.md) |
| Attendance Service | 8083 | attendance_schema           | Attendance tracking     | [docs/services/ATTENDANCE_SERVICE.md](docs/services/ATTENDANCE_SERVICE.md) |
| Payroll Service    | 8084 | payroll_schema              | Payroll / payslips      | [docs/services/PAYROLL_SERVICE.md](docs/services/PAYROLL_SERVICE.md) |
| Auth Service       | 8085 | auth_schema                 | Authentication/security | [docs/services/AUTH_SERVICE.md](docs/services/AUTH_SERVICE.md) |
| React Frontend     | 5173 | —                           | User interface          | [docs/frontend/FRONTEND_GUIDE.md](docs/frontend/FRONTEND_GUIDE.md) |

> **Terminology note:** older text in this repo said `employee_db`, `leave_db`, … as
> if they were separate databases. The running code uses **one** database (`HRMS`)
> with **five private schemas** — see
> [docs/03_DATABASE_ARCHITECTURE.md](docs/03_DATABASE_ARCHITECTURE.md).

## 3. The core principles (each proven by code)

| Principle | How the code proves it |
|---|---|
| Frontend talks only to the Gateway | `axiosInstance` baseURL `:8080`; no service port appears in the frontend |
| Gateway routes, services verify | 5 route entries with `lb://` + `StripPrefix=1`; JWT verified inside each service |
| Services register with Eureka | `eureka.client.service-url.defaultZone=…:8761/eureka` in all six backend apps |
| Feign for cross-service reads | `client/EmployeeClient.java` in leave/attendance/payroll, name-based lookup |
| Auth uses no Feign | auth-service has no client package and no outbound HTTP |
| Database per service | `hibernate.default_schema` per service; entities hold plain `employeeId` numbers, no cross-schema FKs |
| DTOs at API boundaries | `*Request` (validated) and `*Response` DTOs; entities (e.g. password hashes) never leave a service |
| Business rules in service impls | PENDING default, one-per-day/month duplicates, PAID immutability, ownership checks — all in `*ServiceImpl` |
| Thin controllers | controllers map HTTP ↔ Java and delegate; no SQL, no rules |
| JWT authentication | shared `app.jwt.secret`; `JwtAuthenticationFilter` in all five services; only auth-service issues |
| Spring Security authorization | `SecurityConfig` URL rules + `@PreAuthorize` + ownership checks in code |

## 4. Authentication and roles (short version)

- **Login is the only public endpoint** (`POST /auth/login`). There is no signup —
  an ADMIN creates every account (`/auth/users/**`, ADMIN-only, double-locked).
- Login issues a **24-hour HS512 JWT** with `sub`, `userId`, exactly one role, and
  `employeeId` when the account is linked to an employee.
- Exactly three roles exist (`RoleName` enum whitelist): `ROLE_ADMIN`, `ROLE_HR`,
  `ROLE_EMPLOYEE` — one per account.

| Role | Authority |
|---|---|
| **ADMIN** | full system write authority: employees, leaves, attendance, payroll (incl. **Mark PAID**), user management (create accounts, assign roles, enable/disable) |
| **HR** | operational read-only: view employees, leaves, attendance, payroll + filters; no write anywhere |
| **EMPLOYEE** | self-service only: own profile, own leaves (apply; edit/delete **own PENDING**), own attendance, own payroll — never anyone else's data |

**Ownership rule (the security heart):** the `employeeId` a client sends — in URL,
body or query — is a *request*, never *proof*. Identity comes only from the JWT
claim, resolved by `CurrentUser` in every service. JWT says employeeId 10 and the
request says `/employees/20` → **403**.

Full model: [docs/04_SECURITY_AND_ROLES.md](docs/04_SECURITY_AND_ROLES.md) ·
deep dive: [docs/services/AUTH_SERVICE.md](docs/services/AUTH_SERVICE.md).

## 5. How data flows across services

```
leave-service ── employeeId (a number) ──▶ employee-service ──▶ employee_schema
     ▲                (validated by HTTP/Feign, never by cross-schema SQL)
     └── employee details composed INTO responses via EmployeeClient
         (caller's JWT relayed, so ownership still applies)
```

- Every service answers for its own tables only; composing responses may fail
  cleanly (404 unknown employee / 503 employee-service down).
- No distributed transactions: writes validate inputs first, duplicates are refused
  with 409, and nothing silently cascades across services.
- Details: [docs/02_REQUEST_FLOW.md](docs/02_REQUEST_FLOW.md),
  [docs/learning/FEIGN_EUREKA_GATEWAY.md](docs/learning/FEIGN_EUREKA_GATEWAY.md).

## 6. How should a beginner study this project?

Follow the path in **[docs/README.md](docs/README.md)** — 13 steps from "what is
this?" to interview revision. Short version:

1. [Project overview](docs/00_PROJECT_OVERVIEW.md) → 2. [Architecture](docs/01_MICROSERVICES_ARCHITECTURE.md) →
3. [Request flows](docs/02_REQUEST_FLOW.md) → 4–7. the four business services →
8. [Auth + JWT](docs/services/AUTH_SERVICE.md) → 9. [Frontend](docs/frontend/FRONTEND_GUIDE.md) →
10. [Roles & ownership](docs/04_SECURITY_AND_ROLES.md) → 11. [Postman](docs/testing/POSTMAN_API_GUIDE.md) →
12. [Troubleshooting](docs/testing/TROUBLESHOOTING.md) → 13. [Interview notes](docs/learning/INTERVIEW_NOTES.md).

Demo logins: `admin/Admin@123` · `hr/Hr@123` · `emp01/Emp01@123`.
Startup order: PostgreSQL → 8761 → 8081..8085 → 8080 → 5173.

## 7. Documentation index

```
docs/
├── README.md                      ← learning path (start here)
├── 00_PROJECT_OVERVIEW.md
├── 01_MICROSERVICES_ARCHITECTURE.md
├── 02_REQUEST_FLOW.md
├── 03_DATABASE_ARCHITECTURE.md
├── 04_SECURITY_AND_ROLES.md
├── services/    (DISCOVERY_SERVER · API_GATEWAY · EMPLOYEE · LEAVE ·
│                 ATTENDANCE · PAYROLL · AUTH)
├── frontend/    (FRONTEND_GUIDE · UI_DESIGN_SYSTEM)
├── learning/    (JAVA_AND_SPRING_CONCEPTS_USED · MICROSERVICES_CONCEPTS ·
│                 SPRING_SECURITY_AND_JWT · FEIGN_EUREKA_GATEWAY · INTERVIEW_NOTES)
└── testing/     (POSTMAN_API_GUIDE · ROLE_BASED_TESTING · TROUBLESHOOTING)
```

Former root guides (`AUTH_SERVICE_GUIDE.md`, `PAYROLL_SERVICE_GUIDE.md`,
root `UI_DESIGN_SYSTEM.md`, `HRMS_DATABASE_SETUP.md`) have been consolidated
into `docs/`.
