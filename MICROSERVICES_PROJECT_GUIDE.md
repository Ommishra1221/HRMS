# 🎓 HRMS Microservices Project Guide — From Zero to Hero

> This document teaches you microservices **using your own project**.
> Every concept follows the same pattern: **WHAT** it is → **WHY** we need it → **HOW** it works → **WHERE** it lives in this project.
>
> This is a reading document — it does not modify any code. 📖

---

## 📇 Project Directory (Quick Reference)

| Thing | Name / Port | Database |
|---|---|---|
| React Frontend | `hrms-frontend` (:5173, Vite) | — (no database!) |
| API Gateway | `api-gateway` (:8080) | — |
| Employee Service | `employee-service` (:8081) | `employee_db` |
| Leave Service | `leave-service` (:8082) | `leave_db` |
| Discovery Server (Eureka) | `discovery-server` (:8761) | — |

**Golden Rule:** React talks only to the Gateway (8080). The Gateway talks to the services (8081/8082). Leave Service talks to Employee Service (via OpenFeign). No service ever touches another service's database.

---

## 1. Overall Project Architecture

### WHAT
Architecture means: which pieces make up the system, and who talks to whom.

### HOW (the full picture)

```
                    React Frontend (localhost:5173)
                            |
                            |  HTTP  (only ONE address: localhost:8080)
                            v
                    API Gateway (localhost:8080)
                       |              |
         lb://employee-service   lb://leave-service
             (StripPrefix=1)         (StripPrefix=1)
                       |              |
                       v              v
    EMPLOYEE SERVICE (:8081) <---- OpenFeign ---- LEAVE SERVICE (:8082)
        |         ^          (looks up by name via Eureka)
        |         |                      |
   employee_db   |                  leave_db
  (employees)    |                (leaves)
                 |
        DISCOVERY SERVER (:8761) — every service registers here
```

### WHERE (in this project)
- `hrms-frontend/src/api/axiosInstance.js` → baseURL = `VITE_API_BASE_URL` = `http://localhost:8080` (the gateway)
- `api-gateway/src/main/resources/application.properties` → routes `lb://employee-service`, `lb://leave-service`
- `leave-service/.../client/EmployeeClient.java` → `@FeignClient(name = "employee-service")`

### One-line summary to remember
**"The frontend knows only one door (the Gateway). The Gateway finds services by name (via Eureka). Services talk to each other over Feign. Every service owns its own database."**

---

## 2. Why Employee Service and Leave Service Are Separate

### WHAT
Two independent Spring Boot applications — each with its own `pom.xml`, its own port, its own database, and its own code.

### WHY (think of a real-life example)
Imagine a company where the **HR department** and the **Leave department** are separate. HR keeps employee records; the Leave department handles only leave applications. If the Leave department's records get corrupted, HR's data should remain safe. That is **separation of concerns**.

Technical benefits:
1. **Independent deployment** — a bug in leave logic? Restart only `leave-service`; employee-service keeps running.
2. **Independent scaling** — if leave applications spike 10x during the holidays, run 4 instances of leave-service and nothing else.
3. **Independent databases** — corruption or migration in one DB does not touch the other.
4. **Team autonomy** — one team works on employees, another on leaves, without stepping on each other's code.

### WHERE (in this project)
- `employee-service/` → only employee logic: `EmployeeController`, `EmployeeServiceImpl`, `EmployeeRepository`, the `Employee` entity, `employee_db`
- `leave-service/` → only leave logic: `LeaveController`, `LeaveServiceImpl`, `LeaveRepository`, the `Leave` entity, `leave_db`
- Each has its own `application.properties` and its own `server.port` (8081 vs 8082)

### ❌ A common wrong assumption
"Employees and leaves are related, so why not keep them in one project?" → Being *related* and being *owned* are different things. We connect the relation **at runtime over HTTP** (we'll see this in Section 6).

---

## 3. The Database-per-Service Concept

### WHAT
Every microservice owns a **private database**. No other service may connect to it — not even with direct DB credentials.

### WHY
- If both services shared one DB, the database would become **hidden coupling**: rename a column in the employee table → leave-service's code breaks.
- Deployment also suffers: while the employee DB is being migrated, leave-service could crash.
- With database-per-service, each service is the **owner** of its data — like each department having its own cabinet, and no other department holds the key.

### HOW (exactly as configured in this project)
- `employee-service/application.properties`:
  `spring.datasource.url=jdbc:postgresql://localhost:5432/employee_db`
- `leave-service/application.properties`:
  `spring.datasource.url=jdbc:postgresql://localhost:5432/leave_db`
- Two separate PostgreSQL databases were created: `CREATE DATABASE employee_db; CREATE DATABASE leave_db;`

### The most important detail — what the `Leave` entity does NOT have
```java
// leave-service/.../entity/Leave.java
@Column(name = "employee_id", nullable = false)
private Long employeeId;   // just a NUMBER — it is NOT @ManyToOne!
```
There is **no foreign key constraint** referencing the `employees` table, because PostgreSQL **cannot enforce FKs across two separate databases**. So who enforces the link? **Our code** — when creating a leave, `LeaveServiceImpl` checks the employee's existence over HTTP (Section 6).

### The takeaway
**"Cross-service data integrity is the code's responsibility, not the database's."**

---

## 4. Employee Service — Complete Flow

### The chain of files that does the work
```
EmployeeController  →  EmployeeService (interface)  →  EmployeeServiceImpl
       →  EmployeeRepository  →  employee_db (employees table)
```

### Internal flow of GET all employees (step by step)
Request: `GET http://localhost:8081/employees`

1. Embedded **Tomcat** receives the request.
2. Spring MVC matches it: `@GetMapping` on `EmployeeController` + `@RequestMapping("/employees")` on the class → match!
3. The controller immediately **delegates** to `employeeService.getAllEmployees()` (no business logic in the controller).
4. `EmployeeServiceImpl.getAllEmployees()` runs (`@Transactional(readOnly = true)`):
   - `employeeRepository.findAll()` → Hibernate generates: `SELECT * FROM employees`
   - Each `Employee` entity is converted to an `EmployeeResponse` DTO by the `toResponse()` helper
5. The controller returns `ResponseEntity.ok(list)` → **200 OK** + a JSON array.

### Flow of POST (create)
Request: `POST /employees` with body `{"name":"Asha Kumar","email":"asha@corp.com","department":"Engineering"}`

1. `@Valid @RequestBody EmployeeRequest` → the JSON is converted into the `EmployeeRequest` DTO and validated:
   - `@NotBlank` — are name/email/department empty?
   - `@Email` — is the email format valid?
   - If validation fails → `MethodArgumentNotValidException` → `GlobalExceptionHandler` → **400** with a message like `email: email must be a valid email address`
2. The service creates a new `Employee` entity — **it does NOT set the id!**
3. `save()` → Hibernate: `INSERT INTO employees ...` → PostgreSQL generates the id (`GenerationType.IDENTITY`).
4. The saved entity → `EmployeeResponse` → the controller returns **201 Created**.

### Endpoints (all verified, from this project)
| Method | Path | Success | Failure |
|---|---|---|---|
| POST | `/employees` | 201 | 400 (validation) |
| GET | `/employees` | 200 | — |
| GET | `/employees/{id}` | 200 | 404 |
| PUT | `/employees/{id}` | 200 | 404 / 400 |
| DELETE | `/employees/{id}` | 204 (no body) | 404 |

---

## 5. Leave Service — Complete Flow

### The chain of files
```
LeaveController → LeaveService → LeaveServiceImpl ──┬─→ LeaveRepository → leave_db
                                                    └─→ EmployeeClient (Feign) ──HTTP──▶ employee-service
```

### Flow of GET a single leave — where the magic happens
Request: `GET http://localhost:8082/leaves/1`

1. `LeaveController.getLeaveById(1)` → `LeaveServiceImpl.getLeaveById(1)`
2. `leaveRepository.findById(1)` → `SELECT * FROM leaves WHERE id=1` (**leave_db**)
3. Now we need the **employee's details** — but leave_db stores only the `employeeId` (a number)!
   `EmployeeResponse employee = fetchEmployeeOrThrow(leave.getEmployeeId())`
   → this makes the Feign call to employee-service (Section 6)
4. Both pieces are composed into `LeaveResponse`: leave fields + the `employee` object
5. The JSON response:
```json
{
  "id": 1, "employeeId": 1, "leaveType": "SICK",
  "fromDate": "2026-09-14", "toDate": "2026-09-16",
  "reason": "Fever", "status": "PENDING",
  "employee": { "id": 1, "name": "Asha Kumar", "email": "asha@corp.com", "department": "Engineering" }
}
```
This is called **API Composition** — data from two databases stitched together at runtime.

### Flow of POST (apply for leave)
1. `LeaveRequest` validation: `employeeId @NotNull`, `leaveType @NotBlank`, dates `@NotNull`
2. **First: does the employee exist?** → `fetchEmployeeOrThrow(employeeId)` → a Feign call!
   - Employee not found → `EmployeeServiceException` → **404** `"Employee not found with id: 999 (checked in employee-service)"`
3. Now save: `leave.setStatus("PENDING")` — business rule: every new leave starts as PENDING
4. `leaveRepository.save(leave)` → INSERT into **leave_db**
5. The response also includes the employee → **201 Created**

### GET all leaves — an honest learning note
`getAllLeaves()` makes a separate Feign call for every leave — this is the classic **N+1 problem** (N leaves = N HTTP calls). It's fine for learning; production systems use caching/batching. It's mentioned here so you can talk about it in interviews too! 😄

---

## 6. OpenFeign — How Leave Service Communicates with Employee Service

### WHAT
OpenFeign = a **declarative HTTP client**. You write only an interface; Spring generates an "implementation" that performs the real HTTP calls.

### WHY
Writing manual HTTP code (building URLs, parsing JSON, handling errors) is tedious and error-prone. With Feign, a method call *is* a network call. It feels like magic, but underneath it's simple.

### HOW (from the actual code)
```java
// leave-service/.../client/EmployeeClient.java
@FeignClient(name = "employee-service")      // finds it by NAME via Eureka
public interface EmployeeClient {
    @GetMapping("/employees/{id}")
    EmployeeResponse getEmployeeById(@PathVariable("id") Long id);
}
```

When `LeaveServiceImpl` runs this:
```java
EmployeeResponse employee = fetchEmployeeOrThrow(leave.getEmployeeId());
```
...here is what happens inside:

```
1. employeeClient = a RUNTIME-GENERATED PROXY (we never wrote a class)
2. The proxy asks Eureka: "where is 'employee-service'?"
   → ["localhost:8081"]  (or MULTIPLE instances if scaled!)
3. Spring Cloud LoadBalancer picks one instance
4. HTTP request: GET http://localhost:8081/employees/7
5. employee-service runs its full cycle:
   EmployeeController → EmployeeServiceImpl → employee_db → JSON back
6. Feign deserializes the JSON into OUR EmployeeResponse DTO
   (leave-service's own copy — we do NOT import employee-service's classes!)
```

### Key annotations/pieces
| What | Where | Purpose |
|---|---|---|
| `@EnableFeignClients` | on `LeaveServiceApplication` | Without it, Spring completely ignores `@FeignClient`! |
| `name = "employee-service"` | `@FeignClient` | Must match the target service's `spring.application.name` |
| `url = "..."` (was there, now removed) | — | Before Eureka we had a hardcoded URL; now discovery is name-based |
| `FeignException.NotFound` | caught in `fetchEmployeeOrThrow` | Downstream 404 → our meaningful 404 |
| `FeignException` (general) | `GlobalExceptionHandler` | Service down → **503 Service Unavailable** |

### Before vs After (the Eureka upgrade)
```java
// BEFORE (hardcoded URL):
@FeignClient(name = "employee-service", url = "${employee.service.url}")

// NOW (name-based discovery):
@FeignClient(name = "employee-service")
```
Meaning: if employee-service's port/IP changes, **nothing in leave-service needs to change**.

---

## 7. API Gateway — How It Communicates with Both Services

### WHAT
The Gateway is the system's **front door** (single entry point). Every client request arrives here first, and the Gateway forwards it to the right service.

### WHY
- The client (React) needs to remember **one address** — 8080
- The services' ports/IPs stay **hidden** from clients — moving/scaling them later is easy
- One place for cross-cutting concerns: CORS, (later) auth, rate limiting, logging

### HOW (from this project's actual config)
`api-gateway/application.properties`:
```properties
server.port=8080

spring.cloud.gateway.server.webflux.routes[0].id=employee-service
spring.cloud.gateway.server.webflux.routes[0].uri=lb://employee-service
spring.cloud.gateway.server.webflux.routes[0].predicates[0]=Path=/api/employees/**
spring.cloud.gateway.server.webflux.routes[0].filters[0]=StripPrefix=1
```
Understand each piece:
- **`Path=/api/employees/**`** (the predicate) = "which requests match" — e.g. `/api/employees/3` ✔
- **`lb://employee-service`** = "load-balanced lookup by NAME" — ask Eureka for live instances and pick one (port 8081 is not written anywhere!)
- **`StripPrefix=1`** = remove the **first path segment** before forwarding: `/api/employees/3` → `/employees/3` (because employee-service listens on `/employees`, not `/api/employees`)

### The journey of a request
```
GET http://localhost:8080/api/employees/3
   → Gateway: route matches (Path=/api/employees/**)
   → Eureka: "where is employee-service?" → localhost:8081
   → StripPrefix=1 → GET http://localhost:8081/employees/3
   → the response travels back the same way
```

### One more job — CORS
The Gateway is what answers the browser's CORS requirements (details in Section 8). The services themselves need no CORS config at all, because they never talk to the browser directly.

### Good to know
The Gateway is **WebFlux/Netty** based (not servlet) — hence `spring-cloud-starter-gateway-server-webflux` in its pom and zero business logic. The starter was renamed in the 2025.1 release train — the old `spring-cloud-starter-gateway` is deprecated.

---

## 8. React Frontend → API Gateway → Microservice

### WHAT
The full path a request takes from the UI to the backend.

### WHY this way?
A browser security rule (**CORS**): JavaScript on `localhost:5173` (React) may only call an origin whose server explicitly permits it. The Gateway grants that permission. If React called the services directly, every service would need CORS config — and the architecture rule (React → 8081 ❌) would be broken.

### HOW — the frontend's layers (actual files)
```
Component (UI)  →  hooks/  →  api/  →  axiosInstance  →  GATEWAY  →  service
```

1. **`src/api/axiosInstance.js`** — the single door for ALL calls:
   - `baseURL: import.meta.env.VITE_API_BASE_URL` → `.env` contains `http://localhost:8080`
   - One **error interceptor**: normalizes every backend `{status, message}` or network failure into `{ status, message }`. That's why every component gets the same friendly errors.
2. **`src/api/employeeApi.js` / `leaveApi.js`** — the endpoint list:
   - `api.get('/api/employees')`, `api.post('/api/leaves', data)` ... **only `/api/...` paths — no trace of 8081/8082**
3. **`src/hooks/useEmployees.js` / `useLeaves.js`** — reusable `loading`, `error`, `refresh` logic. No fetch logic lives in the UI.
4. **Pages** — `EmployeeList`, `LeaveFormPage`, `Dashboard`... they only render and show state messages.
5. **Routing** — `BrowserRouter` in `main.jsx`, `<Routes>` in `App.jsx` (e.g. `/employees/:id/edit` → `EmployeeFormPage`).

### One complete flow — "opening the Employees page"
```
User opens: http://localhost:5173/employees
→ React Router: /employees route → renders <EmployeeList />
→ useEffect (inside useEmployees) → getEmployees()
→ axios: GET http://localhost:8080/api/employees
→ Gateway: route matches → Eureka lookup → StripPrefix
→ GET http://localhost:8081/employees (employee-service)
→ Controller → ServiceImpl → Repository → employee_db
→ JSON travels back → React state updates → table renders
```

### The Leave form's double-call example (the best one!)
`LeaveFormPage` uses **two services** on a single page — both behind the Gateway:
- Employee dropdown: `useEmployees()` → `GET /api/employees` → **employee-service**
- Save the leave: `createLeave()` → `POST /api/leaves` → **leave-service**
The browser thinks it talked to one server (8080). The real microservices teamwork happened behind the Gateway. 🎯

---

## 9. Complete Request/Response Flows (Diagrams)

### Flow A — Create an employee (frontend to DB, the whole way)
```
[Browser] React EmployeeForm
   |  user clicks "Save"; validate() runs client-side checks first
   v
createEmployee({name,email,department})
   |  axiosInstance → POST http://localhost:8080/api/employees
   v
[API Gateway :8080]
   |  CORS check ✔ → route Path=/api/employees/** → lb://employee-service → StripPrefix=1
   v
[Employee Service :8081] EmployeeController.createEmployee()
   |  @Valid @RequestBody → validation fails? → 400 (GlobalExceptionHandler)
   v
EmployeeServiceImpl.createEmployee()
   |  new Employee() → save()
   v
EmployeeRepository → Hibernate INSERT → [employee_db]
   |  id generated
   v
EmployeeResponse → 201 Created + JSON
   ...same path back... → React navigate('/employees') → list refreshes
```

### Flow B — Create a leave (TWO services, one request!)
```
[Browser] LeaveForm submits {employeeId:1, leaveType:"SICK", ...}
   v
POST http://localhost:8080/api/leaves
   v
[Gateway] → lb://leave-service → http://localhost:8082/leaves
   v
[Leave Service] LeaveController → LeaveServiceImpl.createLeave()
   |                         |
   | STEP 1: verify employee | STEP 2: save
   v                         v
EmployeeClient.getEmployeeById(1)     leaveRepository.save()
   | (Feign + Eureka + LB)               |
   v                                     v
GET http://localhost:8081/employees/1   INSERT → leave_db (status=PENDING)
   v
[Employee Service] → SELECT → employee_db → JSON 200
   |
   └──> both pieces become LeaveResponse (+employee) → 201 Created → browser
```

### Flow C — Error flow (employee-service is down)
```
GET /api/leaves → Gateway → leave-service
→ LeaveServiceImpl → EmployeeClient.getEmployeeById(1)
→ connection refused! → FeignException (anything other than NotFound)
→ GlobalExceptionHandler → 503 {"message":"Employee service is currently unavailable..."}
→ axios interceptor normalizes it → ErrorAlert component → user sees a friendly message ✔
```

---

## 10. Controller → Service → Repository → DB (layer by layer)

### WHY layers?
Each layer has **exactly one responsibility** (Single Responsibility Principle). Changes stay isolated: URL changed → only the controller. Business rule changed → only the service. Table design changed → repository/entity.

| Layer | Class (example) | Responsibility | What it must NOT do |
|---|---|---|---|
| **Controller** | `EmployeeController` | HTTP mapping, status codes, JSON in/out, `@Valid` | Business logic, thinking about SQL |
| **Service (interface)** | `EmployeeService` | The contract — what work is available | Anything concrete |
| **ServiceImpl** | `EmployeeServiceImpl` | Business rules, entity↔DTO mapping, `@Transactional` | HTTP concerns |
| **Repository** | `EmployeeRepository extends JpaRepository<Employee,Long>` | Database operations — `save()`, `findById()` for free! | Business decisions |
| **Entity** | `Employee` | Mirror of the table (`@Entity`, `@Table(name="employees")`) | Never exposed directly to clients |
| **DTO** | `EmployeeRequest` / `EmployeeResponse` | The API contract + validation | Never saved to the DB |

### A code-level glimpse (actual project style)
```java
// Controller — thin
@PostMapping
public ResponseEntity<EmployeeResponse> createEmployee(@Valid @RequestBody EmployeeRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(employeeService.createEmployee(request));
}

// ServiceImpl — business logic + mapping
Employee saved = employeeRepository.save(employee);
return toResponse(saved);
```
`201` on create (a new resource was born), `200` on update, `204` on delete — **these small details are what professional code looks like.**

---

## 11. DTO, Entity and Repository — their roles

### Entity (`Employee`, `Leave`)
- **WHAT:** The Java mirror of a database table. `@Entity` + `@Table(name="employees")` + `@Id @GeneratedValue(IDENTITY)`.
- **WHERE:** Lives only inside its service — it never leaks outside (that's why responses are always DTOs).

### DTO (`EmployeeRequest/Response`, `LeaveRequest/Response`, leave-service's `EmployeeResponse` copy)
- **WHY:**
  1. The client cannot set `id` (that's the DB's job)
  2. Validation lives on the DTO — the API contract stays stable
  3. If the entity schema changes, the API doesn't break
- **Interesting:** leave-service contains a **deliberate duplicate** of `EmployeeResponse`. Why not a shared library? Because in microservices, **code sharing = coupling**. Each service knows the other only through its **JSON contract**, not its JAR/classes.

### Repository (`EmployeeRepository`, `LeaveRepository`)
- **WHAT:** `interface X extends JpaRepository<Entity, ID>` — that's it! Spring Data generates the implementation at runtime: `save`, `findById`, `findAll`, `deleteById` — we never wrote a single line of SQL.
- **HOW:** Hibernate generates the JPQL/SQL. Because of `show-sql=true`, you can watch the queries in the console — **learning tip: always read the SQL in the console!**

---

## 12. Why Services Don't Access Each Other's Databases

### Understand it through a scenario
Leave service needs the employee's name. What's the shortcut? Connect directly to `employee_db`... **NO!** Here's why:

1. **Coupling:** a column rename in the employee table → leave-service crashes (even though the table is owned by employee-service)
2. **Broken ownership:** if two services write to the same table, who is responsible for fixing bugs?
3. **Scaling breaks:** tomorrow employee-service moves to another server, and the shared `localhost:5432` connection becomes impossible
4. **Independent deployment dies:** schema migrations would force both services to deploy together = that's a monolith again!

### The right way (what we did)
```
leave-service ──HTTP (Feign)──▶ employee-service API ──▶ employee_db
   (the owner — employee-service — serves the data; permission is its)
```
**Interview one-liner:** *"Each service's database is private; cross-service data access happens only through APIs — integrity is enforced in code, not by foreign keys."*

---

## 13. Error Handling + "What if another service is down?"

### Our uniform error shape (in both services)
```json
{ "timestamp": "...", "status": 404, "error": "Not Found", "message": "Employee not found with id: 99" }
```

### The `GlobalExceptionHandler` (`@RestControllerAdvice`) mapping
| Situation | Exception | HTTP | Handled in |
|---|---|---|---|
| Employee/leave id doesn't exist | `ResourceNotFoundException` | 404 | both services |
| Validation fails (`@NotBlank` etc.) | `MethodArgumentNotValidException` | 400 | both services |
| Leave references a bad employeeId (the other service said 404) | `EmployeeServiceException` | 404 + clear message | leave-service |
| Employee-service is **down** | `FeignException` | **503 Service Unavailable** | leave-service handler |
| Anything unexpected | `Exception` | 500 | both |

### The frontend's error system
- `axiosInstance` interceptor → normalizes every error into `{status, message}`
- Components: `Loading`, `ErrorAlert` (with a Retry button!), `EmptyState`
- **Real examples you have already seen:**
  - "Unable to connect to server..." → the gateway was stopped
  - Employee-service down + the Leaves page → the backend's 503 message in the error card
  - `GET /leaves` with a deleted employee → 503 (the N+1 latent issue — now you know!)

### An example of graceful degradation
`Dashboard.jsx` — if one service is down, the other stats still render; only one card shows `—` plus an error note. The whole page doesn't go blank. **That is resilience.**

---

## 14. Important Files — Cheat Sheet

### employee-service
| File | In one line |
|---|---|
| `EmployeeServiceApplication` | `@SpringBootApplication` — the app's starting point |
| `controller/EmployeeController` | 5 endpoints, `@RequestMapping("/employees")` |
| `service/EmployeeService(Impl)` | CRUD logic, DTO mapping, `orElseThrow` |
| `repository/EmployeeRepository` | `JpaRepository` — SQL for free |
| `entity/Employee` | Mirror of the `employees` table, unique email |
| `dto/EmployeeRequest` | `@NotBlank` + `@Email` validation |
| `dto/EmployeeResponse` | The client-facing JSON (with id) |
| `exception/ResourceNotFoundException` | The source of 404s |
| `exception/GlobalExceptionHandler` | Every exception → clean JSON |
| `application.properties` | 8081, `employee_db`, Eureka `defaultZone` |

### leave-service
| File | In one line |
|---|---|
| `LeaveServiceApplication` | `@SpringBootApplication` + **`@EnableFeignClients`** |
| `client/EmployeeClient` ⭐ | The Feign interface — the hero of the whole project |
| `controller/LeaveController` | The 5 `/leaves` endpoints |
| `service/LeaveServiceImpl` | save + **Feign call + composition** (`fetchEmployeeOrThrow`) |
| `entity/Leave` | `employeeId` is a plain number (NO FK!) |
| `dto/LeaveRequest` | validation (employeeId, type, dates) |
| `dto/LeaveResponse` | leave + **nested `employee`** |
| `dto/EmployeeResponse` | The Feign deserialization target (intentional copy) |
| `exception/EmployeeServiceException` | For downstream errors |

### api-gateway / discovery-server
| File | In one line |
|---|---|
| `ApiGatewayApplication` | Zero business logic — just the road |
| gateway `application.properties` | `server.port=8080`, `lb://` routes, `StripPrefix=1`, **globalcors** (5173 allowed) |
| `DiscoveryServerApplication` | `@EnableEurekaServer` — the phone book |
| discovery `application.properties` | 8761, `register-with-eureka=false` (it does not register itself) |

### hrms-frontend
| File | In one line |
|---|---|
| `.env` | `VITE_API_BASE_URL=http://localhost:8080` |
| `api/axiosInstance.js` | baseURL + error interceptor |
| `api/employeeApi.js` / `leaveApi.js` | Every endpoint in one place |
| `hooks/useEmployees` / `useLeaves` | reusable loading/error/data |
| `components/common/Loading.jsx` | Loading/ErrorAlert/EmptyState |
| `components/employee/EmployeeForm.jsx` | One form for both create and edit |
| `pages/LeaveFormPage.jsx` | ⭐ employee **dropdown fed by the Employee API** |
| `pages/Dashboard.jsx` | Stats — with graceful degradation |
| `App.jsx` | Sidebar layout + all routes |

---

## 15. Real Examples — concept → where it lives in this project

| Concept | Exactly where in this project |
|---|---|
| Single entry point | React talks only to `8080` — the baseURL in `axiosInstance` |
| Load-balanced lookup | Gateway route `uri=lb://employee-service` |
| Service registration | employee-service appears as "EMPLOYEE-SERVICE" in Eureka (:8761 dashboard) right after startup |
| Declarative client | The `EmployeeClient` interface — an implementation was never written |
| API composition | `LeaveServiceImpl.getLeaveById` — a leave_db row + an HTTP-fetched employee = one JSON |
| DTO copy = decoupling | leave-service's own `EmployeeResponse` |
| Business rule in code | New leave → `setStatus("PENDING")` (from the service, not a DB default) |
| Status codes matter | 201 create / 200 update / 204 delete / 404 / 400 / 503 |
| CORS preflight | The browser sends OPTIONS before POST; the gateway allows it via `globalcors` |
| Client-side validation UX | `EmployeeForm.validate()` mirrors the backend rules; but the backend still re-checks (the server is the real gate) |

---

## 16. Common Beginner Mistakes (some of which we made ourselves! 😅)

1. **Calling 8081/8082 directly from React** — breaks the architecture rule + CORS fails. Always use `/api/...` via the gateway.
2. **Adding `@ManyToOne` from Leave to Employee** — a cross-database FK is impossible + ownership collapses. Keep `employeeId` as a plain number.
3. **Using the entity directly as request/response** — id leaks, validation gets hard, the contract becomes fragile. Use DTOs.
4. **One shared database** — it looks "easy" but it's the monolith coming back. Database-per-service, always.
5. **Hardcoded service URLs** — we did it (`url="http://localhost:8081"`), then fixed it with Eureka. Refer to services by name.
6. **Forgetting `@EnableFeignClients`** — it compiles, but at runtime the `EmployeeClient` bean doesn't exist. Confusing error!
7. **JDK version mismatch** — ⭐ **a true story from this project:** we wrote `Stream.toList()` (Java 16+); STS was running an older JDK → runtime `Unresolved compilation problem`. Fix: `Collectors.toList()` + the right JDK in STS + *Project → Clean*. **Lesson: a running JVM never picks up source changes — stale class issues are always fixed by restart/clean.**
8. **Adding `spring-boot-starter-web` to the Gateway** — Netty (reactive) + Tomcat (servlet) cannot coexist in one app. Only the gateway starter goes there.
9. **Ignoring start order after Eureka** — registry first, then services. And a first-request 503 (~30s registry cache) is normal — don't panic.
10. **Sprinkling CORS config on the services** — the browser only talks to the gateway, so CORS belongs **only in the gateway**. Both services stay untouched.
11. **Forgetting the validation starter in `pom.xml`** — `@Valid` silently does nothing without the dependency.
12. **Treating 400/404/503 as "just 500"** — status codes are your debugging GPS. Read the status first, then the message, then the logs.
13. **Ignoring N+1** — `GET /leaves` makes an HTTP call per row. Fine today; optimize later (cache/batch) — but *know about it*.

---

## 17. What I Should Remember — Final Revision Card 🧠

**The architecture (in one breath):**
> React (5173) → Gateway (8080) → [Eureka (8761) resolves names to instances] → employee-service (8081, employee_db) / leave-service (8082, leave_db); leave-service fetches employee data live via Feign.

**10 truths worth remembering:**
1. **Database-per-service** — no cross-DB FKs; integrity lives **in code** (the Feign check).
2. **Gateway = single entry** — CORS, routing (`lb://`), future auth; the services are invisible to the browser.
3. **Feign = interface = HTTP** — name-based lookup (Eureka), LoadBalancer picks the instance.
4. **`Leave.employeeId` is a plain Long** — and that's exactly right.
5. **Response composition** — `LeaveResponse.employee` is filled at runtime, never stored.
6. **Layers:** Controller (HTTP) → ServiceImpl (rules) → Repository (DB) → Entity (table); DTO = the contract.
7. **Errors:** 400 validation, 404 not found, 503 downstream down, 500 unexpected — all in `{timestamp,status,error,message}` shape.
8. **Validation in two places:** frontend (UX) + backend (`@Valid` — the real gate).
9. **Run order:** discovery → employee → leave → gateway → `npm run dev`.
10. **In microservices, every network call can fail** — hence handling like `fetchEmployeeOrThrow` + (later) circuit breakers.

**The next learning level (ready-made next steps for this project):**
- **Resilience4j Circuit Breaker** — when employee-service is down, return a fallback response instead of a flood of 503s
- **Distributed tracing** — one request passes through 2 services; stitch the logs together
- **Docker Compose** — 4 services + 2 databases with one command
- **Kafka events** — an "employee deleted" event → leave-service reacts on its own (async communication)
- **Auth (JWT) at the Gateway** — who you are and what you may do

---

*Happy learning! Whenever a concept confuses you, trace the flow diagrams in Section 9 — they are the best teacher. 🚀*
