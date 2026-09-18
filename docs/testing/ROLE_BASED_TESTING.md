# Role-Based Testing (positive + negative scenarios)

> Last reviewed: written from current source code
> Every expectation below mirrors the actual `SecurityConfig` rules, `@PreAuthorize`
> annotations and service-layer checks.

Use the three demo accounts: `admin/Admin@123`, `hr/Hr@123`,
`emp01/Emp01@123` (employee link = 1). Store the three tokens as in
[POSTMAN_API_GUIDE.md](POSTMAN_API_GUIDE.md).

## 1. ADMIN — allowed operations (all should pass)

| # | Request | Token | Expect |
|---|---|---|---|
| A1 | `POST /api/employees` | admin | **201** |
| A2 | `PUT /api/employees/{id}` | admin | **200** |
| A3 | `DELETE /api/employees/{id}` | admin | **204** |
| A4 | `GET /api/employees` | admin | **200** full list |
| A5 | `POST /api/leaves` (any employeeId) | admin | **201**, status PENDING |
| A6 | `PUT /api/leaves/{id}` (any) | admin | **200** |
| A7 | `DELETE /api/leaves/{id}` (any) | admin | **204** |
| A8 | `POST /api/attendance` | admin | **201** |
| A9 | `PATCH /api/attendance/{id}/checkout` `{"checkOut":"18:30:00"}` | admin | **200** |
| A10 | `POST /api/payroll` | admin | **201**, `netSalary` computed |
| A11 | `PATCH /api/payroll/{id}/paid` | admin | **200**, `paymentDate` stamped |
| A12 | `PUT /api/leaves`…/users management — `GET/POST/PUT/PATCH /api/auth/users…` | admin | **200/201** |

## 2. HR — read-only (mixed results prove the boundary)

| # | Request | Token | Expect |
|---|---|---|---|
| H1 | `GET /api/employees` | hr | **200** |
| H2 | `GET /api/leaves` / `GET /api/attendance` / `GET /api/payroll` | hr | **200** full lists |
| H3 | `GET /api/employees/{id}` | hr | **200** |
| H4 | `POST /api/employees` | hr | **403** |
| H5 | `PUT`/`DELETE /api/employees/{id}` | hr | **403** |
| H6 | `POST /api/leaves` | hr | **403** (HR never writes leave) |
| H7 | `PATCH /api/payroll/{id}/paid` | hr | **403** — HR can never mark PAID |
| H8 | `POST /api/payroll` | hr | **403** |
| H9 | `PATCH /api/attendance/{id}/checkout` | hr | **403** |
| H10 | `GET /api/auth/users` | hr | **403** |

## 3. EMPLOYEE — self-service

| # | Request | Token | Expect |
|---|---|---|---|
| E1 | `GET /api/employees/me` | employee | **200** own profile (id 1) |
| E2 | `GET /api/employees/1` | employee | **200** (own id) |
| E3 | `GET /api/employees` | employee | **403** (no directory list) |
| E4 | `GET /api/leaves` | employee | **200** own rows only |
| E5 | `POST /api/leaves` `{"employeeId":1,…}` | employee | **201** PENDING |
| E6 | `POST /api/leaves` `{"employeeId":2,…}` | employee | **403** (identity theft attempt) |
| E7 | `PUT /api/leaves/{own PENDING}` `{"employeeId":2,…}` | employee | **200** but row stays employeeId 1 (edit is content-only) |
| E8 | `PUT /api/leaves/{own APPROVED}` | employee | **403** "Only PENDING…" |
| E9 | `DELETE /api/leaves/{own PENDING}` | employee | **204** |
| E10 | `GET /api/attendance` / `GET /api/payroll` | employee | **200** own rows only |
| E11 | `GET /api/payroll?employeeId=2` | employee | **200** but filtered to **own** rows (query forced to JWT id) |
| E12 | `POST /api/payroll` / `POST /api/attendance` | employee | **403** |

## 4. Negative / attack-style tests

| # | Request | Token | Expect |
|---|---|---|---|
| N1 | any protected endpoint, **no header** | — | **401** |
| N2 | `Authorization: Bearer garbage` | — | **401** |
| N3 | expired token (wait 24 h or hand-modify `exp`) | — | **401** |
| N4 | valid token, one payload character flipped | — | **401** (signature) |
| N5 | `POST /api/auth/login` with a disabled account | — | **401** (same vague message as wrong password) |
| N6 | `POST /api/auth/users` | employee | **403** |
| N7 | `POST /api/auth/users` body `"role":"ADMIN"` | hr | **403** (never reaches whitelisting) |
| N8 | `PATCH /api/auth/users/{self}/role` → HR | admin | **403** (self-demotion guard) |
| N9 | disable the last enabled admin | admin | **403** (lockout guard) |
| N10 | `POST /api/auth/users` `"role":"SUPERUSER"` | admin | **400** (role whitelist) |
| N11 | duplicate username/email/employeeId | admin | **409** |
| N12 | `POST /api/attendance` same employee+date twice | admin | **409** |
| N13 | `POST /api/payroll` same employee+month twice | admin | **409** |
| N14 | `PUT /api/payroll/{PAID id}` (any field) | admin | **409** (PAID immutable) |
| N15 | `DELETE /api/payroll/{PAID id}` | admin | **409** |
| N16 | second `PATCH /api/payroll/{PAID id}/paid` | admin | **409** "already paid" |
| N17 | `GET /api/leaves/{other employee's id}` | employee | **403** |
| N18 | `PUT /api/leaves/{other employee's id}` | employee | **403** |
| N19 | `PATCH /api/attendance/{id}/checkout` | employee | **403** |
| N20 | `POST /api/employees` missing `name` | admin | **400** (validation) |
| N21 | `GET /api/leaves` with employee-service **stopped** | any | **503** |
| N22 | `GET /api/employees/9999` | admin | **404** |

## 5. Cross-employee ownership walkthrough (the money test)

1. As admin, create employees A and B; create accounts for both (role EMPLOYEE,
   linked employeeIds).
2. Login as A. Apply for leave (E5) → 201.
3. Login as B. Try `GET /api/leaves/{A's leave id}` → **403**.
4. Try E6/E7-style identity tricks → 403 / silent no-op on identity.
5. As admin, approve the leave *in the database* (no approve API yet) or leave it
   PENDING; then B can never modify A's row regardless → 403.

## 6. What to watch in each response

- 200/201 bodies: check the **composed `employee` object** on leave/attendance/payroll
  rows (Feign worked), and `netSalary` on payroll (server-computed).
- 403 messages distinguish the layer: generic "Access denied…" = role gate; specific
  "You can only…" = ownership.
- 409 messages name the conflict (duplicate day/month, already paid).
- Disabled-account login: message identical to a wrong password — by design.
