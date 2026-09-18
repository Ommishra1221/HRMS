# Microservices Concepts (as this project implements them)

> Last reviewed: written from current source code

A concepts dictionary where every entry is grounded in this repo. Each answer follows
WHAT / WHY / HOW / WHERE / WHEN / IF IT FAILS.

## Monolith vs microservices

**WHAT:** one deployable vs many small independently deployable services.
**WHY here:** learning value — each concept (discovery, gateway, Feign, per-service
security) has exactly one home; and the domain splits cleanly into five data owners.
**COST (honest):** network calls replace method calls; duplication of config; harder
local debugging. This project accepts those costs *to teach the pattern*.

## Database-per-service

**WHAT:** each service owns a private schema; nobody else touches it.
**WHERE:** `hibernate.default_schema=…` × 5; entities hold plain `employeeId`
numbers. **WHY:** independent evolution; no hidden coupling through shared tables.
**IF BROKEN:** one service's migration could break another's queries — which is why
cross-schema access is impossible here (no JPA mappings exist for foreign tables).

## API composition

**WHAT:** a response is stitched together from two services at request time.
**WHERE:** `LeaveResponse.employee`, `AttendanceResponse.employee`,
`PayrollResponse.employee` — filled live by `EmployeeClient` calls.
**TRADE-OFF:** an N+1 Feign call per list row (documented in code comments); a
downstream outage degrades reads to 503 instead of returning stale copies. Production
alternatives: caching, batching, or an id-only API.

## Service discovery (Eureka)

See [services/DISCOVERY_SERVER.md](../services/DISCOVERY_SERVER.md).
Key idea: names not addresses; `lb://` + LoadBalancer resolve via the registry.

## API Gateway

See [services/API_GATEWAY.md](../services/API_GATEWAY.md).
Key idea: one browser-facing origin; `Path` predicates + `StripPrefix=1`; CORS
configured once. Gateway-level JWT verification is documented as a *future*
improvement — the current gateway forwards tokens without checking them.

## Inter-service communication (Feign)

See [services/LEAVE_SERVICE.md §13](../services/LEAVE_SERVICE.md).
Key idea: declarative client interfaces; token relay keeps ownership intact on
internal calls; failures become 404/503 at the caller's edge.

## Data consistency without distributed transactions

The project avoids two-phase-commit entirely by giving each service exclusive
ownership and validating inputs at write time:
- employee existence validated via Feign before a leave/attendance/payroll row is
  saved;
- duplicates blocked in service code (one-per-day, one-per-month);
- deletion of an employee does not cascade (soft references keep their ids; composed
  lookups of a deleted employee simply 404 and the UI shows "employee lookup
  failed").

## Idempotent seeding

`DataSeeder` (auth) runs at every startup and only creates what is missing — the
bootstrap solution to "there is no signup, so who creates the first admin?"

## Stateless authentication

No HTTP session anywhere (`SessionCreationPolicy.STATELESS`). The JWT carries
identity + role + employeeId; every service verifies it locally. See
[SPRING_SECURITY_AND_JWT.md](SPRING_SECURITY_AND_JWT.md).

## Failure isolation

If one service is down: the others keep serving everything that doesn't need it.
Concrete example: employee-service down ⇒ leave/attendance/payroll reads answer 503
(name composition impossible), but **auth and employee CRUD unaffected**; the
frontend shows per-card "service unavailable" instead of a broken screen.

## Why not micro-frontends / service mesh / Kafka?

Not present — and not claimed. The project is synchronous HTTP (gateway + Feign) with
a registry. If asked in an interview: message queues would suit async workflows
(notifications), a service mesh replaces gateway/registry features at larger scale —
neither is justified at this size.
