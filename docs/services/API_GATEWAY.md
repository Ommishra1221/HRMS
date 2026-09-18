# API Gateway

> Last reviewed: written from current source code
> Source of truth: `api-gateway/src/main/resources/application.properties`
> Service: api-gateway · Port: 8080 · Database: none

## 1. What is this service?
Spring Cloud Gateway (WebFlux): a **reverse proxy** on 8080. It receives every browser
request and forwards it to the right microservice.

## 2. Why does it exist?
Three reasons: the browser gets **one origin** (no five ports), **CORS** is solved in
one place, and the topology behind it can change freely. It also gives you a natural
future home for cross-cutting concerns (rate limiting, gateway-level JWT checks).

## 3. What does it own?
Routing rules and the CORS policy. No database, no business data, no logic.

## 4. Port and configuration
```properties
server.port=8080
spring.application.name=api-gateway
# five routes, one per service - e.g.:
spring.cloud.gateway.server.webflux.routes[0].uri=lb://employee-service
spring.cloud.gateway.server.webflux.routes[0].predicates[0]=Path=/api/employees/**
spring.cloud.gateway.server.webflux.routes[0].filters[0]=StripPrefix=1
# auth:
spring.cloud.gateway.server.webflux.routes[4].predicates[0]=Path=/api/auth/**
```
`lb://` = resolve the name via Eureka and load-balance across live instances.
`StripPrefix=1` removes `/api`, so `/api/employees/7` → `/employees/7` on 8081.

## 5. Folder structure
```
api-gateway/
└── src/main/
    ├── java/.../gateway/ApiGatewayApplication.java   (@SpringBootApplication - that's all)
    └── resources/application.properties              (all routes + CORS live here)
```

## 6. Database
None. The gateway is stateless by design.

## 7–9. Entity / DTOs / Repository
None — it never sees a JPA entity, only HTTP.

## 10. Service layer
No service layer. "Logic" = route matching → header forwarding → proxying.

## 11. Controller
None. The effective endpoint table:

| Browser calls | Forwards to |
|---|---|
| `/api/employees/**` | `lb://employee-service` |
| `/api/leaves/**` | `lb://leave-service` |
| `/api/attendance/**` | `lb://attendance-service` |
| `/api/payroll/**` | `lb://payroll-service` |
| `/api/auth/**` | `lb://auth-service` |

## 12. Exception handling
No custom handlers; it proxies whatever status the services produce.

## 13. Service-to-service communication
It is a Eureka **client**: registers itself and fetches the registry to resolve
`lb://` names. It does not use Feign.

## 14. Full request lifecycle
```
Browser → 8080 → match Path predicate → StripPrefix=1 → resolve lb:// via Eureka
        → forward (Authorization header included, untouched) → service answers → relay back
```

## 15. Frontend connection
This **is** the frontend's whole world: `axiosInstance` uses
`http://localhost:8080` for every call, and CORS allows exactly
`http://localhost:5173` and `http://127.0.0.1:5173` (preflight OPTIONS included —
hence PATCH in `allowedMethods`).

## 16. Security / role rules
**Current implementation:** the gateway **forwards** the `Authorization` header but
does **not verify** JWTs — verification happens inside each service. This is a
deliberate learning simplification. *Recommended future improvement:* verify the JWT
at the gateway with a shared-secret filter so invalid tokens are rejected before
reaching any service (documented as future, not current).

## 17. Beginner mistakes
- Calling a service port directly from React (breaks the whole model and CORS).
- Forgetting `StripPrefix=1` and wondering why you get 404s.
- Testing CORS from Postman — Postman has no origin; CORS is a browser rule.
- Editing routes without restarting the gateway.

## 18. Interview questions
- **Why a gateway?** Single entry point, central CORS, topology hiding; future home for cross-cutting filters.
- **What does StripPrefix do?** Drops the first path segment (`/api`) before forwarding.
- **How is `lb://` resolved?** Via Eureka + Spring Cloud LoadBalancer.
- **Does the gateway authenticate here?** No — it forwards the token; services verify (future improvement documented).

## 19. Quick revision
1. Port 8080, no database.
2. Five routes: employees, leaves, attendance, payroll, auth.
3. `/api/**` → StripPrefix=1 → service path.
4. `lb://` = Eureka name lookup + load balancing.
5. CORS for :5173 configured globally here only.
6. Header is forwarded untouched; no JWT verification (today).
7. WebFlux-based (reactive) but you write no reactive code.

## 20. One-minute explanation
"The gateway is the only address the React app knows — 8080. It matches `/api/{service}/**`,
strips the `/api` prefix, resolves the service name through Eureka and forwards,
including the JWT header. It owns no business logic and no database; it exists so the
browser has one origin and CORS is configured exactly once. In this project it does
not verify tokens — each service's Spring Security does that — which is a documented
future improvement at the gateway."
