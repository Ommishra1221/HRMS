# Attendance Service

> Last reviewed: written from current source code
> Source of truth: `attendance-service/src/main/java/com/example/microservices/attendance/**`
> Service: attendance-service · Port: 8083 · Database: HRMS / attendance_schema

## 1. What is this service?
Records **daily attendance**: one row per employee per day with a status
(PRESENT / WFH / LEAVE / HALF_DAY / ABSENT) and optional check-in/check-out times.

## 2. Why does it exist?
Attendance is company-recorded operational data with its own cadence (daily) and its
own rules (one record per day, checkout validation). Mixing it into employee or leave
data would couple unrelated lifecycles.

## 3. What does this service own?
- **Database:** `attendance_schema` — only the `attendance` table.
- **Entities:** `Attendance`.
- **Business responsibility:** record attendance, list per role, validate checkout.
- **What it does NOT own:** employees (Feign lookup), leaves, payslips, users.
  **No self-service writes exist** — employees never record their own attendance here
  (deliberately not invented).

## 4. Port and configuration
```properties
spring.application.name=attendance-service
server.port=8083
spring.jpa.properties.hibernate.default_schema=attendance_schema
app.jwt.secret=…
eureka.client.service-url.defaultZone=http://localhost:8761/eureka
```
Gateway route: `Path=/api/attendance/** → lb://attendance-service, StripPrefix=1`.
Feign used for employee lookups (same as leave-service).

## 5. Folder structure
Identical skeleton to leave-service, including `client/EmployeeClient.java`
(same interface shape) and the `security/` trio (JwtUtil, JwtAuthenticationFilter,
CurrentUser, FeignTokenRelay).

## 6. Database
```
attendance_schema.attendance
┌─────────────────┬──────────────┬───────────────────────────────┐
│ column          │ type         │ notes                         │
├─────────────────┼──────────────┼───────────────────────────────┤
│ id              │ BIGSERIAL PK │                               │
│ employee_id     │ BIGINT       │ NOT NULL, no FK (Feign-valid.)│
│ attendance_date │ DATE         │ NOT NULL                      │
│ status          │ VARCHAR      │ PRESENT/WFH/LEAVE/HALF_DAY/   │
│                 │              │ ABSENT                        │
│ check_in        │ TIME         │ nullable                      │
│ check_out       │ TIME         │ nullable                      │
└─────────────────┴──────────────┴───────────────────────────────┘
```
Uniqueness of (employee_id, attendance_date) is enforced **in the service** (see §10),
not by a DB constraint.

## 7. Entity — `Attendance`

| Field | WHAT | WHY | WHO SETS IT | WHO MAY CHANGE IT |
|---|---|---|---|---|
| `id` | PK | reference | DB | nobody |
| `employeeId` | whose record | scoping + composition | ADMIN only (body) | ADMIN only |
| `attendanceDate` | the day | daily cadence | ADMIN only | ADMIN only |
| `status` | attendance category | reporting | ADMIN only | ADMIN only |
| `checkIn` | arrival time | hours worked | ADMIN (required when PRESENT) | ADMIN (checkout PATCH only touches checkOut) |
| `checkOut` | departure time | hours worked | ADMIN via `PATCH /{id}/checkout` | ADMIN |

## 8. DTOs
- **`AttendanceRequest`** (in): `employeeId`, `attendanceDate`, `status` (validated),
  `checkIn`, `checkOut`.
- **`AttendanceResponse`** (out): all fields + composed `employee` object.
- The checkout endpoint takes a tiny `Map<String, LocalTime>` body
  (`{"checkOut":"18:30:00"}`) — a partial-update shape instead of resending the whole
  record.

## 9. Repository
```java
List<Attendance> findByEmployeeIdOrderByAttendanceDateDesc(Long employeeId);
Optional<Attendance> findByEmployeeIdAndAttendanceDate(Long employeeId, LocalDate attendanceDate);
```
Two derived queries: a **scoped, newest-first list** (the ownership query — its
argument comes from the JWT for employee callers) and the **duplicate check**
(one record per employee per day). No `@Query` needed — the method names are the SQL.

## 10. Service layer — `AttendanceServiceImpl`

```
POST /attendance  (ADMIN only)
   ├─ fetchEmployeeOrThrow(employeeId)          ← Feign (404 / 503)
   ├─ findByEmployeeIdAndAttendanceDate present? → 409  (one record per day)
   ├─ status PRESENT && checkIn == null?        → 400
   └─ save → 201

GET /attendance            → EMPLOYEE? findByEmployeeIdOrderByAttendanceDateDesc(JWT id) : findAll()
GET /attendance?employeeId=X → EMPLOYEE? X is OVERWRITTEN with the JWT id (query can't widen the view)
GET /attendance/{id}       → 404 → EMPLOYEE && row.employeeId != JWT id → 403 → 200

PATCH /attendance/{id}/checkout  (ADMIN only)
   ├─ 404; checkOut == null → 400
   ├─ checkOut before checkIn → 400
   └─ save → 200

PUT /attendance/{id}       (ADMIN only) — duplicate rule re-checked for NEW values
DELETE /attendance/{id}    (ADMIN only) → 204
```

Business rules in plain language:
1. **One record per employee per day** — a second row for the same date → 409.
2. **PRESENT needs a check-in** — 400 otherwise.
3. **Checkout cannot be before check-in** — 400.
4. **Attendance is company-recorded** — every write is ADMIN-only; HR and EMPLOYEE
   are read-only (employee reads are scoped to their own rows).

## 11. Controller — `AttendanceController`

| METHOD PATH | PURPOSE | SUCCESS | FAILURE | AUTHORIZATION |
|---|---|---|---|---|
| `POST /attendance` | record a day | 201 | 400 / 404 / 409 / 503 | ADMIN |
| `GET /attendance` (+`?employeeId=`) | list (role-scoped) | 200 | 404 via Feign path | ADMIN, HR, EMPLOYEE-own |
| `GET /attendance/{id}` | read one | 200 | 403 / 404 | ADMIN, HR, EMPLOYEE-own |
| `PUT /attendance/{id}` | full update | 200 | 400 / 404 / 409 | ADMIN |
| `PATCH /attendance/{id}/checkout` | set checkout | 200 | 400 / 404 | ADMIN |
| `DELETE /attendance/{id}` | remove | 204 | 404 | ADMIN |

## 12. Exception handling
`AttendanceNotFoundException` → 404 · `ForbiddenOperationException` → 403 ·
`EmployeeServiceException` → 400/409 (its `HttpStatus` field decides) ·
`FeignException` → 503 · `AccessDeniedException` → 403 · validation → 400 · 500.

## 13. Service-to-service communication
Same pattern as leave-service: `EmployeeClient` (Feign) → Eureka → employee-service,
with `FeignTokenRelay` attaching the caller's JWT. Used on create/update validation
and on **every row** of list responses (composition), so a down employee-service
degrades lists to 503 rather than returning rows without names.

## 14. Full request lifecycle
- **CREATE:** `POST /api/attendance` → ADMIN → duplicate/day check → 201.
- **READ:** `GET /api/attendance` — employee receives only their own rows (query
  param forced); ADMIN/HR see everything.
- **UPDATE:** `PATCH /api/attendance/7/checkout` with `{"checkOut":"18:30"}` — ADMIN
  only, validated against checkIn → 200.
- **DELETE:** `DELETE /api/attendance/7` — ADMIN only → 204.

## 15. Frontend connection
```
AttendanceList.jsx → useAttendance() → attendanceApi.getAttendance() → GET /api/attendance
AttendanceFormPage → attendanceApi.createAttendance()   (ADMIN route only)
AttendanceDetail   → getAttendanceRecord(id) / markCheckOut(id, "HH:mm") / deleteAttendance(id)
```
All write buttons (Mark attendance, Edit, Delete, **Check out**) render only when
`isAdmin` — matching the backend's ADMIN-only gates. EMPLOYEE nav labels this module
"My Attendance" and shows view-only rows.

## 16. Security / role rules
ADMIN: full management. HR: read-only. EMPLOYEE: own rows read-only (query/filter
forced to JWT identity). No self-service write exists — by design.

## 17. Beginner mistakes
- Adding a "mark my attendance" employee endpoint — the backend deliberately has none.
- Forgetting that `?employeeId=` is overridden for employees (expecting it to widen).
- Recording two rows for the same employee/day and being surprised by the 409.
- Time maths with strings instead of `LocalTime` (`checkOut.isBefore(checkIn)`).
- Expecting the DB to block duplicates — the service does (no unique index today).

## 18. Interview questions
- **Why is checkout a PATCH?** It's a partial, rule-checked state change — the same pattern as payroll's mark-paid; PUT would imply resending the whole record.
- **How is one-record-per-day enforced?** In `AttendanceServiceImpl` via `findByEmployeeIdAndAttendanceDate` before save → 409; (a DB unique constraint would be a good hardening step — future improvement).
- **How do you prevent an employee querying someone else's attendance?** Their filter is force-overwritten with the JWT's employeeId; per-row reads compare row vs claim → 403.
- **What happens when employee-service is down?** Feign throws; the handler answers 503 — reads that need composition fail loudly rather than silently omitting names.

## 19. Quick revision
1. Port 8083, `attendance_schema`, `attendance` table.
2. Statuses: PRESENT / WFH / LEAVE / HALF_DAY / ABSENT.
3. One record per employee per day → 409 in the service.
4. PRESENT without checkIn → 400; checkout < checkIn → 400.
5. All writes ADMIN-only; checkout is `PATCH /{id}/checkout`.
6. Employee reads scoped by forcing `employeeId` to the JWT claim.
7. Feign + token relay for every composed response.
8. 404 via `AttendanceNotFoundException`; 403 ownership; 503 on Feign failure.

## 20. One-minute explanation
"Attendance-service records one row per employee per day on 8083. All writes are
ADMIN-only — attendance is company-recorded, employees only ever read their own rows,
with any employeeId query parameter force-overwritten by the JWT claim. The interesting
rules live in AttendanceServiceImpl: the per-day duplicate check that answers 409, the
PRESENT-needs-checkIn rule, and checkout validation that refuses a checkout before
check-in. Employee details in responses come from employee-service over Feign with the
caller's token relayed, so a failed lookup becomes a clean 503 instead of nameless rows."
