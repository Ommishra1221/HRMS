# Feign, Eureka & Gateway — the plumbing, step by step

> Last reviewed: written from current source code

## 1. The full journey of one internal call

```
LeaveServiceImpl.createLeave()  needs employee 5's name
        ↓
fetchEmployeeOrThrow(5)                      (LeaveServiceImpl)
        ↓
employeeClient.getEmployeeById(5)            looks like a local method call…
        ↓
Feign builds an HTTP request:
    GET http://employee-service/employees/5
        ↓
FeignTokenRelay.apply(template)              (RequestInterceptor)
    template.header("Authorization", "Bearer " + caller's-token)
        ↓
Spring Cloud LoadBalancer asks Eureka: "instances of employee-service?"
    Eureka → [http://localhost:8081]         (name → address, from the registry)
        ↓
HTTP GET http://localhost:8081/employees/5
        ↓
employee-service's JwtAuthenticationFilter verifies the RELAYED token
    → role + ownership checks run exactly as for a browser call
        ↓
EmployeeResponse JSON comes back
        ↓
response.setEmployee(...)                    composed into the leave response
```

**WHY each hop exists:**
- **Feign** — turns an interface into an HTTP client; no RestTemplate boilerplate.
- **Eureka** — no hardcoded `localhost:8081` anywhere in leave-service.
- **LoadBalancer** — picks one instance when there are several.
- **Token relay** — the internal call is made *as the original user*, so
  employee-service's ownership rules still apply. No "trusted service account"
  backdoor exists.

**IF IT FAILS:**
- employee-service answers 404 → `FeignException.NotFound` →
  `fetchEmployeeOrThrow` throws `EmployeeServiceException` → browser gets **404**.
- employee-service is unreachable → `FeignException` → `GlobalExceptionHandler` →
  **503** "Employee service is currently unavailable".

## 2. The actual client (leave-service)

```java
@FeignClient(name = "employee-service")          // Eureka name — not a URL
public interface EmployeeClient {
    @GetMapping("/employees/{id}")
    EmployeeResponse getEmployeeById(@PathVariable("id") Long id);
}
```
Four lines. Feign generates the implementation at startup
(`@EnableFeignClients`/auto-config), LoadBalancer and Eureka make it service-name
addressable. Attendance and payroll declare the identical interface in their own
packages — each service is self-contained.

## 3. Eureka's two sides

**Server** (`discovery-server`, 8761): `@EnableEurekaServer`;
`register-with-eureka=false`, `fetch-registry=false` — the phone book doesn't list
itself.

**Clients** (all five services + gateway):
```properties
eureka.client.service-url.defaultZone=http://localhost:8761/eureka
```
Services register under `spring.application.name` and heartbeat to stay listed. The
gateway resolves `lb://…` route URIs the same way Feign clients do.

## 4. Gateway routing rules (the browser-facing half)

```properties
spring.cloud.gateway.server.webflux.routes[0].uri=lb://employee-service
spring.cloud.gateway.server.webflux.routes[0].predicates[0]=Path=/api/employees/**
spring.cloud.gateway.server.webflux.routes[0].filters[0]=StripPrefix=1
```
Reading it backwards: predicate matches → filter rewrites the path (`/api` dropped)
→ `lb://` resolved via Eureka → request proxied with all headers (including
`Authorization`). Five routes exist: employees, leaves, attendance, payroll, auth.

## 5. External vs internal request — side by side

```
EXTERNAL (browser)                         INTERNAL (service → service)
React → :8080/api/leaves                   LeaveServiceImpl → EmployeeClient
  StripPrefix → :8082/leaves                 Feign → :8081/employees/{id}
  JWT verified by leave-service              JWT relayed, verified by employee-service
  role gate + ownership                      same rules, same token, same outcome
```

Same security machinery on both paths — that's the point of the relay.

## 6. Beginner mistakes
- Expecting Feign to retry or timeout silently — a failure surfaces as
  `FeignException`; you must translate it (the handlers do).
- Hardcoding ports inside Feign clients (breaks discovery; use the name).
- Circumventing the gateway between services "because it's internal" — services call
  services directly by name; the gateway is browser-only.
- Forgetting `@PathVariable("id")` name in the Feign method (compiles fine, fails at
  runtime on newer JDKs).
- Testing `lb://` resolution with Eureka down — first resolution attempt fails even
  if the target service is up.

## 7. Interview questions
- **Declarative client?** Feign: describe the endpoint in an interface; the framework implements it.
- **How does `employee-service` resolve?** Eureka registry + Spring Cloud LoadBalancer via `lb://`.
- **Why relay the user's token on internal calls?** Keeps ownership enforcement end-to-end; a service account would silently trust every lookup.
- **What status does the browser see if employee-service dies mid-request?** 503, with the project's standard JSON error shape.
- **Where would you add resilience?** Timeouts/retry budgets or a circuit breaker on the Feign client, response caching/batching for composition — a documented next step, not implemented here.
