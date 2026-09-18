# Spring Security & JWT (taught by this project)

> Last reviewed: written from current source code
> Source of truth: `auth-service/.../security/**`, `config/SecurityConfig` in all services

## 1. The filter chain — WHEN does it run?

Every request passes a chain of servlet filters *before* any controller:

```
Request → JwtAuthenticationFilter (ours) → Authorization rules (SecurityConfig)
        → @PreAuthorize → Controller
```

- The filter runs **once per request** (`OncePerRequestFilter`), **before**
  authorization — that's why it's registered with
  `addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)`.
- Its single job: answer "is there a valid token?" and park the result in
  `SecurityContextHolder`. It never rejects by itself — it just declines to
  authenticate, and the rules decide next (401 vs 403).

## 2. SecurityConfig (the same shape in all five services)

```java
http.csrf(csrf -> csrf.disable())                                  // stateless API
    .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))    // no sessions, ever
    .authorizeHttpRequests(auth -> auth
        .requestMatchers("/auth/login").permitAll()                // auth-service only
        .requestMatchers("/auth/users/**").hasRole("ADMIN")
        .requestMatchers("POST", "/employees").hasRole("ADMIN")    // example
        .anyRequest().authenticated())
    .exceptionHandling(ex -> ex
        .authenticationEntryPoint(...)   // writes the 401 JSON
        .accessDeniedHandler(...))       // writes the 403 JSON
    .addFilterBefore(jwtAuthenticationFilter, …);
```

Why the entry point / denied handler are hand-written: security filters run **before**
the MVC layer, so `GlobalExceptionHandler` never sees these errors — and the project
promises every error body to be `{timestamp,status,error,message}`.

`hasRole("ADMIN")` looks for the authority string `"ROLE_ADMIN"` — the `ROLE_` prefix
is Spring's convention, which is why `RoleName.toAuthority()` exists.

## 3. BCrypt — WHY and HOW

- **WHAT:** a password *hashing* function designed to be slow and salted.
- **WHY not SHA-256?** Fast hashes are brute-forceable; BCrypt's work factor + a
  random salt per hash ($2a$10$…) makes cracking expensive and rainbow tables useless.
- **HOW here:** one bean (`SecurityConfig.passwordEncoder()`), used by
  `UserServiceImpl` on create/reset and by `DataSeeder`. Verification happens inside
  `AuthenticationManager.authenticate()` — compare, never decrypt.
- **WHERE the plain text exists:** only as a local variable in the request thread.
  Never logged, never stored, never in a JWT.

## 4. The JWT, dissected

```text
eyJhbGciOiJIUzUxMiJ9 . eyJzdWIiOiJlbXBsb3llZSIs… } . 4fOc9k…Q
   HEADER                    PAYLOAD                SIGNATURE

HEADER    {"alg":"HS512"}
PAYLOAD   {"sub":"employee",            ← who
           "userId":3,                  ← auth_db users.id
           "roles":["ROLE_EMPLOYEE"],   ← exactly one
           "employeeId":1,              ← omitted entirely for admin/HR
           "iat":1760000000,
           "exp":1760086400}            ← 24 h lifetime
SIGNATURE HMAC-SHA512(base64(header) + "." + base64(payload), app.jwt.secret)
```

- **Signed ≠ encrypted.** Decode the payload at jwt.io and you can read it — that is
  *why* no secret data may live there. But change one character and the signature
  check fails: **integrity** is guaranteed, **confidentiality** is not.
- **Expiration:** `exp` is checked during `parseSignedClaims`; an expired token is
  just an invalid token → 401.
- **The shared secret** (`app.jwt.secret`, identical in all five
  `application.properties`) is the entire trust model: only auth-service *issues*,
  everyone *verifies*. Leaking it means anyone can mint tokens — hence "change me in
  production".

## 5. Login flow (issue side)

```
POST /auth/login
  → AuthenticationManager.authenticate(username, password)
      → DaoAuthenticationProvider
          → CustomUserDetailsService.loadUserByUsername   (our UserRepository)
          → enabled flag? (false → DisabledException)
          → BCrypt matches(typed, hash)?
  → any failure → same vague 401 "Invalid username or password"  (anti-enumeration)
  → JwtUtil.generateToken(sub, userId, roles, employeeId?)       (claim omitted if null)
  → AuthResponse { token, "Bearer", roles, employeeId, … }
```

## 6. Verify flow (every protected request, in every service)

```
Authorization: Bearer eyJ… | JwtUtil.validateToken  (signature + exp)
  → extract roles → SimpleGrantedAuthority("ROLE_EMPLOYEE")
  → principal = AuthUser(username, employeeId), credentials = raw token
  → SecurityContextHolder.getContext().setAuthentication(...)
  → URL rules → @PreAuthorize → controller
  → CurrentUser.get() → ownership checks in the service layer
```

Defense in depth: an empty `roles` claim is treated as anonymous (a hand-made token
with no roles cannot pass an "authenticated" endpoint).

## 7. ROLE authorization vs RESOURCE ownership

```
ROLE AUTHORIZATION (coarse)             RESOURCE OWNERSHIP (fine)
"May ROLE_EMPLOYEE call GET             "Is leave #17 really yours?"
 /leaves/{id} at all?"                  row.employeeId == JWT.employeeId?
WHERE: SecurityConfig + @PreAuthorize   WHERE: ServiceImpl + CurrentUser
FAILS → 403 (accessDeniedHandler)       FAILS → 403 (ForbiddenOperationException)
```

Both are needed. Role alone would let employee A read employee B's leave; ownership
alone would have no reason to let an employee touch leave endpoints at all.

## 8. SecurityContext — the per-request identity slot

`SecurityContextHolder` holds an `Authentication` for the current thread:

- `getName()` → username (used by `/auth/me`);
- `getAuthorities()` → the role list (used by `@PreAuthorize` and `CurrentUser`);
- `getPrincipal()` → our `AuthUser` record (username + employeeId — used by
  ownership checks);
- `getCredentials()` → the raw token (used by `FeignTokenRelay`).

It is cleared automatically between requests (stateless); `CurrentUser.get()` throws
`IllegalStateException` (→ 500) if the filter never ran — a misconfiguration, not a
client error.

## 9. Authorization for `/auth/users` — belt and braces

The URL rule (`hasRole("ADMIN")`) *and* a class-level `@PreAuthorize("hasRole('ADMIN')")`
on `UserController` are two independent locks: if a future endpoint is mapped outside
`/auth/users`, the method lock still refuses HR/EMPLOYEE callers with 403.

## 10. Common beginner mistakes
- Confusing 401 and 403 (401 = who are you?; 403 = I know you, you can't).
- Looking up the user **from the database** in every request — unnecessary; the
  signature already proves the claims. (The projects does re-read the DB on
  `/auth/me` for fresh profile data — that's a choice, not a requirement.)
- Trusting a userId from the request body/URL for authorization instead of the token.
- Disabling CSRF "because" — it's correct here only because there are no cookies.
- Forgetting that tokens of a disabled user still pass *signature* checks until
  expiry — role/ownership checks still constrain them.

## 11. Interview one-liners
- "Stateless JWT auth: one issuer, shared-secret verifiers, 24-hour tokens."
- "Roles in the token, ownership in the service layer, identity only from the JWT."
- "BCrypt for storage, HMAC for transport integrity."
- "401 vs 403 decides which handler answers: entry point or access-denied handler."
