# Probation Assessment Module — Independent Audit

| | |
|---|---|
| Audit type | Independent verification of the newly implemented Probation Assessment module |
| Method | Source reading + compilation + live end-to-end execution against the running stack |
| Source of truth | The source tree and the running system at audit time (not the implementation report) |
| Audited scope | `probation-service/`, `auth-service` reviewer endpoints, gateway route, `probation_schema`, React UI |
| Overall verdict | **FAIL — module incomplete.** Backend: PASS WITH ISSUES. Frontend: **FAIL (absent).** |

> **Read this first.** The backend security model is genuinely well built — every
> authorization and ownership probe I ran returned the correct status code, and the
> database enforces its own invariants independently of the Java code. The reason the
> overall verdict is not a pass is that **a whole required layer does not exist**
> (no React routes, pages, hooks or API clients), and the test suite is **not
> deterministic** in a full run. Findings below are separated into *verified defects*
> and *untested assumptions*.

---

## 0. Audit environment and what was actually executed

| Action | Command | Result |
|---|---|---|
| Compile `probation-service` | `./mvnw -q -DskipTests compile` | **exit 0** |
| Compile `auth-service` | `./mvnw -q -DskipTests compile` | **exit 0** |
| Frontend production build | `npm run build` (hrms-frontend) | **exit 0**, 2002 modules |
| Boot `probation-service` | `mvnw spring-boot:run` | **started in 13.4 s**, Eureka `UP` on `:8086` |
| Flyway | — | `V1` applied, `V2` applied on restart (see **D-10**) |
| Live E2E probes | 2 probe scripts, ~45 requests with real JWTs | see §3 |
| `probation-service` tests | `./mvnw test` (run A) | **18 run, 3 FAILED** |
| `probation-service` tests | `./mvnw test -Dtest=…#queuesStatistics…` (isolated) | **1/1 pass** |
| `probation-service` tests | `./mvnw test` (run B, same command) | **18/18 pass** |
| `auth-service` tests | `./mvnw test` | **3/3 pass** |

Live accounts used: `admin/Admin@123` (ROLE_ADMIN), `hr/Hr@123` (ROLE_HR),
`emp01/Emp01@123` (ROLE_EMPLOYEE, employeeId 1), `emp02`, `emp05` (assigned manager),
`emp06` (unrelated employee).

**Side effects on the local database are disclosed in §7.**

---

## 1. Requirements coverage matrix

Requirements are taken from the Probation Assessment brief. "Verified" means I
executed it against the running service, not that the code looks right.

### 1.1 Workflow

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | **HR creates the assessment** | ✅ Verified | `HR POST /probation/assessments` → **201**, `id=1, version=0` |
| 2 | Only HR creates (no employee, no admin self-service) | ✅ Verified | EMPLOYEE → **403**, ADMIN → **403** |
| 3 | HR sends to the assigned manager | ✅ Verified | `send-for-evaluation` → **200**, `DRAFT → PENDING_MANAGER_EVALUATION` |
| 4 | **Assigned manager evaluates** (8 criteria, scores 1–5, comments, strengths, gaps, recommendation) | ✅ Verified | `PUT /evaluation` by emp05 → **200**, `overallScore=4.00`; by emp01/HR → **403** |
| 5 | Manager submits | ✅ Verified | `submit-evaluation` → **200**, `→ PENDING_HR_REVIEW`; incomplete form → **400** |
| 6 | **HR reviews** | ✅ Verified | `forward-for-approval` → **200**, `→ PENDING_ADMIN_APPROVAL` |
| 7 | **HR returns to manager** | ✅ Verified | `return-to-manager` → **200**, `→ RETURNED_TO_MANAGER`; manager re-saved and resubmitted successfully |
| 8 | HR cannot make the decision | ✅ Verified | HR `POST /decision` → **403** |
| 9 | **ADMIN approves** | ✅ Verified | ADMIN `POST /decision` → **200**, `→ CONFIRMED` |
| 10 | Manager cannot forward/decide | ✅ Verified | emp05 `forward-for-approval` → **403** |
| 11 | **Employee views the published outcome** | ⚠️ Partial | `GET /probation/me` → **200** with `finalDecision`, `publishedComments`, `revisedEndDate`. **But non-published cycles are also returned** — see **D-6** |
| 12 | Confirmation | ✅ Verified | `CONFIRMED` row, `version=5`, `finalDecision=CONFIRMED` |
| 13 | Extension | ✅ Verified | `EXTENDED` + `revisedEndDate=2027-01-01`; missing date → **400**; date on `CONFIRMED` → **400** |
| 14 | Non-confirmation | ✅ Code-verified + unit-tested | `NOT_CONFIRMED` path in `WorkflowRules.decision`; `ProbationIntegrationTest.nonConfirmationIsRecorded…` passes |
| 15 | Extension spawns a linked follow-up cycle | ✅ Verified | follow-up → **201**; duplicate → **409**; wrong dates → **400** |
| 16 | **Audit history** | ✅ Verified | 7 rows for assessment 3, incl. `RETURNED_TO_MANAGER`, `REASSIGNED` support; append-only |
| 17 | **Finalized records immutable** | ✅ Verified | API → **409**; raw `UPDATE` → `Finalized probation assessments are immutable`; raw `DELETE` of history → `Probation history is append-only` |

### 1.2 Non-functional requirements

| # | Requirement | Status | Notes |
|---|---|---|---|
| 18 | Gateway route `/api/probation/**` | ✅ Verified | `401` via gateway; `404` until the gateway was restarted — see **D-2** |
| 19 | Eureka registration | ✅ Verified | `PROBATION-SERVICE` present in `/eureka/apps` |
| 20 | Own schema, no cross-service DB access | ✅ Verified | Only `probation_schema`; employee/reviewer data fetched over Feign |
| 21 | Feign token forwarding | ✅ Verified | `FeignTokenRelay` forwards the caller's JWT; `directory.employees()` returned real employee data as HR |
| 22 | **React pages / routes / hooks / API clients** | ❌ **ABSENT** | **Zero** probation files in `hrms-frontend/` — see §4 |
| 23 | Automated regression tests | ⚠️ Present but non-deterministic | 18 tests exist; → **D-3** |
| 24 | Documentation for the module | ❌ Absent | No `docs/` entry for probation before this report |

---

## 2. Security and architecture findings

### 2.1 What is genuinely solid (independently verified)

These are not "looks fine" claims — each was exercised:

- **Two independent authorization layers.** `SecurityConfig`
  (`probation-service/.../config/SecurityConfig.java:19`) gates `/probation/**` to the
  three roles; `@PreAuthorize` gates the methods
  (`ProbationController.java:20,22,41,44,45,48,52,54,56,58`); the service re-checks
  with `CurrentUser.requireRole` (`ProbationServiceImpl.java:35,60,120,159,166,173`).
- **Manager authorization is assignment-based, not client-supplied.**
  `requireManager()` (`ProbationServiceImpl.java:218`) compares
  `assessment.reportingManagerUserId` with `CurrentUser.userId()` **from the JWT**, and
  separately rejects the case where the caller is the assessment's own employee.
  Verified: an unrelated employee → **403**; the subject → can read own outcome but
  cannot evaluate.
- **No IDOR on any tested path.** EMPLOYEE requesting another employee's assessment →
  **403**; another employee's history → **403**; `?employeeId=` pointing elsewhere →
  **403** (`ProbationServiceImpl.java:107`). Cross-employee values are never trusted.
- **JWT hardening.** `JwtAuthenticationFilter` requires `sub`, numeric `userId > 0`,
  **exactly one** role from the closed set, and a non-null expiry; anything else clears
  the context (`JwtAuthenticationFilter.java:34-40`).
- **DTO allowlists.** `CreateAssessment` / `UpdateAssessment` / `EvaluationRequest` /
  `DecisionRequest` (`ProbationDtos.java`) carry no `status`, `finalDecision`,
  `createdBy`, `reportingManagerUserId`-override or `netSalary`-style field that a
  client could abuse. No entity is returned from a controller.
- **Employee/internal response split.** `AssessmentMapper.outcome()` vs `detail()`
  (`AssessmentMapper.java:17` / `:24`). Verified: the employee response contained
  **none** of `strengths`, `ratings`, `history`, `initialRemarks`, `hrReviewRemarks`,
  `decisionRemarks`.
- **Database enforces the workflow too.** Partial `EXCLUDE` constraint prevents two
  overlapping active cycles per employee (`V1:45`); `CHECK` ties `status` to
  `final_decision` and demands a reason for extension/non-confirmation
  (`V1:40,42,43`); triggers make finalized rows and history append-only (`V1:82,93`,
  `V2:11`).
- **Optimistic locking.** Stale `version` → **409**; concurrent identical decisions were
  exercised by the test suite (`twoConcurrentDecisionsCannotBothSucceed`).
- **No secrets leaked downstream.** `GlobalExceptionHandler.java:32` logs server-side and
  returns a generic 500; Feign errors are sanitized to 503 (`:31`).

### 2.2 Findings

Severity legend — **P0** critical security/data integrity · **P1** broken workflow or
significant authorization defect · **P2** validation/maintainability/UX · **P3** minor.

---

#### D-1 · P1 · No frontend for the module (whole layer absent)

**Where** `hrms-frontend/` — nothing.

**Evidence**
```
glob  hrms-frontend/src/**/*[Pp]robation*   → 0 files
```
- `hrms-frontend/src/App.jsx` — no probation route.
- `hrms-frontend/src/config/navigation.js` — no probation nav group or item.
- `hrms-frontend/src/config/access.js` — no `probation` case in `canAccess`.
- `hrms-frontend/src/api/` — 7 API clients, no `probationApi.js`.
- `hrms-frontend/src/hooks/` — 9 hooks, no `useProbation*`.
- `hrms-frontend/src/pages/` — 23 pages, none probation.

**Actual behaviour** HR, manager, ADMIN and EMPLOYEE have **no way to reach** the module
from the product. The entire backend is reachable only by curl/Postman.

**Expected** Role-specific pages: HR intake + review queue, manager evaluation form
(8 scored criteria), ADMIN approval queue, employee "my probation" view — wiring
`/api/probation/**` through `axiosInstance` and the existing design system.

**Impact** The workflow cannot be completed by a real user. This alone makes the module
non-shippable and is the primary reason for the overall FAIL.

**Minimal fix** Add `api/probationApi.js`, `hooks/useProbation.js`, and four pages +
routes guarded with the existing `ProtectedRoute roles={[...]}` pattern; add a
`Probation` nav group for ADMIN/HR and a `My Probation` item for EMPLOYEE. No backend
change needed — the contracts in §3 are complete enough to build against.

---

#### D-2 · P1 · Deployed state diverged from source (gateway 404, create 503)

**Where** runtime, caused by `api-gateway/src/main/resources/application.properties:57-60`
and `auth-service`'s new reviewer endpoint.

**Evidence (before restart)**
```
gateway /api/probation/criteria   -> 404
auth    /auth/probation-reviewers -> 500  "No static resource auth/probation-reviewers"
probation HR POST /assessments    -> 503
```
**After restarting `auth-service` and `api-gateway`:**
```
gateway /api/probation/criteria   -> 401   (correct)
auth    /auth/probation-reviewers -> 200   {"content":[...6 reviewers...]}
probation HR POST /assessments    -> 201
```
**Cause** The routes/endpoints exist in source but were never loaded by the running
processes. Worse, `auth-service`'s `GlobalExceptionHandler` maps
`NoResourceFoundException` to **500**, so a *missing endpoint* presented as a server
fault, which `probation-service` then reported as **503 "Reference validation is
unavailable"** — a misleading error that hides a deployment problem.

**Impact** Anyone starting only *some* services sees a module that appears to be
implemented but silently fails with 503. This is exactly how a "it works on my machine"
regression ships.

**Fix** Document `probation-service` in the start order (after discovery, before
gateway) in `docs/HRMS_DATABASE_SETUP.md`, and map
`NoResourceFoundException` → **404** in `auth-service`'s handler.

---

#### D-3 · P1 · Test suite is not deterministic (same command, 3 failures then 0)

**Where** `probation-service/src/test/java/com/example/microservices/probation/ProbationIntegrationTest.java`

**Evidence — executed, same command twice**
```
Run A: ./mvnw test  → Tests run: 18, Failures: 3
  queuesStatisticsAndPaginationAreAuthorizedAndScoped:166->create:67->perform:61
      Response status expected:<201> but was:<409>
  reassignmentArchivesOldEvidenceAndRevokesPreviousManager:150->create:67
      Response status expected:<201> but was:<409>
  twoConcurrentDecisionsCannotBothSucceed:140->forwarded:80->create:67
      Response status expected:<201> but was:<409>

Isolated: -Dtest=…queuesStatistics…  → 1/1 pass
Run B: ./mvnw test  → Tests run: 18, Failures: 0  → BUILD SUCCESS
```
**Actual** Identical input produced **18/18** and then **15/18**.
**Expected** A test suite produces the same verdict on every run.

**Why it matters more than a normal flake** All three failures are the *first*
`create()` in the test, returning `409` — the status reserved for the
`no_overlapping_active_probation` exclusion constraint (`V1:45`). The class persists to
a real PostgreSQL (`src/test/resources/application-test.properties` →
`jdbc:postgresql://127.0.0.1:55436/probation_test`) with **no `@Transactional`
rollback, no truncation between methods and no per-run reset**, and mints ids from
`static final AtomicLong NEXT = new AtomicLong(System.currentTimeMillis())`. State
left by one run therefore influences the next. The "all green" claim cannot be trusted
until this is fixed.

**Minimal fix** Make the suite hermetic:
- `@Transactional` on the class (Spring rolls each test back), **or**
- truncate `probation_schema.*` in `@BeforeEach`, **or**
- derive `employeeId` from a per-test counter independent of wall-clock, and
- prefer Testcontainers over a manually-created `probation_test` database.

The production code is **not** implicated: every failing assertion was `409` on create,
i.e. the constraint doing its job on leftover rows.

---

#### D-4 · P2 · ADMIN is locked out of assessment authoring (`403`)

**Where** `ProbationController.java:20,22,48,52,54` + `ProbationServiceImpl.java:35,60,120,159,166`

**Evidence** `ADMIN POST /probation/assessments` → **403** (live).
**Expected per the platform role model** (ADMIN = "full system access", `docs/04_SECURITY_AND_ROLES.md`)
ADMIN should be able to create/update/send/forward/return. A single absent HR account
currently blocks the whole pipeline, with no override.
**Assessment** Arguably intentional ("HR creates"), but it is an undocumented divergence
from the project's stated ADMIN model, and it removes the only break-glass path.
**Fix** Either `hasAnyRole('HR','ADMIN')` + `requireOffice()` on the authoring
transitions, or document the restriction explicitly in
`docs/04_SECURITY_AND_ROLES.md` as a deliberate exception.

---

#### D-5 · P2 · Every downstream failure is flattened to `503`, masking real causes

**Where** `probation-service/.../exception/GlobalExceptionHandler.java:31`,
`client/ReferenceDirectory.java:13-19`

**Evidence** The stale `auth-service` returned **500**;
`probation-service` reported **503 "Reference validation is unavailable"**. Only
`FeignException.NotFound` is translated meaningfully
(`ReferenceDirectory.java:15` → 404, `:19` → 400).
**Impact** A downstream bug (500), a role regression (403), or a missing endpoint is
indistinguishable from a genuine outage; on-call debugging is misdirected.
**Fix** In `ReferenceDirectory`, map `FeignException.Forbidden` → 403,
`FeignException.InternalServerError` → 502/500 with a sanitized message, and keep 503
for connection/availability errors only.

---

#### D-6 · P2 · Employee sees *unpublished* cycles, not only the published outcome

**Where** `AssessmentMapper.java:17-22` (`outcome`), reached from
`ProbationController.java:34` (`/me`), `:25` (`/assessments`), `:37` (`/employees/{id}/history`)

**Evidence** — `GET /probation/me` as `emp02`, live:
```json
{"id":4,"employeeId":2,"status":"DRAFT","finalDecision":null,
 "publishedComments":null,"publishedAt":null,"previousAssessmentId":3},
{"id":3,"status":"EXTENDED","finalDecision":"EXTENDED",
 "publishedComments":"Extended to Jan 2027","publishedAt":"2026-11-03T03:24:55Z"}
```
`published` correctly masks `finalDecision`/`publishedComments`/`revisedEndDate`, but
`status` and the internal `id` are returned for the **DRAFT** row.
**Expected** The brief says "Employee views published outcome". A draft created minutes
ago should not be visible.
**Impact** Leaks internal workflow state (a renewal was opened, and its internal id) and
lets an employee watch their own case being processed — a confidentiality/UX concern,
not a privilege escalation.
**Fix** In `outcome()`, return only rows with `publishedAt != null` for the
employee-facing mappers, or null the `status`/`id` when `!published`.

---

#### D-7 · P2 · One path, two response shapes, untyped return

**Where** `ProbationController.java:24` — `public Object get(@PathVariable Long id)`

**Evidence** `GET /assessments/1` as `emp01` returns `EmployeeOutcome`
(`{"id","employeeId","probationStartDate",…}`); as HR/manager it returns
`AssessmentView` (`{"assessment":{…},"ratings":[…],"history":[…]}`). The declared return
type is `Object`.
**Impact** No stable contract for the client; any OpenAPI/client generation is useless,
and the React layer (D-1) cannot branch safely.
**Fix** Declare a common envelope, e.g. `ResponseEntity<?>` with an explicit
`AssessmentDetail | EmployeeOutcome` union in the DTOs, or split into
`/assessments/{id}` (office) and `/me/assessments/{id}` (employee).

---

#### D-8 · P2 · Several endpoints have no `@PreAuthorize` (project convention broken)

**Where** `ProbationController.java:24,25,29,34,37,42,43,50,51`

**Detail** `get`, `list`, `assignments`, `me`, `employeeHistory`, `capabilities`,
`criteria`, `evaluate`, `submit` rely **only** on service-layer checks. Every other
service in this repo deliberately uses the "two locks" pattern
(URL rule **and** `@PreAuthorize`), documented in `employee-service/SecurityConfig`.
**Evidence** I verified the service checks are correct for all of these (403/200 as
expected), so this is **not** an open hole today.
**Risk** A future refactor that moves logic out of `ProbationServiceImpl` silently
removes the only check.
**Fix** Add `@PreAuthorize("isAuthenticated()")` /
`hasAnyRole('ADMIN','HR','EMPLOYEE')` to the nine methods, matching the surrounding
style.

---

#### D-9 · P2 · A terminal decision cannot be corrected — not even by an ADMIN

**Where** `WorkflowRules.java:16`, `V1:93` trigger

**Evidence** ADMIN re-decide after `CONFIRMED` → **409**; raw `UPDATE` →
`Finalized probation assessments are immutable`. All three decisions
(`CONFIRMED`/`EXTENDED`/`NOT_CONFIRMED`) are final and there is **no** ADMIN→HR
send-back, so a wrong decision requires disabling the trigger.
**Expected** Immutability of the *record* is required; but there should be a sanctioned
correction path (a superseding assessment) rather than none.
**Fix** Allow a new cycle with `previousAssessmentId` pointing at the finalized one for
`CONFIRMED`/`NOT_CONFIRMED` too (today only `EXTENDED` can be followed up —
`ProbationServiceImpl.java:71`), or add an ADMIN "request correction" transition that
creates a linked assessment.

---

#### D-10 · P2 · `V2` existed on disk but had never been applied to the live database

**Where** `probation-service/src/main/resources/db/migration/V2__protect_final_rating_evidence.sql`

**Evidence** Before restart: `flyway_schema_history` contained **only** version 1;
triggers `probation_final_immutable` + `probation_history_append_only` present,
`probation_final_ratings_immutable` **absent**. After restart:
```
1 probation assessments            success=true
2 protect final rating evidence    success=true
triggers: probation_final_immutable, probation_final_ratings_immutable, probation_history_append_only
```
**Impact** Between the first boot and my restart, ratings (`score`, `comments`) of a
**finalized** assessment were still mutable at the SQL level — the `V2` control was
declared but not enforced.
**Note** This is a deploy-obedience issue, not a code defect: Flyway did the right thing
the moment the service was allowed to run `V2`.
**Fix** Treat "migrations pending" as a startup gate in the runbook (§`docs/HRMS_DATABASE_SETUP.md`);
never consider a service "up" until `flyway_schema_history` matches the migration folder.

---

#### D-11 · P2 · Hard-coded fallback JWT secret (project-wide)

**Where** `probation-service/src/main/resources/application.properties:11`
```properties
app.jwt.secret=${JWT_SECRET:hrms-learning-demo-secret-key-change-me-in-production-1234567890}
```
**Risk** If `JWT_SECRET` is unset, the signing key is in the repository; anyone can mint
an `ADMIN` token and the whole three-role model collapses.
**Note** Pre-existing pattern shared with `auth-service`/`employee-service` — the same
string, so the services interoperate. Fix as one project-wide change, not just here.
**Fix** Fail fast: remove the default so startup aborts without `JWT_SECRET`.

---

#### D-12 · P3 · `reassign` writes a no-op audit transition

**Where** `ProbationServiceImpl.java:188` — `audit(a, previous, "ASSIGNMENT_ARCHIVED", …)`
records `newStatus = current status`, producing a row whose previous and new status are
identical (e.g. `MANAGER_EVALUATION_IN_PROGRESS → MANAGER_EVALUATION_IN_PROGRESS`).
**Impact** Cosmetic; the evidence snapshot is still preserved correctly and `REASSIGNED`
follows immediately.
**Fix** Use a dedicated `previous_status = NULL` or an explicit `ARCHIVED` marker.

---

#### D-13 · P3 · `.anyRequest().denyAll()` also blocks `/error` and actuator

**Where** `SecurityConfig.java:19`
**Impact** Errors raised *before* the controller (filter/dispatch level) cannot render
the project's `{timestamp,status,error,message}` shape; there is also no health endpoint
on `:8086`. Reproduced indirectly: the stale-auth-service 500 above arrived in a
different body shape.
**Fix** `.requestMatchers("/error").permitAll()` and add
`spring-boot-starter-actuator` with `/actuator/health` open to the gateway only.

---

#### D-14 · P3 · Concept drift: Jackson 3 here, Jackson 2 everywhere else

**Where** `pom.xml` (`spring-boot-starter-webmvc`), `tools.jackson.databind.ObjectMapper`
in `SecurityConfig`/`ProbationServiceImpl`.
**Impact** Works (verified — audit snapshots were written), but the module cannot share
Jackson-2 helpers/serializers with the rest of the repo.
**Fix** None required; document the difference so nobody debugs a phantom classpath bug.

---

#### D-15 · P3 · `/manager/assignments` returns `200 []` for a non-manager

**Where** `ProbationController.java:29` → `ProbationServiceImpl.java:100-103`
**Impact** An EMPLOYEE who manages nobody gets `200` with an empty page rather than
`403`. Harmless (nothing leaks) but inconsistent with every other role gate.
**Fix** `if (!user.isOffice()) requireManagerExists()` — i.e. 403 when
`capabilities.hasAssignments` is false, or leave as-is and document.

---

## 3. Workflow and API verification

### 3.1 Endpoint authorization matrix (as **executed**)

| Endpoint | ADMIN | HR | EMPLOYEE (subject) | EMPLOYEE (assigned manager) | EMPLOYEE (unrelated) | Anonymous / bad JWT |
|---|---|---|---|---|---|---|
| `POST /assessments` | 403 | **201** | 403 | 403 | 403 | 401 |
| `PUT /assessments/{id}` | 403 | 200 (DRAFT) / 409 (final) | — | — | — | 401 |
| `GET /assessments/{id}` | 200 detail | 200 detail | 200 outcome | 200 detail (403 while DRAFT) | **403** | 401 |
| `GET /assessments` | 200 | 200 | 200 own only | 200 own only | 200 own only | 401 |
| `GET /manager/assignments` | 200 (own) | 200 (own) | 200 empty | **200 assigned** | 200 empty | 401 |
| `GET /me` | 403 (no employeeId) | 403 | **200** | 200 | 200 | 401 |
| `GET /employees/{id}/history` | 200 | 200 | 200 own | 200 own | **403** | 401 |
| `GET /statistics` | 200 | 200 | **403** | 403 | **403** | 401 |
| `GET /employees`, `/reviewers` | 200 | 200 | 403 | 403 | **403** | 401 |
| `PUT /evaluation`, `POST /submit-evaluation` | 403 | 403 | 403 | **200** | 403 | 401 |
| `POST /send-for-evaluation` | 403 | **200** | 403 | 403 | 403 | 401 |
| `POST /return-to-manager` | 403 | **200** | 403 | 403 | 403 | 401 |
| `POST /forward-for-approval` | 403 | **200** | 403 | **403** | 403 | 401 |
| `POST /decision` | **200** | **403** | 403 | 403 | 403 | 401 |
| `POST /reassign` | 200 | 200 | 403 | 403 | **403** | 401 |
| `GET /criteria`, `/capabilities` | 200 | 200 | 200 | 200 | 200 | 401 |

> `401` for "no token" **and** "garbage token" is correct: authentication failed.
> `403` is used for "authenticated but not permitted" everywhere I probed. `409` for
> state/version/overlap conflicts. `400` for validation. `404` for unknown ids. `503`
> only when a dependency is unreachable.

### 3.2 Negative / attack-style tests (executed, all as expected)

| # | Attempt | Result | Correct? |
|---|---|---|---|
| 1 | EMPLOYEE creates an assessment | 403 | ✅ |
| 2 | ADMIN creates an assessment | 403 | ⚠️ per D-4 |
| 3 | EMPLOYEE reads another employee's assessment | 403 | ✅ |
| 4 | EMPLOYEE reads another employee's history | 403 | ✅ |
| 5 | EMPLOYEE filters `?employeeId=<other>` | 403 | ✅ |
| 6 | EMPLOYEE reads another employee's `/me` data | 200 but scoped to own row | ✅ |
| 7 | EMPLOYEE lists org employees / reviewers / statistics | 403 / 403 / 403 | ✅ |
| 8 | EMPLOYEE submits an evaluation | 403 | ✅ |
| 9 | HR submits an evaluation | 403 | ✅ |
| 10 | HR forwards / returns / sends | 200 / 200 / 200 | ✅ intended |
| 11 | HR decides | 403 | ✅ |
| 12 | Manager forwards | 403 | ✅ |
| 13 | Manager acts after reassignment | 403 (`reassignmentArchives…` test) | ✅ |
| 14 | No token | 401 | ✅ |
| 15 | Garbage/tampered token | 401 (signature + claim validation) | ✅ |
| 16 | Token without `userId` | 401 (`missingBadAndIdentitylessTokens…`) | ✅ |
| 17 | Stale `version` | 409 | ✅ |
| 18 | Two concurrent decisions | exactly one 200 + one 409 | ✅ (test) |
| 19 | Two concurrent overlapping creates | 201 + 409 | ✅ (test) |
| 20 | Wrong-state transition (send twice, forward early) | 409 | ✅ |
| 21 | Overlapping duplicate cycle | 409 | ✅ |
| 22 | Duplicate follow-up for the same extension | 409 | ✅ |
| 23 | Unknown employee / unknown assessment | 404 | ✅ |
| 24 | `reviewDueDate` outside the period | 400 | ✅ |
| 25 | `EXTENDED` without a revised end date | 400 | ✅ |
| 26 | `revisedEndDate` on a `CONFIRMED` decision | 400 | ✅ |
| 27 | Manager assigned to themselves | 400 | ✅ |
| 28 | Raw SQL `UPDATE` on a finalized row | DB exception | ✅ |
| 29 | Raw SQL `DELETE` on audit history | DB exception | ✅ |
| 30 | `size=101`, `status=INVALID` | 400 | ✅ (test) |

**No authentication bypass, privilege escalation, or IDOR was found.** That is a real
result, not a courtesy: probes 1–17 were run against a live JWT-signed stack.

### 3.3 Verified audit trail (assessment 3, produced by the probes)

```
CREATED                  | -                                -> DRAFT
SENT_FOR_EVALUATION      | DRAFT                            -> PENDING_MANAGER_EVALUATION
EVALUATION_SAVED         | PENDING_MANAGER_EVALUATION       -> MANAGER_EVALUATION_IN_PROGRESS
EVALUATION_SUBMITTED     | MANAGER_EVALUATION_IN_PROGRESS   -> PENDING_HR_REVIEW
RETURNED_TO_MANAGER      | PENDING_HR_REVIEW                -> RETURNED_TO_MANAGER
EVALUATION_SAVED         | RETURNED_TO_MANAGER              -> MANAGER_EVALUATION_IN_PROGRESS
EVALUATION_SUBMITTED     | MANAGER_EVALUATION_IN_PROGRESS   -> PENDING_HR_REVIEW
FORWARDED_FOR_APPROVAL   | PENDING_HR_REVIEW                -> PENDING_ADMIN_APPROVAL
DECISION_PUBLISHED       | PENDING_ADMIN_APPROVAL           -> EXTENDED
```

---

## 4. Frontend findings

**Verdict: FAIL — not implemented.**

| Check | Result |
|---|---|
| Probation route in `App.jsx` | ❌ absent |
| Nav entry in `config/navigation.js` | ❌ absent (ADMIN/HR/EMPLOYEE) |
| `config/access.js` case for `probation` | ❌ absent |
| `api/probationApi.js` | ❌ absent |
| `hooks/useProbation*.js` | ❌ absent |
| HR intake page | ❌ absent |
| Manager evaluation form (8 criteria, 1–5 + comments) | ❌ absent |
| HR review queue (return / forward) | ❌ absent |
| ADMIN approval queue (confirm / extend / not-confirm) | ❌ absent |
| Employee "My Probation" view | ❌ absent |
| Loading / error / empty states | n/a — no components |
| Design-system consistency | n/a |
| Responsive / accessibility | n/a |
| Unauthorized actions blocked server-side | ✅ (backend verified independently of the UI) |

`npm run build` passes (exit 0) — the *existing* app is healthy; it simply has no
probation surface. Because nothing calls `/api/probation/**`, no UI/API contract
mismatch can exist yet; the contracts in §3.1 are ready to be built against.

---

## 5. Executed test results

```
auth-service
  ProbationReviewerSecurityTest ...... 1/1 pass
  ProbationReviewerServiceTest ....... 2/2 pass
  → Tests run: 3, Failures: 0, Errors: 0        BUILD SUCCESS   (exit 0)

probation-service  (run A — full)
  FeignTokenRelayTest ................ 1/1 pass
  WorkflowRulesTest .................. 6/6 pass
  ProbationIntegrationTest ........... 8/11 pass  ← 3 FAILURES
  → Tests run: 18, Failures: 3, Errors: 0       BUILD FAILURE   (exit 1)

probation-service  (isolated method)
  ProbationIntegrationTest#queuesStatisticsAndPaginationAreAuthorizedAndScoped  1/1 pass

probation-service  (run B — full, identical command)
  → Tests run: 18, Failures: 0, Errors: 0       BUILD SUCCESS   (exit 0)

hrms-frontend
  npm run build  → ✓ 2002 modules transformed, built in 7.33s
```

**How to read this.** I am not reporting "18/18 pass" as the state of the suite. The
suite produced **two different verdicts for the same input** (see **D-3**). The
*backend* behaviours the tests assert were independently confirmed by my live probes, so
the failures are attributed to test isolation, not to production code. **No frontend
tests exist** because there is no frontend (D-1).

**Test coverage gaps worth closing** (after D-3):
- publication timing (employee must not see a DRAFT) — would have caught **D-6**;
- ADMIN authoring permission — would have surfaced **D-4** as a decision;
- downstream 500 vs 503 mapping — would have caught **D-5**;
- a migration-version assertion in CI — would have caught **D-10**.

---

## 6. Prioritized defects and suggested fixes

> **No P0 defect was found.** No authentication bypass, no cross-employee data access,
> no path to mutate a salary/final decision, and no way for a client to drive a status
> field directly. That is the headline.

| ID | Sev | Defect | File (line) | Minimal fix |
|---|---|---|---|---|
| D-1 | **P1** | Frontend layer entirely absent | `hrms-frontend/` (n/a) | Build 4 pages + routes + API client + hook; reuse design system |
| D-2 | **P1** | Running stack lacked the route/endpoints → 404/500/503 | gateway `:57-60`, auth `SecurityConfig` | Add to start order; map `NoResourceFoundException` → 404 |
| D-3 | **P1** | Test suite non-deterministic (15/18 then 18/18) | `ProbationIntegrationTest.java` | `@Transactional` or truncate; drop wall-clock ids; Testcontainers |
| D-4 | P2 | ADMIN cannot author (403) | `ProbationController.java:20,22,48,52,54` | `hasAnyRole('HR','ADMIN')` or document the exception |
| D-5 | P2 | All Feign failures → 503 | `GlobalExceptionHandler.java:31` | Map 403→403, 500→502; 503 only for availability |
| D-6 | P2 | Employee sees unpublished/DRAFT cycles | `AssessmentMapper.java:17-22` | Filter to `publishedAt != null` for employee views |
| D-7 | P2 | `GET /assessments/{id}` returns `Object`, two shapes | `ProbationController.java:24` | Envelope union or split the endpoint |
| D-8 | P2 | 9 endpoints lack `@PreAuthorize` | `ProbationController.java:24,25,29,34,37,42,43,50,51` | Add explicit role annotations (two-lock convention) |
| D-9 | P2 | No correction path for terminal decisions | `WorkflowRules.java:16`, `V1:93` | Allow a superseding linked cycle; or an ADMIN correction transition |
| D-10 | P2 | `V2` unapplied in the live DB | `V2__….sql` | Gate "service up" on Flyway history matching disk |
| D-11 | P2 | Hard-coded JWT secret fallback | `application.properties:11` | Remove the default; fail fast (project-wide) |
| D-12 | P3 | No-op `ASSIGNMENT_ARCHIVED` audit row | `ProbationServiceImpl.java:188` | Use a distinct marker |
| D-13 | P3 | `denyAll()` blocks `/error`, no actuator | `SecurityConfig.java:19` | Permit `/error`; add health endpoint |
| D-14 | P3 | Jackson 3 vs Jackson 2 drift | `pom.xml`, `tools.jackson…` | Document (no change needed) |
| D-15 | P3 | `/manager/assignments` returns `[]` for non-managers | `ProbationServiceImpl.java:100-103` | 403 when there are no assignments |

**Verified defects:** D-1 … D-12 (all reproduced against source or the running system).
**Potential risks, not reproduced:** none of the P0 class.
**Untested assumptions:** D-9's business intent (the brief never states whether a
terminal decision must be correctable); D-15's intended contract; D-14's long-term
maintenance cost.

### 6.1 Minimal patch order (if you only fix three things)

1. **D-1** — without it the module has no users.
2. **D-3** — without it you have no trustworthy signal about the other 14.
3. **D-2 + D-10** — add `probation-service` to the start order and assert Flyway
   history on boot, so "it works" is reproducible on a fresh machine.

---

## 7. Side effects of this audit (disclosure)

The audit required live execution, so the local `HRMS` database now contains the probe
data I created. **I did not reset, drop or edit any pre-existing data.**

| Object | Rows created by the audit |
|---|---|
| `probation_schema.probation_assessments` | `id=1` (employee 1, manager user 8, `CONFIRMED`), `id=3` (employee 2, `EXTENDED`, `revisedEndDate 2027-01-01`), `id=4` (employee 2, `DRAFT`, follow-up of 3) |
| `probation_schema.probation_assessment_ratings` | 8 per assessment (created automatically) |
| `probation_schema.probation_assessment_history` | 7 for #1, 9 for #3, 1 for #4 |
| `probation_schema` itself, plus `V1`/`V2` | created by Flyway on first boot |

**These rows cannot be deleted with ordinary SQL** — `id=1` and `id=3` are finalized, and
`protect_final_assessment()` raises `Finalized probation assessments are immutable`;
deleting their history raises `Probation history is append-only`. That is the control
working as designed. To remove the probe data you must deliberately override it:

```sql
BEGIN;
ALTER TABLE probation_schema.probation_assessment_history DISABLE TRIGGER probation_history_append_only;
ALTER TABLE probation_schema.probation_assessments        DISABLE TRIGGER probation_final_immutable;
ALTER TABLE probation_schema.probation_assessment_ratings DISABLE TRIGGER probation_final_ratings_immutable;
DELETE FROM probation_schema.probation_assessment_history WHERE assessment_id IN (1,3,4);
DELETE FROM probation_schema.probation_assessment_ratings WHERE assessment_id IN (1,3,4);
DELETE FROM probation_schema.probation_assessments        WHERE id IN (1,3,4);
ALTER TABLE probation_schema.probation_assessment_history ENABLE TRIGGER probation_history_append_only;
ALTER TABLE probation_schema.probation_assessments        ENABLE TRIGGER probation_final_immutable;
ALTER TABLE probation_schema.probation_assessment_ratings ENABLE TRIGGER probation_final_ratings_immutable;
COMMIT;
```

Processes restarted during the audit: `auth-service` (`:8085`), `api-gateway` (`:8080`),
`probation-service` (`:8086`). All three are currently running with the current source.
No service was stopped permanently; nothing was committed, pushed or deployed.

---

## 8. Final assessment

| Layer | Verdict | Rationale |
|---|---|---|
| `probation-service` authorization | **PASS** | 30 negative probes, zero bypass; ownership resolved from the JWT only |
| Workflow & state machine | **PASS** | Full lifecycle incl. return, reassign, extension, follow-up, all verified live |
| Database integrity | **PASS** | Overlap, status/decision consistency, append-only and finality all enforced in SQL |
| Error/status contract | **PASS WITH ISSUES** | D-5, D-7 |
| `auth-service` reviewer directory | **PASS** | 403 for EMPLOYEE verified by test; minimal DTO (no email/roles/hash) |
| Gateway / deployment | **PASS WITH ISSUES** | D-2, D-10 |
| Test suite | **FAIL** | Non-deterministic (D-3) |
| **Frontend** | **FAIL** | Entirely absent (D-1) |

**Overall: FAIL — the module is not complete.**

The backend is the strongest part of this implementation and I found no security
vulnerability in it: assignment-based manager authorization, JWT-derived identity,
finalized-record immutability and the audit trail all hold up under direct attack,
including raw SQL. The FAIL is driven by two absent/misconfigured things rather than by
weak code:

1. there is **no user interface at all** for any of the four actors (D-1), so the
   workflow cannot be performed by a real user; and
2. the test suite **reports a different result on identical runs** (D-3), so no green
   build can be trusted.

Fix D-1, D-2, D-3 and D-10, and this becomes a **PASS WITH ISSUES** with only
maintainability items (D-4 … D-15) outstanding.
