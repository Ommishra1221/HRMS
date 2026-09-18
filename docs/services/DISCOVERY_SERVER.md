# Discovery Server (Eureka)

> Last reviewed: written from current source code
> Source of truth: `discovery-server/src/main/java/.../DiscoveryServerApplication.java`, `application.properties`
> Service: discovery-server · Port: 8761 · Database: none

## 1. What is this service?
The smallest application in the project: the **phone book**. It keeps a live list of
"which services exist right now, and at which address", viewable at
`http://localhost:8761`.

## 2. Why does it exist?
Employee-service's port (8081) must not be hardcoded into leave-service, the gateway,
or anywhere else. Services change ports, scale to many instances, and restart. With a
registry, callers ask by **name** (`employee-service`) and get a live address.

## 3. What does it own?
Nothing. No database, no entities, no business logic. It owns the *registry* in
memory. It explicitly owns no business data.

## 4. Port and configuration
```properties
spring.application.name=discovery-server
server.port=8761
eureka.client.register-with-eureka=false   # the phone book doesn't list itself
eureka.client.fetch-registry=false         # it IS the lookup
```
The main class is a 20-line app annotated `@EnableEurekaServer`.

## 5. Folder structure
```
discovery-server/
└── src/main/
    ├── java/.../discovery/DiscoveryServerApplication.java   (@SpringBootApplication + @EnableEurekaServer)
    └── resources/application.properties                     (port + the two false flags)
```

## 6. Database
None — deliberately. Nothing in this service touches PostgreSQL.

## 7–8. Entity / DTOs
None. Eureka manages its own in-memory registry model internally.

## 9. Repository
None.

## 10. Service layer
No business service. The "logic" is the registry itself: services **register**
(heartbeats keep their entry alive), callers **fetch** the registry. If a service
stops heart-beating, its entry expires and callers stop being routed to it.

## 11. Controller
None of ours. Eureka serves its dashboard at `/` and client APIs under `/eureka/*`.

## 12. Exception handling
N/A — no custom handlers.

## 13. Service-to-service communication
It *is* the endpoint of communication: every other service sets
`eureka.client.service-url.defaultZone=http://localhost:8761/eureka` and registers
here; the gateway and Feign clients resolve `lb://…` names against it.

## 14. Full request lifecycle
Startup order: this must be **first**. A service starting before it retries
registration; the gateway resolves names only for services already registered.

## 15. Frontend connection
None. The browser never talks to Eureka.

## 16. Security / role rules
None on the dashboard (learning project). In production you would secure it.

## 17. Beginner mistakes
- Starting services before Eureka and assuming they're broken (they retry).
- Setting `register-with-eureka=true` on the server itself.
- Forgetting the trailing `/eureka` path in `defaultZone`.

## 18. Interview questions
- **What does Eureka do here?** Service discovery: register + lookup by logical name.
- **Why `register-with-eureka=false` on the server?** A registry must not register itself.
- **What if Eureka is down?** Existing instances keep working via cached registries; new instances can't be discovered.
- **Client-side vs server-side discovery?** This is client-side: the caller (gateway/Feign+LoadBalancer) picks an instance from the fetched registry.

## 19. Quick revision
1. Port 8761, dashboard at `/`.
2. `@EnableEurekaServer` is the only special annotation.
3. All five services + gateway register here.
4. `lb://` URIs resolve via Eureka.
5. No database at all.
6. `defaultZone` is the only required client setting.
7. Heartbeats keep entries alive; stale entries expire.
8. It never calls any business service.

## 20. One-minute explanation
"HRMS has a Eureka discovery server on 8761 — just the service registry, no database.
Every service and the gateway register with it using their `spring.application.name`,
and callers like the Gateway and the Feign clients ask it for `lb://employee-service`
instead of hardcoding ports. That's why services can move or scale without touching
anyone's configuration."
