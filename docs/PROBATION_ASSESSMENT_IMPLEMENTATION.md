# Probation Assessment Module

## Implemented workflow

HR creates and edits a draft, assigns a reporting manager, and sends the assessment for evaluation. The assigned manager saves criterion scores and written evidence, then submits the completed evaluation. HR returns it with correction remarks or forwards it with review remarks. ADMIN records `CONFIRMED`, `EXTENDED`, or `NOT_CONFIRMED`. The decision and separately approved employee comments are published atomically.

There is no score threshold that decides an employment outcome. The module never changes employee master data, payroll, account status, or employment status.

An extension records the reason, revised end date, decision actor, and timestamp. HR can create one separate follow-up cycle linked to the extended assessment. Its period starts the day after the earlier period ends and ends on the approved revised date. The earlier assessment remains finalized and unchanged.

## Architecture and source manifest

`probation-service` is a sixth business service, on port **8086**, registered with the existing Eureka server. The gateway routes `/api/probation/**` to `lb://probation-service`, stripping `/api`. The service owns only `probation_schema` inside `HRMS`.

| Location | Responsibility |
| --- | --- |
| `probation-service/pom.xml`, `mvnw`, `mvnw.cmd`, `.mvn/wrapper/` | Java 21, Boot 4.1.1, Spring Cloud 2025.1.3, Maven build |
| `probation-service/src/main/resources/application.properties` | Datasource, schema, Flyway, JWT, Eureka, bounded Feign timeouts |
| `.../probation/ProbationServiceApplication.java` | Application entry point and Feign discovery |
| `.../probation/domain/Assessment.java` | Assessment, assignment, decision, audit metadata and optimistic version |
| `.../probation/domain/AssessmentRating.java`, `AssessmentHistory.java` | Criterion snapshots and append-only audit events |
| `.../probation/domain/AssessmentStatus.java`, `Decision.java`, `Criteria.java` | State vocabulary, decisions, versioned central criteria and score calculation |
| `.../probation/dto/ProbationDtos.java` | Request allowlists, internal DTOs, summaries, employee outcome DTOs and pagination |
| `.../probation/repository/` | Assessment specifications and ordered event history |
| `.../probation/service/ProbationService.java`, `ProbationServiceImpl.java` | Transactional workflow and service-layer permissions |
| `.../probation/service/WorkflowRules.java`, `AssessmentMapper.java` | Transition/date/evidence rules and caller-specific response projection |
| `.../probation/security/`, `config/SecurityConfig.java` | JWT verification, stable user identity, role gates and token relay |
| `.../probation/client/EmployeeClient.java`, `ReviewerClient.java`, `ReferenceDirectory.java` | Authorized employee/reviewer validation |
| `.../probation/controller/ProbationController.java`, `exception/` | REST endpoints and standard error responses |
| `auth-service/.../ProbationReviewerController.java`, `ProbationReviewerService.java`, `ProbationReviewerResponse.java` | Minimal, read-only reviewer directory for HR/ADMIN |
| `auth-service/.../UserRepository.java`, `config/SecurityConfig.java` | Paginated eligible-reviewer query and narrowly scoped directory authorization |
| `api-gateway/src/main/resources/application.properties` | New route at index 5 |
| `hrms-frontend/src/api/probationApi.js`, `hooks/useProbation.js` | Existing Axios client, cancelable queries, workflow mutations and search |
| `hrms-frontend/src/pages/Probation*.jsx` | Dashboard, lists, preparation and assessment detail |
| `hrms-frontend/src/components/probation/` | Shared tables, accessible errors, reviewer picker, evaluation, HR review, decision and reassignment |
| `hrms-frontend/src/App.jsx`, `config/navigation.js`, `config/access.js`, `components/layout/Sidebar.jsx` | Routes and assignment-aware navigation |
| `hrms-frontend/src/index.css`, `components/common/Badge.jsx` | Module-scoped token styles and readable status names |
| `probation-service/src/test/`, `auth-service/src/test/` | Workflow, database, concurrency, reference-directory and security tests |
| `hrms-frontend/tests/`, `playwright*.config.js` | Navigation tests, browser UI tests, responsive screenshots and live integration test |
| `scripts/Test-Probation.ps1` | Repeatable isolated backend/build/browser verification with cleanup |

Java paths abbreviated with `.../probation/` are under `probation-service/src/main/java/com/example/microservices/probation/`. Auth paths use its equivalent existing package.

One existing compilation defect was corrected: `employee-service` contained two identical `handleAccessDenied` methods. The duplicate was removed, retaining the existing 403 behavior. No original module authorization rules were expanded.

## Database tables and migrations

Flyway runs only against `probation_schema`. Hibernate uses **validate**, never create/drop/update for this service. Flyway clean is disabled. No existing schemas are migrated or reset.

1. `V1__probation_assessments.sql`: assessments, ratings, history, indexes, constraints, append-only audit trigger and final-assessment immutability trigger.
2. `V2__protect_final_rating_evidence.sql`: prevents mutation of finalized assessment ratings.
3. `V3__require_complete_final_metadata.sql`: explicitly rejects incomplete final metadata under PostgreSQL's NULL-aware CHECK semantics.

| Table | Important details |
| --- | --- |
| `probation_assessments` | Plain external employee/user IDs; employee/manager display snapshots; period/due dates; states; score/feedback; internal and published remarks; decision actor/time; revised end date; unique internal previous-cycle FK; creation/update actors/times; `version` |
| `probation_assessment_ratings` | Internal assessment FK; unique assessment/criterion code; criterion-name and weight snapshots; nullable draft score constrained to 1–5; bounded comments; timestamps |
| `probation_assessment_history` | Internal assessment FK; action; old/new status; actor/time; remarks; complete assessment/evaluation evidence snapshot |

A PostgreSQL GiST exclusion constraint prevents overlapping inclusive date periods for the same employee **while both assessments are active**. Built-in `int8range` and `daterange` operators avoid installing an extension. Unlike a check-before-insert query, the constraint also protects concurrent creates and period updates.

Date constraints require a valid start/end period and a review due date within that period. A manager cannot be the assessed employee. Extension/non-confirmation requires decision remarks; an extension requires a later revised end date. A final state must have its matching decision, actor, decision timestamp, and publication timestamp.

Audit events are inserted in the same transaction as their workflow mutation. Snapshots retain prior drafts, submitted evidence, dates, assignment and decision context. There is no history update/delete operation. Finalized assessments and their ratings are immutable. The API offers no hard-delete endpoint.

Every mutation requires the current `version` returned by the API. A stale version or a conflicting concurrent write returns **409**. Failed mutations and failed reference validation roll back their history and data changes together.

## Roles, ownership and confidentiality

| Caller | Access |
| --- | --- |
| HR | Create/edit drafts; assign/reassign eligible managers; send evaluations; view all evidence/history; return submitted evaluations; forward to ADMIN; view queues/reports |
| ADMIN | View all evidence/history/reports; reassign managers before HR review; record final decisions after HR forwarding |
| Assigned reporting manager | View sent assessments assigned to their verified account; save/submit evaluations in permitted states; see their own evaluation events and relevant assignment/correction events |
| EMPLOYEE as assessment subject | View only their own periods, workflow status and published outcome/comments; no ratings, drafts, initial remarks, HR deliberations, internal decision reasons or audit history |

The manager is an **explicit assignment**, not a global role. Eligible reviewers are enabled, employee-linked `EMPLOYEE` accounts. Auth-service returns only `id`, `username`, `fullName`, and `employeeId` through `/auth/probation-reviewers`; the referenced employee is independently validated through employee-service. A missing employee link cannot silently create reviewer access.

The probation JWT filter requires a signed, unexpired token with one recognized role and a positive **userId**. Manager mutations compare that verified ID and employee link with the stored assignment. Browser-supplied reviewer IDs are never evidence of the caller's identity. An assigned reviewer cannot issue a final decision, including after a role change.

Reassignment is allowed only before HR review, requires a reason, archives the former manager's evidence, clears the current evaluation draft, and removes the former manager's access. A new reviewer cannot edit the archived evaluation. HR must return a submitted evaluation before reassigning it; there is no evaluation-bypass exception.

Employee and reviewer responses are separate contracts. Employee list/detail/history responses are projected directly into `EmployeeOutcome`, rather than sending a full object and hiding it in React. A manager gets no HR-forwarding deliberations or archived evidence from another reviewer. HR/ADMIN see complete history.

Feign relays the verified caller's original token. Existing HR/ADMIN employee directory endpoints already support validation; **no employee security widening was needed**. Managers read the authorized employee summary snapshot held by probation-service, rather than obtaining permission to browse other employees through employee-service.

The original Employee, Leave, Attendance, Payroll and user-management permissions remain unchanged. HR's new writes are limited to probation workflow endpoints.

## API contract

All paths below are relative to `/api/probation`. Internal service paths omit `/api`.

| Method | Path | Authorization / purpose |
| --- | --- | --- |
| POST | `/assessments` | HR creates a draft; 201 |
| GET | `/assessments` | HR/ADMIN summaries; employee gets own redacted cycles |
| GET | `/assessments/{id}` | Office/assigned-manager internal DTO or subject's redacted outcome; unauthorized callers get 403 |
| PUT | `/assessments/{id}` | HR edits draft dates/initial remarks; version required |
| GET | `/employees/{employeeId}/history` | Office cycle history or the employee's own redacted cycles |
| GET | `/manager/assignments` | Sent assignments scoped to verified caller userId |
| PUT | `/assessments/{id}/evaluation` | Assigned manager replaces their current evaluation draft |
| POST | `/assessments/{id}/submit-evaluation` | Assigned manager submits complete evidence |
| POST | `/assessments/{id}/send-for-evaluation` | HR sends draft to assigned manager |
| POST | `/assessments/{id}/return-to-manager` | HR returns submitted evaluation with required remarks |
| POST | `/assessments/{id}/forward-for-approval` | HR forwards complete evidence with review remarks |
| POST | `/assessments/{id}/decision` | ADMIN records and publishes final decision |
| POST | `/assessments/{id}/reassign` | HR/ADMIN reassigns an editable cycle with reason |
| GET | `/me` | Own redacted cycles, resolved from JWT employeeId |
| GET | `/statistics` | HR/ADMIN database-backed active/queue/completion counts and five recent completions |
| GET | `/capabilities` | Whether this caller has any sent reviewer assignments |
| GET | `/criteria` | Central criterion definitions and 1–5 rating labels |
| GET | `/employees` | HR/ADMIN employee selection through authorized employee-service API |
| GET | `/reviewers` | HR/ADMIN paginated minimal reviewer selection through auth-service |

Supporting auth endpoints: `GET /api/auth/probation-reviewers` and `GET /api/auth/probation-reviewers/{id}`. Both require HR or ADMIN; `/api/auth/users/**` remains ADMIN-only.

Lists accept `page` (zero-based), `size` (1–100), and, where applicable, `search`, `status`, and `employeeId`. They return `{ content, totalElements, totalPages, page, size }`. Search/filtering never widens ownership. Individual audit events and archived evidence are included in the authorized assessment detail.

Mutation DTOs explicitly allow only their relevant fields. `status`, score averages, decision actor, ownership, timestamps and audit metadata cannot be mass-assigned. New assessments accept an optional `previousAssessmentId`. Period edits cannot change employee ownership; manager changes use the audited reassignment action.

All versioned actions accept `{ "version": 3 }` plus their action fields. Review/reassignment bodies require `remarks`. Decision bodies accept `decision`, internal `remarks`, optional `publishedComments`, and `revisedEndDate` only for `EXTENDED`.

Errors use `{ timestamp, status, error, message }`: 400 invalid input/incomplete evaluation, 401 missing/invalid identity, 403 role/ownership refusal, 404 missing resource, 409 stale version/invalid transition/overlap, 503 unavailable reference validation. Downstream response bodies and internal traces are never reflected to the client.

## Frontend pages and navigation

| Route | Screen |
| --- | --- |
| `/probation` | HR/ADMIN dashboard: active assessments, manager/HR/ADMIN queues, recent completions |
| `/probation/assessments` | Searchable, filterable, paginated assessment list and employee-cycle history filter |
| `/probation/assessments/new` | HR preparation form; optional linked extension cycle |
| `/probation/assessments/:id/edit` | HR draft editing |
| `/probation/assessments/:id` | Authorized summary/evidence/history; manager evaluation, HR review or ADMIN decision controls for the current actor/state; subject receives an outcome-only view |
| `/manager-evaluations` | Assigned reviewer's work queue |
| `/my-probation` | Employee's own cycle status and published outcomes |

The sidebar displays the reviewer queue only when `/capabilities` reports an assignment. The server still authorizes direct links independently. Existing layout, typography, CSS variables, `Button`, `Badge`, `Card`, `Field`, confirmation dialogs, toasts, loading/error/empty states and table-to-card behavior are reused. Form errors include inline associations and a keyboard-focusable linked summary. Final decisions and reassignment require confirmation.

## State-transition rules

| Current state | Action | Next state | Actor |
| --- | --- | --- | --- |
| DRAFT | Edit preparation | DRAFT | HR |
| DRAFT | Send | PENDING_MANAGER_EVALUATION | HR |
| PENDING_MANAGER_EVALUATION / MANAGER_EVALUATION_IN_PROGRESS / RETURNED_TO_MANAGER | Save draft | MANAGER_EVALUATION_IN_PROGRESS | Assigned manager |
| MANAGER_EVALUATION_IN_PROGRESS / RETURNED_TO_MANAGER | Submit complete evidence | PENDING_HR_REVIEW | Assigned manager |
| PENDING_HR_REVIEW | Return with correction reason | RETURNED_TO_MANAGER | HR |
| PENDING_HR_REVIEW | Forward reviewed evidence | PENDING_ADMIN_APPROVAL | HR |
| PENDING_ADMIN_APPROVAL | Publish authorized decision | CONFIRMED / EXTENDED / NOT_CONFIRMED | ADMIN |
| DRAFT / pending or in-progress manager evaluation / RETURNED_TO_MANAGER | Reassign with reason | DRAFT stays DRAFT; otherwise PENDING_MANAGER_EVALUATION | HR/ADMIN |
| Any final state | Ordinary mutation | Rejected, 409 | All callers |

All eight criterion scores, criterion evidence comments, strengths, improvement areas, development recommendations and a manager recommendation are required for submission. Drafts can be incomplete. Scores use the criterion weights snapshotted for that cycle; the weighted mean is computed server-side with `BigDecimal`. A draft mean is provisional and uses only scored criteria. The initial catalog uses equal weights and has no outcome threshold.

## Verification

Verification uses a dedicated PostgreSQL cluster on **127.0.0.1:55436**, database **probation_test**, separate service schemas, and randomized test identifiers. It never resets or writes the real `HRMS` database.

Completed checks:

- Probation: 6 workflow/validation unit tests, 1 token-relay test, and 11 PostgreSQL/HTTP integration/security tests; all passed, no skips.
- Reviewer directory: 2 unit tests and 1 HTTP/security integration test; all passed.
- Frontend: 2 navigation/access tests and 10 Playwright UI tests; all passed.
- Browser UI coverage includes HR creation/send, assigned-manager save/submit, correction/forwarding, ADMIN extension publication, employee redaction/foreign links, loading/error/empty states, dialog keyboard behavior, and responsive light/dark screens at 375/768/1440px. Screenshots were inspected; new UI source lint reported no failures/warnings.

All seven original services passed their Maven package lifecycle, including the existing employee/leave/attendance context tests. The isolated live Playwright workflow also passed through the real gateway, Eureka, auth-service, employee-service and probation-service, including verification that HR writes to all four original business modules still return 403. The frontend production build passed. Final probation packaging used a separate workspace output directory after Windows locked an earlier JAR backup; the resulting executable JAR was copied to its normal `target` location.

An independently created `PROBATION_ASSESSMENT_AUDIT.md` was found during development and preserved. Its observations about an absent frontend describe an intermediate tree. This guide records the completed implementation and final verification; no audit probe data or other work was removed.

The backend suite covers concurrent final decisions, concurrent overlapping creates, required extension reasons/dates, immutable final records/history, assignment changes, stale versions, incomplete evaluations, filters/pagination, JWT identity, manager/employee isolation, sanitized Feign failures, and all three final decisions.

Run the complete isolated verification on Windows with Java 21+, Node, installed Chrome, PostgreSQL tools, and Maven available:

```powershell
.\scripts\Test-Probation.ps1 -PostgresBin 'C:\Program Files\PostgreSQL\16\bin'
```

The runner creates a fresh isolated cluster, runs every service's Maven package/test lifecycle, starts test services on 18080–18086 with a separate Eureka on 18761, runs frontend unit/UI/live workflow tests, builds the frontend, then stops only processes it started. Logs remain under `.tmp/probation-run-*`; nothing is recursively deleted. The fixed test ports must be free. `-Maven` accepts an existing Maven executable; otherwise the new service's wrapper is used. `-UseExistingTestDatabase` explicitly reuses an already prepared isolated database on 55436. `-SkipBackendBuild`, `-Services`, and `-SkipUiChecks` support focused reruns.

Focused frontend commands:

```powershell
cd hrms-frontend
npm test
npm run test:e2e
npm run build
```

Focused backend tests require the isolated database described above, then `probation-service\mvnw.cmd -f probation-service\pom.xml test` from the repository root. Maven's `package` phase already runs tests; do not pass both `test` and `package` unnecessarily.

## Startup in the existing HRMS

1. Keep PostgreSQL `HRMS`, Eureka, employee-service and auth-service running in their normal configuration.
2. Set `DB_PASSWORD` for probation-service; `DB_USERNAME` defaults to `postgres`. `PROBATION_DB_URL` defaults to `jdbc:postgresql://localhost:5432/HRMS`.
3. Ensure the new service verifies the same signing secret as auth-service. Its learning default matches the existing source. For an external secret, configure `app.jwt.secret` consistently across all services (for example Spring's `APP_JWT_SECRET`); probation also accepts `JWT_SECRET` as its fallback override.
4. Build/run probation-service:

   ```powershell
   cd probation-service
   .\mvnw.cmd -DskipTests package
   java -jar target/probation-service-0.0.1-SNAPSHOT.jar
   ```

5. The database user needs schema/table/index/function/trigger creation rights for the first Flyway migration. The database itself must already exist. No extension installation or existing-schema reset is required.
6. Rebuild/restart auth-service for the reviewer directory, and the gateway for its new route. Rebuild employee-service with the duplicate-handler compilation fix if rebuilding the full stack.
7. Start the existing frontend with `npm run dev`; keep its gateway base URL at the normal 8080 address. Sign in as HR to create the first cycle. A manager must have an enabled EMPLOYEE account linked to a real, different employee record.

Service overrides: `PROBATION_PORT` (8086 default), `EUREKA_URL`, `PROBATION_DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, and the signing-secret configuration above. The normal gateway CORS policy remains unchanged; the verification runner overrides it only for its isolated test frontend.

## Known limitations and deliberate boundaries

- Criteria are centrally versioned in code, with name/weight snapshots per cycle. Runtime company-policy administration and custom weighting UI are future work.
- Existing JWT behavior is retained: role/employee-link changes and account disable do not revoke already-issued tokens immediately. The module validates assignment identity on every request and validates reviewer eligibility when assigning/sending; centralized revocation is a separate platform change.
- Employee/manager display names are snapshots taken through authorized directory reads. They can differ from a subsequently renamed profile; assessment evidence remains available during a directory outage.
- No existing notification delivery infrastructure was found. In-app queues, statuses and toasts are implemented. Email, reminder scheduling and messaging integrations remain future work.
- There is no draft cancellation, review bypass, final-outcome amendment or deletion workflow. Those require an explicit business policy; normal update endpoints cannot reopen finalized records.
- No automatic follow-up creation or downstream employment/payroll/account changes occur. HR explicitly creates a linked cycle after an extension.
- Original services retain their existing `ddl-auto=update` behavior; Flyway is introduced only for the new service. The verification runner redirects those original services to isolated schemas.
- On Windows a running JAR or its `.original` can be locked. Build probation into a separate workspace directory with `-Dprobation.build.directory=...` when necessary, without stopping another running instance. The normal build directory remains `target`.
