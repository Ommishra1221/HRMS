# 01 · Microservices Architecture

> Last reviewed: written from current source code
> Source of truth: `*/src/main/resources/application.properties`, `pom.xml` files, controller/service classes

## 1. What is a microservice? (WHAT / WHY / HOW)

- **WHAT:** one independently runnable Spring Boot application that owns ONE piece of
  the business and ONE private slice of the database.
- **WHY:** small deployable units, independent scaling, isolated failures, clear team
  boundaries — and (for learning) each concept has exactly one home.
- **HOW in this project:** five Spring Boot apps, each started separately with its own
  `server.port`, its own `spring.application.name`, and its own database schema.

## 2. The service map (verified values)

| Service | `spring.application.name` | Port | Owns | Does NOT own |
|---|---|---:|---|---|
| Discovery Server | `discovery-server` | 8761 | the registry itself | any business data |
| API Gateway | `api-gateway` | 8080 | routing + CORS | any business data |
| Employee | `employee-service` | 8081 | `employees` table | leaves, attendance, payroll, users |
| Leave | `leave-service` | 8082 | `leaves` table | employees, attendance, payroll, users |
| Attendance | `attendance-service` | 8083 | `attendance` table | employees, leaves, payroll, users |
| Payroll | `payroll-service` | 8084 | `payrolls` table | employees, leaves, attendance, users |
| Auth | `auth-service` | 8085 | `users`, `roles`, `users_roles` | any employee/leave/payroll data |
| React Frontend | — | 5173 | the UI + `localStorage.hrms_token` | any database |

## 3. The one non-negotiable rule: database per service

Every service may read/write **only its own schema**. This is enforced two ways:

1. **Configuration** — each `application.properties` sets its own schema:
   ```properties
   spring.jpa.properties.hibernate.default_schema=employee_schema
   ```
   Hibernate qualifies every generated SQL statement with that schema. A service
   literally cannot address another service's tables, because it has no JPA mapping
   for them.
2. **Entity design** — cross-service relationships are stored as a **plain number**,
   never a foreign key:
   ```java
   // Leave.java (leave-service)
   @Column(name = "employee_id", nullable = false)
   private Long employeeId;   // just a NUMBER - no @ManyToOne, no FK
   ```
   PostgreSQL cannot enforce this link across schemas/services — *our code does*,
   by calling employee-service over HTTP (Feign) before trusting the id.

```
WRONG (never happens here):        RIGHT (what the code does):
leave-service                      leave-service
    │                                  │  employeeId (a number)
    ▼                                  ▼
employee_schema (direct SQL)      employee-service (HTTP via Feign)
                                       │
                                       ▼
                                   employee_schema
```

## 4. Eureka — the phone book (WHY)

- **WHY:** services get dynamic ports/instances; hardcoding `http://localhost:8081`
  in four other services makes scaling and moving impossible.
- **HOW:** every service sets
  ```properties
  eureka.client.service-url.defaultZone=http://localhost:8761/eureka
  eureka.client.register-with-eureka=true
  ```
  and registers under its `spring.application.name`. Callers ask for
  `lb://employee-service` and Eureka answers "8081 (and any other live instance)".
- **WHERE:** `discovery-server/` — a 20-line app with `@EnableEurekaServer`. It sets
  `register-with-eureka=false` and `fetch-registry=false` because the phone book does
  not list itself.
- **IF IT FAILS:** already-running services keep working with cached registry data;
  new instances cannot be discovered. Dashboard: `http://localhost:8761`.

## 5. API Gateway — the single door (WHY)

- **WHY:** the browser should never know five ports. One origin (8080) also solves
  CORS in exactly one place.
- **HOW:** `api-gateway/src/main/resources/application.properties` declares five
  routes, one per service:
  ```properties
  spring.cloud.gateway.server.webflux.routes[0].uri=lb://employee-service
  spring.cloud.gateway.server.webflux.routes[0].predicates[0]=Path=/api/employees/**
  spring.cloud.gateway.server.webflux.routes[0].filters[0]=StripPrefix=1
  ```
  `StripPrefix=1` removes `/api` before forwarding, so `/api/employees/7` arrives at
  employee-service as `/employees/7`. Same pattern for `leaves`, `attendance`,
  `payroll`, `auth`.
- **CORS:** `globalcors` allows exactly `http://localhost:5173` and `127.0.0.1:5173`.
- **IMPORTANT (current implementation):** the gateway **forwards** the
  `Authorization` header but does **not verify** the JWT. Verification happens inside
  each service. Gateway-level JWT checking is a reasonable future improvement — it is
  not implemented today (documented as future, not current).

## 6. Feign — how services call each other (WHY)

- **WHY:** leave/attendance/payroll need employee *details* (name, email, department)
  to compose their responses. They don't own that data.
- **HOW:** a tiny interface becomes an HTTP client:
  ```java
  // leave-service .../client/EmployeeClient.java
  @FeignClient(name = "employee-service")           // Eureka name, not a URL
  public interface EmployeeClient {
      @GetMapping("/employees/{id}")
      EmployeeResponse getEmployeeById(@PathVariable("id") Long id);
  }
  ```
  `employeeClient.getEmployeeById(5L)` is a Java call that becomes
  `GET http://employee-service/employees/5`, load-balanced via Eureka.
- **WHERE it is called:** `LeaveServiceImpl.fetchEmployeeOrThrow()`,
  `AttendanceServiceImpl.fetchEmployeeOrThrow()` / `toResponseWithEmployee()`,
  `PayrollServiceImpl` — same pattern in all three.
- **Token relay:** each of the three services has `FeignTokenRelay`
  (a `RequestInterceptor`) that attaches the **caller's own JWT** to outgoing Feign
  calls, so employee-service re-checks roles/ownership for the original user instead
  of blindly trusting internal traffic.
- **IF EMPLOYEE-SERVICE IS DOWN:** the Feign call throws `FeignException`;
  `GlobalExceptionHandler` in each caller translates it to **503 Service Unavailable**.

## 7. The layering pattern (identical in all five services)

```
Controller  (@RestController)   HTTP in/out only - thin, no logic
     ↓
Service     (interface + Impl)  ALL business rules live here
     ↓
Repository  (JpaRepository)     database access, derived queries
     ↓
Entity      (@Entity)           one class = one table row
```

DTOs wrap the boundary: **Request** DTOs come in (with validation annotations),
**Response** DTOs go out (entities — which contain sensitive fields like password
hashes — never leave the service). This is why `User` has `UserResponse`, and why
`PayrollResponse` carries a computed `netSalary` but `PayrollRequest` has no such field.

## 8. Why this project does it this way (summary)

| Decision | Why |
|---|---|
| Database per service | independent evolution; a schema change in payroll cannot break leave |
| Plain `employeeId`, not `@ManyToOne` | no cross-schema FK is possible; keeps services truly independent |
| Eureka | services find each other by name, not by hardcoded address |
| Gateway | one URL + one CORS config for the browser; hides the topology |
| Feign | cross-service calls read like local method calls |
| DTOs | stable API contract; never leak entities/password hashes |
| Service interface + Impl | the rule is *one interface, one implementation* — mirrors the codebase everywhere |
| Auth as its own service | identity is a distinct concern; its only shared thing is the JWT secret |

Deep dives: [learning/FEIGN_EUREKA_GATEWAY.md](learning/FEIGN_EUREKA_GATEWAY.md) ·
[learning/MICROSERVICES_CONCEPTS.md](learning/MICROSERVICES_CONCEPTS.md).
