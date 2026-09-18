# Payroll Service

> Last reviewed: written from current source code
> Source of truth: `payroll-service/src/main/java/com/example/microservices/payroll/**`
> Service: payroll-service · Port: 8084 · Database: HRMS / payroll_schema

## 1. What is this service?
Generates **monthly payslips**: basic salary, allowances, deductions, a server-computed
net salary, and a PENDING → PAID lifecycle. It handles money, so its rules are the
strictest in the project.

## 2. Why does it exist?
Money is sensitive and rule-heavy (uniqueness per month, exact arithmetic, immutable
payments). Isolating it means salary data has exactly one owner and one write surface.

## 3. What does this service own?
- **Database:** `payroll_schema` — only the `payrolls` table.
- **Entities:** `Payroll`.
- **Business responsibility:** create payslips, list/read per role, mark PAID,
  enforce immutability.
- **What it does NOT own:** employee records (Feign), leaves, attendance, users.

## 4. Port and configuration
```properties
spring.application.name=payroll-service
server.port=8084
spring.jpa.properties.hibernate.default_schema=payroll_schema
app.jwt.secret=…
eureka.client.service-url.defaultZone=http://localhost:8761/eureka
```
Gateway route: `Path=/api/payroll/** → lb://payroll-service, StripPrefix=1`.

## 5. Folder structure
Same skeleton as the other business services (config / controller / service /
repository / entity / dto / client / security / exception).

## 6. Database
```
payroll_schema.payrolls
┌───────────────┬──────────────┬──────────────────────────────────┐
│ column        │ type         │ notes                            │
├───────────────┼──────────────┼──────────────────────────────────┤
│ id            │ BIGSERIAL PK │                                  │
│ employee_id   │ BIGINT       │ NOT NULL, no FK (Feign-validated)│
│ month         │ VARCHAR(7)   │ "yyyy-MM", NOT NULL              │
│ basic_salary  │ NUMERIC(12,2)│ NOT NULL - BigDecimal            │
│ allowances    │ NUMERIC(12,2)│ NOT NULL                         │
│ deductions    │ NUMERIC(12,2)│ NOT NULL                         │
│ payment_date  │ DATE         │ stamped by markPaid              │
│ status        │ VARCHAR      │ PENDING → PAID (terminal)        │
└───────────────┴──────────────┴──────────────────────────────────┘
```

## 7. Entity — `Payroll`

| Field | WHAT | WHY | WHO SETS IT | WHO MAY CHANGE IT |
|---|---|---|---|---|
| `id` | PK | reference | DB | nobody |
| `employeeId` | whose payslip | scoping, duplicate rule | ADMIN (body) | ADMIN, until PAID |
| `month` | payroll period | one-payslip-per-month key | ADMIN (body) | ADMIN, until PAID |
| `basicSalary` | base pay | the money itself | ADMIN | ADMIN, until PAID |
| `allowances` | extras | part of net | ADMIN | ADMIN, until PAID |
| `deductions` | subtractions | part of net | ADMIN | ADMIN, until PAID |
| `status` | PENDING/PAID | payment lifecycle | service on create / markPaid | nobody once PAID (terminal) |
| `paymentDate` | when paid | audit | `markPaid` (today if body omits it) | nobody once set |

## 8. DTOs
- **`PayrollRequest`** (in): `employeeId`, `month`, `basicSalary`, `allowances`,
  `deductions`, optional `paymentDate`. **No `netSalary` field exists** — a client
  cannot influence the computed value by construction.
- **`PayrollResponse`** (out): all fields **+ computed `netSalary`** (BigDecimal)
  + composed `employee` object.

## 9. Repository
```java
List<Payroll> findByEmployeeIdOrderByMonthDesc(Long employeeId);  // ownership-scoped list
Optional<Payroll> findByEmployeeIdAndMonth(Long employeeId, String month); // duplicate rule
List<Payroll> findByStatus(String status);                        // e.g. PENDING stats
```
Derived queries again: the scoped list, the uniqueness check, and a status filter.

## 10. Service layer — `PayrollServiceImpl`

```
POST /payroll  (ADMIN only)
   ├─ fetchEmployeeOrThrow(employeeId)                 ← Feign (404 / 503)
   ├─ findByEmployeeIdAndMonth present? → 409          (one payslip per employee per month)
   ├─ new Payroll { status = "PENDING" }
   └─ save → 201

GET /payroll               → EMPLOYEE? findByEmployeeIdOrderByMonthDesc(JWT id) : findAll()
GET /payroll?employeeId=X  → EMPLOYEE? X forced to JWT id
GET /payroll/{id}          → 404 → EMPLOYEE && row.employeeId != JWT id → 403 → 200

PUT /payroll/{id}  (ADMIN only)
   ├─ 404
   ├─ status == PAID → 409   ← PAID IS IMMUTABLE (update guard)
   ├─ duplicate rule re-checked for NEW employee/month → 409
   └─ save → 200

PATCH /payroll/{id}/paid  (ADMIN only)
   ├─ 404
   ├─ status == PAID → 409  ("already paid")
   ├─ status = "PAID", paymentDate = body date or today
   └─ save → 200

DELETE /payroll/{id}  (ADMIN only)
   ├─ 404
   ├─ status == PAID → 409  ← PAID IS IMMUTABLE (delete guard)
   └─ delete → 204
```

**The money rule:** `netSalary` is computed by the server, always:

```java
private BigDecimal computeNetSalary(Payroll payroll) {
    return payroll.getBasicSalary()
            .add(payroll.getAllowances())
            .subtract(payroll.getDeductions());
}
```

`BigDecimal` + `NUMERIC(12,2)` — never `double` — because `0.1 + 0.2 != 0.3` in binary
floating point, and payslips cannot afford that.

**The PAID rules in plain language:**
1. Only ADMIN can mark PAID (HR/EMPLOYEE are stopped by the role gate at 403).
2. PAID is terminal: re-paying → 409, editing → 409, deleting → 409. A payslip is a
   record of money that actually moved; the only workflow-visible way to remove one is
   to never pay it.
3. `paymentDate` is server-stamped (today unless the ADMIN supplies one).

## 11. Controller — `PayrollController`

| METHOD PATH | PURPOSE | SUCCESS | FAILURE | AUTHORIZATION |
|---|---|---|---|---|
| `POST /payroll` | create payslip | 201 | 400 / 404 / 409 / 503 | ADMIN |
| `GET /payroll` (+`?employeeId=`) | list (role-scoped) | 200 | 404 via Feign path | ADMIN, HR, EMPLOYEE-own |
| `GET /payroll/{id}` | read payslip | 200 | 403 / 404 | ADMIN, HR, EMPLOYEE-own |
| `PUT /payroll/{id}` | update (pre-PAID) | 200 | 404 / 409 | ADMIN |
| `PATCH /payroll/{id}/paid` | terminal payment | 200 | 404 / 409 | ADMIN |
| `DELETE /payroll/{id}` | delete (pre-PAID) | 204 | 404 / 409 | ADMIN |

## 12. Exception handling
`PayrollNotFoundException` → 404 · `ForbiddenOperationException` → 403 ·
`EmployeeServiceException` → 409 (duplicates, already-paid, paid-mutation) ·
`FeignException` → 503 · `AccessDeniedException` → 403 · validation → 400 · 500.

## 13. Service-to-service communication
`EmployeeClient` (Feign) + `FeignTokenRelay`, exactly like leave/attendance:
creation validates the employee (404/503), and every composed read embeds the live
employee object. A down employee-service means payroll reads fail 503 — payroll never
caches employee names.

## 14. Full request lifecycle
- **CREATE:** `POST /api/payroll` → ADMIN → Feign check → duplicate check → PENDING →
  201 with computed `netSalary`.
- **READ:** `GET /api/payroll` — employee sees only their own payslips, newest month
  first; `GET /api/payroll/5` — 200 / 403 (not yours) / 404.
- **UPDATE:** `PATCH /api/payroll/5/paid` — ADMIN → PAID + payment date → 200. A
  second `PATCH` → 409. `PUT` on the paid row → 409. `DELETE` on it → 409.
- **DELETE:** `DELETE /api/payroll/6` (PENDING) → 204.

## 15. Frontend connection
```
PayrollList.jsx → usePayrolls() → payrollApi.getPayrolls() → GET /api/payroll
PayrollFormPage → payrollApi.createPayroll()               (ADMIN route)
PayrollDetail   → getPayroll(id) / markPayrollPaid(id) / deletePayroll(id)
```
"Mark paid" calls `PATCH /api/payroll/{id}/paid` and disappears after the refresh
(there is no un-pay). All write buttons render only for `isAdmin`; HR sees the same
list read-only; employees see their own payslips (nav label "My Payroll").

## 16. Security / role rules
ADMIN: full management + the PAID transition. HR: read-only — can never mark PAID.
EMPLOYEE: own payslips only, read-only; salary figures are visible only for their own
rows and are never client-editable at any role (the request DTO has no netSalary).

## 17. Beginner mistakes
- Sending `netSalary` from the form — the field doesn't exist; the server computes it.
- Using `double` for money.
- Expecting a second `PATCH /paid` to update the date — it's a 409; PAID is terminal.
- Trying to delete a PAID payslip → 409 (financial records are not erasable).
- Forgetting the duplicate-month check on *update* (re-pointing a payslip to an
  employee who already has that month).

## 18. Interview questions
- **Why BigDecimal?** Exact decimal arithmetic for money; `double` accumulates binary rounding errors.
- **Why is netSalary server-computed?** Money must never be client-trusted; the request DTO has no such field, so the attack surface doesn't exist.
- **How do you guarantee one payslip per month?** `findByEmployeeIdAndMonth` check on create and update → 409; (a DB unique constraint would harden it — future improvement).
- **What makes PAID immutable?** `markPaid` refuses a second payment, and — as hardened — `updatePayroll` and `deletePayroll` both 409 once status is PAID.
- **Why is mark-paid a PATCH?** Same reasoning as attendance checkout: one small, rule-checked lifecycle transition.

## 19. Quick revision
1. Port 8084, `payroll_schema`, `payrolls` table.
2. month = "yyyy-MM" string; one payslip per employee+month → 409.
3. `BigDecimal` everywhere; net = basic + allowances − deductions, server-side.
4. New payslips are PENDING; only `PATCH /{id}/paid` (ADMIN) transitions them.
5. PAID → no re-pay, no PUT, no DELETE (all 409).
6. paymentDate server-stamped.
7. Employee reads scoped by JWT claim (query forced).
8. Feign employee validation/composition; 503 when employee-service is down.
9. HR is read-only; writes are ADMIN-only at the URL gate.
10. `PayrollRequest` has no netSalary — by construction.

## 20. One-minute explanation
"Payroll-service owns payslips on 8084. Every write is ADMIN-only; employees read only
their own payslips, scoped by the JWT's employeeId claim. The money rules are enforced
in PayrollServiceImpl: one payslip per employee per month (409), net salary computed
server-side with BigDecimal from basic plus allowances minus deductions, and a PENDING
to PAID transition exposed as PATCH /{id}/paid — where PAID is genuinely terminal:
re-paying, editing, even deleting a paid payslip all answer 409. Employee details are
composed live over Feign with the caller's token relayed."
