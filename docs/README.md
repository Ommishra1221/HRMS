# HRMS Learning Documentation — Start Here

This folder is the documentation for the HRMS microservices project: a Spring Boot
backend of five services, an API Gateway, a Eureka registry, and a React frontend.

Everything here was written **from the actual source code** (class names, endpoints,
ports, business rules), not from memory or tutorials.

---

## The 13-step learning path

| Step | Study | Files to open | What to understand | What to practice |
|---|---|---|---|---|
| **1** | What the project is | [00_PROJECT_OVERVIEW.md](00_PROJECT_OVERVIEW.md) | The business domain and the five services | Draw the architecture from memory |
| **2** | Why microservices | [01_MICROSERVICES_ARCHITECTURE.md](01_MICROSERVICES_ARCHITECTURE.md) | Database-per-service, Eureka, Gateway, Feign | Explain why leave-service cannot query employee tables |
| **3** | How a request travels | [02_REQUEST_FLOW.md](02_REQUEST_FLOW.md) | The path Browser → Gateway → Service → DB | Trace one request in Postman while reading the flow |
| **4** | Employee Service | [services/EMPLOYEE_SERVICE.md](services/EMPLOYEE_SERVICE.md) | The simplest service — the template for all others | Run it, call `GET /employees` in Postman |
| **5** | Leave Service | [services/LEAVE_SERVICE.md](services/LEAVE_SERVICE.md) | Feign composition + ownership + PENDING rules | Apply leave as an employee via Postman |
| **6** | Attendance Service | [services/ATTENDANCE_SERVICE.md](services/ATTENDANCE_SERVICE.md) | One-record-per-day rule, checkout PATCH | Create a duplicate record and read the 409 |
| **7** | Payroll Service | [services/PAYROLL_SERVICE.md](services/PAYROLL_SERVICE.md) | Server-side money, one-payslip-per-month, PAID immutability | Try to edit a PAID payslip and read the 409 |
| **8** | Auth + Security + JWT | [services/AUTH_SERVICE.md](services/AUTH_SERVICE.md), [learning/SPRING_SECURITY_AND_JWT.md](learning/SPRING_SECURITY_AND_JWT.md) | BCrypt, tokens, filters, SecurityContext | Decode a real JWT at jwt.io |
| **9** | Frontend | [frontend/FRONTEND_GUIDE.md](frontend/FRONTEND_GUIDE.md) | React ↔ Gateway, AuthContext, ProtectedRoute | Log in and watch the Network tab |
| **10** | Roles & authorization | [04_SECURITY_AND_ROLES.md](04_SECURITY_AND_ROLES.md) | ROLE authorization vs OWNERSHIP checks | Attempt cross-employee access with a token |
| **11** | Postman testing | [testing/POSTMAN_API_GUIDE.md](testing/POSTMAN_API_GUIDE.md), [testing/ROLE_BASED_TESTING.md](testing/ROLE_BASED_TESTING.md) | Tokens, statuses, negative tests | Execute the full role matrix |
| **12** | Troubleshooting | [testing/TROUBLESHOOTING.md](testing/TROUBLESHOOTING.md) | Startup order, 401/403/409 causes, CORS | Break something on purpose and fix it |
| **13** | Interview revision | [learning/INTERVIEW_NOTES.md](learning/INTERVIEW_NOTES.md) | Concise answers to the standard questions | Explain each service in one minute, out loud |

Supporting references (read when needed, not in order):

- [02_REQUEST_FLOW.md](02_REQUEST_FLOW.md) — login / create-employee / create-leave / create-payroll / self-service flows
- [03_DATABASE_ARCHITECTURE.md](03_DATABASE_ARCHITECTURE.md) — the one-database-five-schemas design
- [learning/MICROSERVICES_CONCEPTS.md](learning/MICROSERVICES_CONCEPTS.md) — concepts dictionary
- [learning/JAVA_AND_SPRING_CONCEPTS_USED.md](learning/JAVA_AND_SPRING_CONCEPTS_USED.md) — the Java/Spring features this codebase actually uses
- [learning/FEIGN_EUREKA_GATEWAY.md](learning/FEIGN_EUREKA_GATEWAY.md) — deep dive on service-to-service plumbing
- [frontend/UI_DESIGN_SYSTEM.md](frontend/UI_DESIGN_SYSTEM.md) — tokens, components, accessibility

---

## The 60-second map of the system

```
React (5173)
    │  fetch/axios with JWT
    ▼
API Gateway (8080)  ← the ONLY door the browser uses
    │  lb://service-name via Eureka (8761)
    ▼
Employee 8081 · Leave 8082 · Attendance 8083 · Payroll 8084 · Auth 8085
    each owns ONE private PostgreSQL schema inside the shared HRMS database
```

- There are **exactly three roles**: `ROLE_ADMIN`, `ROLE_HR`, `ROLE_EMPLOYEE`.
- There is **no public signup** — `POST /auth/login` is the only public endpoint, and
  an ADMIN creates every account.
- An EMPLOYEE may only ever touch **their own** data; ownership is verified from the
  JWT, never from an id sent by the browser.

Begin at **Step 1**. Good luck — the project is small enough to hold in your head
once, and rich enough to teach every major Spring Boot concept.
