# Java & Spring Concepts Used (in this codebase)

> Last reviewed: written from current source code
> Source of truth: every concept below appears in actual project files

For each concept: **WHAT / WHY / HOW / WHERE / WHEN / WHO calls it / IF IT FAILS.**

## Spring Boot / IoC

**`@SpringBootApplication`** — WHAT: starts Spring's component scan + auto-configuration.
WHERE: each `*Application.java`. WHEN: `main()` runs. WHY: zero XML wiring.
**`@Configuration` + `@Bean`** — WHAT: a class producing framework objects.
WHERE: `SecurityConfig.passwordEncoder()` (the BCrypt bean), `filterChain()`.
WHY: modern Boot 4.x/Security 7 style replaced `WebSecurityConfigurerAdapter`.
**Constructor injection** — WHAT: dependencies arrive via constructor parameters.
WHERE: every `*ServiceImpl`, controller, filter. WHY: `final` fields, testable, no
field-injection magic. WHO: Spring's container, at startup.
**`@Value("${app.jwt.secret}")`** — WHAT: inject one property. WHERE: `JwtUtil`
constructors. IF MISSING: context fails to boot (fail-fast, good).

## JPA / Hibernate

**`@Entity` / `@Table(name="employees")`** — one class = one row; explicit table name.
**`@Id` + `@GeneratedValue(IDENTITY)`** — PostgreSQL auto-increments; `save()` on a
null-id entity = INSERT, with id = UPDATE.
**`@Column(nullable=false, unique=true)`** — the DB contract; `email` and
`users.employee_id`/`username`/`email` rely on it.
**`@ManyToMany @JoinTable(name="users_roles")`** — auth's only join table; Hibernate
creates and maintains it.
**`ddl-auto=update`** — creates/evolves tables at startup. Fine for learning;
Flyway is the production answer (future improvement).
**`spring.jpa.properties.hibernate.default_schema`** — every SQL statement is
schema-qualified: the one-database-five-schemas isolation mechanism.
**Dirty checking** — loaded-and-modified entities are flushed automatically inside
`@Transactional`; the code still calls `save()` explicitly for clarity.

## Spring Data JPA (repositories)

**`JpaRepository<T, ID>`** — free `findAll/findById/save/delete/exists`.
**Derived queries** — method names become SQL:
`findByEmployeeId` → `WHERE employee_id = ?`;
`findByEmployeeIdAndMonth` → `WHERE employee_id = ? AND month = ?`;
`findByEmployeeIdOrderByAttendanceDateDesc` → ordered WHERE;
`countByRoles_NameAndEnabledTrueAndIdNot` → the last-admin COUNT with joins.
WHERE: the five repository interfaces. WHY: no SQL strings to mistype.

## Validation

**Jakarta Validation (`@NotBlank`, `@NotNull`, `@Email`, `@Size`, `@Pattern`) +
`@Valid`** — request DTOs are checked *before* the service runs; failure →
`MethodArgumentNotValidException` → 400 with the first field error's message.
WHERE: `EmployeeRequest`, `LeaveRequest`, `CreateUserRequest` (username charset
`@Pattern`!), etc.

## Spring MVC layering

**`@RestController` + `@GetMapping`/`@PostMapping`/`@PutMapping`/`@PatchMapping`/
`@DeleteMapping`/`@PathVariable`/`@RequestBody`/`@RequestParam`** — HTTP mapping.
Controllers stay thin: map, validate, delegate.
**`ResponseEntity`** — explicit status codes: 201 + body on create, 204 on delete.
**`@RestControllerAdvice` + `@ExceptionHandler`** — `GlobalExceptionHandler` per
service translates exceptions to `{timestamp,status,error,message}`. The
`AccessDeniedException` handler exists specifically so `@PreAuthorize` failures
return 403, never the 500 the catch-all would produce.
**PATCH semantics** — partial lifecycle actions (`/attendance/{id}/checkout`,
`/payroll/{id}/paid`) use PATCH with tiny bodies instead of full PUTs.

## Transactions

**`@Transactional`** — one request's writes commit atomically; `readOnly=true` on
queries hints Hibernate. WHERE: every service-impl method. IF IT FAILS: rollback,
error surfaces as 500 (or the specific exception).

## Spring Security

**`SecurityFilterChain` (bean style)** — the modern rulebook; see
`config/SecurityConfig` in all five services. STATELESS sessions, CSRF off (JWT
headers, no cookies).
**`@EnableMethodSecurity` + `@PreAuthorize`** — method-level locks
(`hasRole('ADMIN')`, `hasAnyRole(...)`); fired exceptions surface as
`AccessDeniedException` inside the servlet.
**`OncePerRequestFilter`** — `JwtAuthenticationFilter` runs exactly once per request,
before authorization, and fills `SecurityContextHolder`.
**`AuthenticationManager`** — the login engine; `DaoAuthenticationProvider` under the
hood wires `CustomUserDetailsService` + `PasswordEncoder`.
**`UserDetailsService`** — the bridge to our `users` table; returns Spring's
`UserDetails` with the **hash** and the enabled flag.
**`SecurityContextHolder`** — the per-request "who is calling?" slot; read by
`CurrentUser.get()` and by `@PreAuthorize`.

## JWT (JJWT library)

**`Jwts.builder().subject(...).claim(...).signWith(key).compact()`** — issue
(auth-service only). **`Jwts.parser().verifyWith(key).parseSignedClaims(token)`** —
verify everywhere; a bad signature/expiry throws `JwtException`.
**`Keys.hmacShaKeyFor(secret.getBytes())`** — secret length picks HS256/384/512
(75-char demo secret → HS512).

## OpenFeign

**`@FeignClient(name = "employee-service")`** — an interface becomes an HTTP client;
Eureka resolves the name, LoadBalancer picks an instance.
**`RequestInterceptor`** — `FeignTokenRelay` attaches the caller's JWT to every
outgoing call.
**`FeignException`** — the error channel; handlers map it to 503 (unreachable) or
translate `.NotFound` to a domain 404.

## Microservice infrastructure

**Eureka client/server** — `@EnableDiscoveryClient` everywhere;
`@EnableEurekaServer` + the two `false` flags on the registry.
**Gateway route predicates** — `Path=/api/x/**`, `StripPrefix=1`, `lb://` URIs
(properties only; no Java config).

## Java language features the code relies on

- **Records** — `CurrentUser.AuthUser(String username, Long employeeId)`: an
  immutable identity carrier in one line.
- **BigDecimal** — all payroll money; `add/subtract`, DB `NUMERIC(12,2)`.
- **`LocalDate` / `LocalTime`** — dates and clock times without timezone pain
  (`checkOut.isBefore(checkIn)`).
- **Streams** — `list.stream().map(this::toResponse).toList()` mapping in every
  service.
- **`Optional`** — `findById().orElseThrow(() -> new …NotFoundException(...))`.
- **Records/switch-free pattern matching** — `authentication.getCredentials()
  instanceof String token` in `FeignTokenRelay`.
- **Enums as whitelists** — `RoleName` compiles the valid role set into the JVM.

## Lombok?

**Not used.** Every getter/setter is written by hand — verbose but explicit, and
beginners can see exactly what a "getter" is.
