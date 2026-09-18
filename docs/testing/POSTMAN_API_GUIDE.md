# Postman API Guide

> Last reviewed: written from current source code
> Source of truth: the controllers and `GlobalExceptionHandler`s (only actually
> produced status codes are listed)

## 1. Environment setup

Create a Postman environment:

| Variable | Value |
|---|---|
| `baseUrl` | `http://localhost:8080` |
| `token_admin` | (set by the login request below) |
| `token_hr` | (set by the login request) |
| `token_employee` | (set by the login request) |
| `employeeId_employee` | `1` (the seeded employee link) |

## 2. Login and storing the JWT

Request (no auth needed — the only public endpoint):

```
POST {{baseUrl}}/api/auth/login
Body → raw → JSON:
{ "username": "admin", "password": "Admin@123" }
```

Response 200:

```json
{ "token": "eyJhbGciOi...", "tokenType": "Bearer",
  "id": 1, "username": "admin", "roles": ["ROLE_ADMIN"], "employeeId": null }
```

Tests tab (stores the token automatically — repeat for `hr/Hr@123` and
`emp01/Emp01@123`):

```javascript
const body = pm.response.json()
pm.environment.set("token_admin", body.token)
pm.test("200 on login", () => pm.response.to.have.status(200))
```

## 3. Authorization header

Every protected request: **Authorization → Bearer Token → `{{token_admin}}`** (or
per-role variable). Do not type "Bearer" manually when using the Bearer Token type.

Through the gateway the paths are `/api/employees`, `/api/leaves`, `/api/attendance`,
`/api/payroll`, `/api/auth/...`. (Direct service ports like `:8081/employees` also
work for testing but are not what production traffic uses.)

## 4. CRUD smoke tests (as ADMIN)

| # | Request | Expect |
|---|---|---|
| 1 | `POST /api/employees` `{"name":"Test User","email":"test@x.com","department":"IT"}` | **201**, body has `id` |
| 2 | `GET /api/employees` | **200**, array contains the new row |
| 3 | `GET /api/employees/{id}` | **200** |
| 4 | `PUT /api/employees/{id}` (same shape) | **200**, updated fields |
| 5 | `DELETE /api/employees/{id}` | **204**, empty body |
| 6 | `GET /api/employees/{id}` again | **404** |

## 5. Status codes this project actually returns

| Code | Meaning here | Concrete trigger |
|---|---|---|
| **200** | OK | any successful read/update |
| **201** | Created | successful POST (employee/leave/attendance/payroll/user) |
| **204** | No Content | successful DELETE; no body |
| **400** | validation / bad input / unknown role | missing `@NotBlank` field; `"role":"SUPERUSER"` |
| **401** | no/bad/expired token; any login failure | no header; garbage token; wrong password; disabled account at login |
| **403** | authenticated but not allowed (role **or** ownership) | HR calls `POST /employees`; employee reads another's leave; self-disable |
| **404** | row not found | `GET /api/employees/9999` |
| **409** | business conflict | duplicate attendance day; duplicate payroll month; edit/delete a PAID payslip; duplicate username |
| **500** | unexpected | bug (should not happen) |
| **503** | employee-service unreachable during a Feign composition | stop employee-service, then `GET /api/leaves` |

Error bodies always look like:

```json
{ "timestamp": "…", "status": 403, "error": "Forbidden", "message": "…" }
```

## 6. Testing tip — follow the security layers

When a request fails, the layer that refused it tells you what to fix:

1. **401 with no body detail** → token missing/invalid/expired (filter layer).
2. **403 "Access denied…"** → role gate (URL rule or `@PreAuthorize`).
3. **403 with a specific message** ("You can only view your own leave requests") →
   ownership check in the service.
4. **404** → authenticated and allowed, row doesn't exist.
5. **409** → business rule refused the data.

Continue with role scenarios: [ROLE_BASED_TESTING.md](ROLE_BASED_TESTING.md) and
[TROUBLESHOOTING.md](TROUBLESHOOTING.md).
