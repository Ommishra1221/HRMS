# Frontend Guide (React + Vite)

> Last reviewed: written from current source code
> Source of truth: `hrms-frontend/src/**`
> App: hrms-frontend · Port: 5173 · Backend contact: http://localhost:8080 only

## 1. What is this app?
A React 19 + Vite SPA. It never talks to a microservice directly — **every** call
goes through the API Gateway on 8080. It holds no authority: hiding a button is UX,
the backend's JWT checks are the real security boundary.

## 2. Architecture in one picture

```
pages/                     screens (Dashboard, EmployeeList, Login, …)
   ↓ use
hooks/                     data fetching + state (useEmployees, useLeaves, …)
   ↓ call
api/                       one file per service (employeeApi, authApi, …)
   ↓ wrapped by
api/axiosInstance.js       base URL = :8080 + JWT interceptor
   ↓ HTTP
API Gateway :8080  →  microservices
```

Folder map:

```
hrms-frontend/src/
├── main.jsx               providers: BrowserRouter → Auth → Toast → Confirm → App
├── App.jsx                the routing table (role-aware)
├── index.css              THE design system (tokens + components)
├── config/navigation.js   nav groups + titles, filtered per role
├── context/AuthContext.jsx  JWT + user + role helpers
├── components/
│   ├── layout/   AppLayout · Sidebar · Topbar
│   ├── common/   Button · Badge · Card · PageHeader · Field · Modal · Toast ·
│   │             ConfirmProvider · StatCard · Loading · PasswordInput
│   ├── charts/   DonutChart · BarChart (hand-built SVG)
│   └── employee/ EmployeeForm
├── pages/        17 pages (4×List, 4×Detail, 4×Form, 3 dashboards, Login, …)
├── hooks/        useEmployees/Leaves/Attendance/Payrolls/Users/Theme/MediaQuery
└── api/          employeeApi · leaveApi · attendanceApi · payrollApi · authApi ·
                  userApi · axiosInstance
```

## 3. Authentication flow

```
Login.jsx → AuthContext.login() → POST /api/auth/login
   → token stored in localStorage.hrms_token, user cached in localStorage.hrms_user
   → axiosInstance request interceptor:  Authorization: Bearer <token> on every call
   → response interceptor: 401 on a PROTECTED call → wipe storage → redirect /login
   → ProtectedRoute remembers location.state.from so login returns you there
AuthContext on mount → GET /api/auth/me → refreshes the cached profile (server truth)
```

- **`AuthContext`** exposes: `user`, `isAuthenticated`, `isAdmin/isHr/isEmployee`,
  `roles` (ROLE_ prefix stripped once at the boundary), `employeeId`, `hasRole(...)`,
  `login`, `logout`, `refreshUser`. No `register()` exists.
- **`ProtectedRoute`** supports children, `adminOnly`, and layout-route form
  (`roles={['ADMIN','HR']} />` → renders `<Outlet/>`). Unauthorized deep links render
  a friendly "X access required" card — never a broken page.
- Anonymous → `/login` (the only public route). Authenticated users landing on
  `/login` are redirected to the dashboard.

## 4. Routing and role-based navigation

| Route(s) | Guard |
|---|---|
| `/login` | public |
| `/dashboard` | any authenticated (renders `EmployeeDashboard` for EMPLOYEE) |
| `/employees`, `/employees/:id` | ADMIN, HR |
| `/employees/new`, `/employees/:id/edit`, `/users` | ADMIN |
| `/leaves`, `/leaves/:id` | all three (backend scopes employee's rows) |
| `/leaves/new`, `/leaves/:id/edit` | ADMIN, EMPLOYEE |
| `/attendance(…)` list/detail | all three; new/edit ADMIN |
| `/payrolls(…)` list/detail | all three; new/edit ADMIN |
| `/me` | EMPLOYEE |

`config/navigation.js` is the single source of truth: `navGroupsFor(role)` filters
groups/items; EMPLOYEE labels reuse the shared routes ("My Leave" → `/leaves`) because
the backend already scopes the data. Sidebar, Topbar breadcrumb, and browser-tab
titles all derive from this one config.

## 5. Role-based UI matrix (visibility = backend permissions)

| Module | ADMIN | HR | EMPLOYEE |
|---|---|---|---|
| Dashboard | org overview + write quick actions | org overview + browse links | own dashboard (`EmployeeDashboard`) |
| Employees | Full CRUD buttons | view + search only | hidden (route guarded) |
| Leave | Full CRUD any row | view only | "My Leave": apply, edit/delete own PENDING |
| Attendance | Full + checkout | view only | "My Attendance": view own rows |
| Payroll | Full + **Mark PAID** | view only | "My Payroll": own payslips read-only |
| Users (`/users`) | Full (create/role/enable/reset) | hidden | hidden |
| My Profile (`/me`) | — | — | own profile from `GET /employees/me` |

- Write buttons render only for roles the backend would accept — no dead buttons.
- `LeaveFormPage` **employee mode**: no employeeId picker (read-only "You (own
  employee record)"), payload id from `useAuth().employeeId`, `useEmployees(false)`
  skips the ADMIN-only directory call, non-PENDING rows show a lock alert with a
  disabled submit, and a foreign id in the edit URL fails fast with a clear message.
- `UserManagement` speaks the exact backend contract (`roles[]` with `ROLE_` prefix
  reduced via a local helper; plain `role` string in; password min 6).

## 6. Data states on every view

Every data view follows **loading → error → empty → data** using shared components:
skeleton `Loading`/`LoadingCards`, `ErrorAlert` (role="alert", optional retry),
`EmptyState` (with the next action), then the data. Dashboard KPIs degrade per
service (`error` prop shows "— {service}-service unavailable" instead of a lying 0);
only when *every* source fails does the page show one full error banner. Totals and
charts are computed client-side from the loaded rows — honestly labelled as a
trade-off in code comments; no `/stats` endpoints are invented.

## 7. What the UI intentionally does NOT implement

- **No leave approve/reject buttons** — no backend endpoint exists yet.
- **No per-service statistics endpoints** — dashboard aggregates are client-side.
- **No "mark my attendance" self-service** — the backend has no such API.
- **No signup/register** — removed end-to-end.
- No fake client-side authorization: the UI mirrors backend rules for UX and lets the
  backend be the boundary.

## 8. Design system (summary)

See [UI_DESIGN_SYSTEM.md](UI_DESIGN_SYSTEM.md) for the full token/component spec.
Rules that matter day-to-day: style only through `index.css` tokens; `Button`/`Field`
for all interaction; confirm destructive actions with `useConfirm`; report outcomes
with `useToast`; icons are Lucide SVGs; tables become labelled cards ≤860px; sidebar
becomes a drawer ≤1024px; dark mode via `[data-theme='dark']` token swap applied
pre-paint.

## 9. Beginner mistakes
- Calling `http://localhost:8081` directly instead of the gateway (CORS + architecture).
- Reading the role from `localStorage` and *enforcing* it — only ever use it for UX.
- Sending an employee-picked employeeId for self-service — use the JWT value via
  `useAuth().employeeId`.
- Adding a page but forgetting `SECTION_TITLES` (title fallback) or the route guard.
- Forgetting `enabled=false` on `useEmployees` in contexts that must not call the
  ADMIN/HR-only directory endpoint.

## 10. Interview questions
- **Where is the JWT stored and why?** `localStorage` via AuthContext (survives refresh); interceptor attaches it. XSS is the trade-off; httpOnly cookies would be the alternative.
- **How does the UI know the role?** From the `/auth/me`-refreshed AuthContext — the server is the source of truth; the UI only mirrors it.
- **How do you show only permitted actions?** Components read `isAdmin/isHr/isEmployee` from `useAuth()`; buttons render only for roles the backend accepts.
- **Why do employee pages reuse `/leaves` etc.?** The backend scopes employee tokens to their own rows; duplicating pages would add no security, only code.
- **What happens on a 401 mid-session?** The axios response interceptor wipes the token and redirects to `/login` (login-page failures stay inline).

## 11. Quick revision
1. One origin: 8080 gateway, always.
2. Token: `localStorage.hrms_token`; attached by the axios interceptor.
3. Roles: stripped `ROLE_` once; helpers `isAdmin/isHr/isEmployee/hasRole`.
4. `/login` is the only public route; `state.from` restores deep links.
5. Nav = `navGroupsFor(role)`; titles derive from the same config.
6. Write buttons are role-gated and match backend rules exactly.
7. Employee leave form takes identity from the JWT, never a picker.
8. loading → error → empty → data on every view.
9. Design system lives entirely in `index.css` tokens.
10. Nothing security-relevant is decided client-side.

## 12. One-minute explanation
"The frontend is a React SPA on 5173 that talks only to the gateway. AuthContext keeps
the JWT in localStorage and an axios interceptor stamps it on every request, with a
401 interceptor that logs out and returns you to /login. Routing is role-aware through
ProtectedRoute, and navigation is filtered by a single role-tagged config so the
sidebar, breadcrumbs and tab titles can never disagree. Buttons mirror exactly what
the backend permits — admins get CRUD and Mark PAID, HR is read-only, employees get
self-service screens where identity comes from their token, not from any form field."
