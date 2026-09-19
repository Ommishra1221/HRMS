# HRMS Database Setup — one database, five schemas

All backend services now share **one PostgreSQL database** named `HRMS` and each
service owns a **private schema** inside it. This replaces the previous
database-per-service model (`employee_db`, `leave_db`, ...).

```
HRMS  (jdbc:postgresql://localhost:5432/HRMS)
├── employee_schema    → employee-service   (:8081)
├── leave_schema       → leave-service      (:8082)
├── attendance_schema  → attendance-service (:8083)
├── payroll_schema     → payroll-service    (:8084)
└── auth_schema        → auth-service       (:8085)   users, roles, users_roles
```

| Service            | Schema              | Tables owned                  |
|--------------------|---------------------|-------------------------------|
| employee-service   | `employee_schema`   | `employees`                   |
| leave-service      | `leave_schema`      | `leaves`                      |
| attendance-service | `attendance_schema` | `attendance`                  |
| payroll-service    | `payroll_schema`    | `payrolls`                    |
| auth-service       | `auth_schema`       | `users`, `roles`, `users_roles` |

Each service is isolated to its own schema via
`spring.jpa.properties.hibernate.default_schema`, so Hibernate qualifies every
generated SQL statement with that schema. A service cannot read or write another
service's tables.

---

## 1. Create the database and schemas (one time)

The database `HRMS` must already exist. Create the five schemas inside it:

```sql
CREATE SCHEMA IF NOT EXISTS employee_schema;
CREATE SCHEMA IF NOT EXISTS leave_schema;
CREATE SCHEMA IF NOT EXISTS attendance_schema;
CREATE SCHEMA IF NOT EXISTS payroll_schema;
CREATE SCHEMA IF NOT EXISTS auth_schema;
```

`spring.jpa.hibernate.ddl-auto=update` creates/updates the tables inside the
correct schema on startup.

> If you previously created the old separate databases (`employee_db`, ...),
> they are no longer referenced by any service and can be dropped whenever you
> like — nothing in the project points at them anymore.

---

## 2. Database password (never committed)

The datasource password is **externalized** in every service:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/HRMS
spring.datasource.username=${DB_USERNAME:postgres}
spring.datasource.password=${DB_PASSWORD}
```

`DB_PASSWORD` has **no default**, so it must be set before starting any service.
`DB_USERNAME` defaults to `postgres` but can be overridden too.

Set it in the same terminal that starts the services:

```bash
# Git Bash / macOS / Linux
export DB_PASSWORD='your-postgres-password'
```

```powershell
# PowerShell
$env:DB_PASSWORD = 'your-postgres-password'
```

In an IDE (IntelliJ / VS Code / Eclipse), add a run configuration environment
variable named `DB_PASSWORD` with the same value.

Never commit the password to `application.properties` or any tracked file.

---

## 3. Start order

```
1. discovery-server   (:8761)   ← Eureka, must be first
2. employee-service   (:8081)
3. leave-service      (:8082)
4. attendance-service (:8083)
5. payroll-service    (:8084)
6. auth-service       (:8085)
7. api-gateway        (:8080)
```

All services build with `./mvnw -DskipTests compile`. `api-gateway` and
`discovery-server` have no datasource and were not changed.

---

## 4. Backend files changed for this migration

```
employee-service/src/main/resources/application.properties
leave-service/src/main/resources/application.properties
attendance-service/src/main/resources/application.properties
payroll-service/src/main/resources/application.properties
auth-service/src/main/resources/application.properties
```

Each file now uses the shared `HRMS` datasource, its own `default_schema`, and
`${DB_PASSWORD}`.

**Unchanged on purpose:** ports, `spring.application.name`, all Eureka settings,
Feign clients, JWT settings (`app.jwt.secret`, `app.jwt.expiration-ms`), entity
relationships, repositories/services/controllers, API contracts, and every
frontend file. Some Java comment blocks and the older `*.md` guides still
mention the historical `*_db` names — those are documentation only and have no
effect on runtime behaviour.

---

## 5. Demo data (when the UI looks empty)

A freshly created `HRMS` database has the employee directory and the auth
accounts, but no leave, attendance or payroll rows — so every list, chart and
dashboard tile renders an empty state. `database/demo_data.sql` fills exactly
those three schemas with realistic data:

```bash
export PGPASSWORD=postgres
psql -U postgres -h localhost -f database/demo_data.sql
```

What it creates (on the standard 6-employee roster):

| Schema | Rows | Shape |
|---|---|---|
| `leave_schema.leaves` | 16 | 9 APPROVED, 3 REJECTED, 4 PENDING · SICK/CASUAL/EARNED · Jun–Oct 2026 |
| `attendance_schema.attendance` | 120 | 20 weekdays × 6 employees (24 Aug – 18 Sep 2026) · PRESENT / WFH / HALF_DAY / ABSENT / LEAVE |
| `payroll_schema.payrolls` | 36 | Apr–Aug 2026 PAID + Sep 2026 PENDING, one per employee per month |

It only ever writes `INSERT`s (plus nothing else), and every insert is guarded by
`NOT EXISTS`, so it is **safe to run repeatedly** — a second run adds nothing.
The employee roster and salary bands are derived from
`employee_schema.employees` and its `department` column, so employees added
later are seeded too. `APPROVED` leave dates automatically become `LEAVE`
attendance rows, and every rule the services enforce (one attendance row per
employee per day, one payslip per employee per month, `PAID` always has a
payment date, `check_out` never before `check_in`) holds in the generated data as
well.

> The standalone databases `employee_db`, `leave_db`, `attendance_db` and
> `payroll_db` are leftovers from before this migration. **Nothing reads or
> writes them any more** — do not seed or query them; the live data is always
> inside `HRMS`.
