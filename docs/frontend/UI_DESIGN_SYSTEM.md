# UI Design System

> Last reviewed: written from current source code
> Source of truth: `hrms-frontend/src/index.css` and `src/components/**`
>
> This is the design-system companion to [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md).
> The original document lived at the repo root and is preserved here (content
> unchanged except this header and internal links).

---

# HRMS — UI Design System

The frontend's rules for how the app **looks, behaves and stays consistent**.

Generated with the [`ui-ux-pro-max`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) skill
(design system draft: `design-system/hrms/MASTER.md`), then adapted to this project's existing
brand and plain-CSS conventions.

---

## 1. Where everything lives

```
hrms-frontend/
├── index.html                        fonts + pre-paint theme script + favicon
└── src/
    ├── index.css                     ★ THE DESIGN SYSTEM (tokens + components + responsive)
    ├── config/navigation.js          sidebar groups + page titles (one source of truth)
    ├── utils/format.js               dates / numbers / initials
    ├── hooks/useTheme.js             light-dark switching
    ├── hooks/useMediaQuery.js        JS-visible breakpoints (nav toggle behaviour)
    ├── context/AuthContext.jsx       JWT + user (unchanged)
    ├── components/
    │   ├── layout/    AppLayout · Sidebar · Topbar
    │   ├── common/    Button · Badge · Card · PageHeader · Field · Modal · Toast ·
    │   │              ConfirmProvider · StatCard · Loading · PasswordInput
    │   ├── charts/    DonutChart · BarChart          (hand-built SVG, no chart library)
    │   └── employee/  EmployeeForm
    └── pages/         Dashboard · 4× List · 4× Detail · 4× Form · Login · NotFound
```

**The rule that keeps this coherent:** `index.css` owns every visual decision. Components own
structure and behaviour only. No page contains raw colour values, font sizes or one-off CSS files.

---

## 2. Tokens — the single source of truth

Everything below is a CSS custom property in `src/index.css`. Change a token, the whole app
updates. Do not hardcode any of these values in a component.

### Colour

| Role | Token | Light | Notes |
|---|---|---|---|
| Brand / primary action | `--color-primary` | `#1e40af` | Blue — kept from the existing project |
| Primary hover / active | `--color-primary-hover` / `-active` | `#1b3696` / `#162d7d` | |
| Secondary (charts, active nav) | `--color-secondary` | `#3b82f6` | |
| Accent | `--color-accent` | `#d97706` | Amber highlights only, never the main CTA |
| Page background | `--color-background` | `#f6f8fc` | |
| Card surface | `--color-card` | `#ffffff` | |
| Muted surface | `--color-muted` | `#e9eef6` | Chips, segmented control track |
| Body text | `--color-fg` | `#101f3d` | |
| Secondary text | `--color-fg-muted` | `#475569` | 7.5:1 on white |
| Tertiary text | `--color-fg-subtle` | `#64748b` | Meta, hints only |
| Border / strong border | `--color-border` / `-strong` | `#dfe7f4` / `#c6d5ec` | |
| Focus ring | `--color-ring` | `#1e40af` | |
| Destructive / success / warning / info | `--color-danger` etc. | `#dc2626` / `#047857` / `#92400e` / `#1d4ed8` | Each has a matching `-soft` tint |

**Dark theme** is a pure token swap under `[data-theme='dark']` — the sidebar stays dark navy in
both themes because it is the app's visual anchor. Toggled from the topbar, stored in
`localStorage.hrms_theme`, and applied **before first paint** by the inline script in `index.html`
so dark-mode users never see a white flash.

### Type

| Token | Size | Used for |
|---|---|---|
| `--fs-xs` | 12px | Labels, hints — never body copy |
| `--fs-sm` | 13px | Table meta, captions |
| `--fs-base` | 14px | The dense-dashboard workhorse |
| `--fs-md` | 15px | Form inputs |
| `--fs-lg` / `--fs-xl` | 17px / 20px | Card titles / page headings |
| `--fs-2xl` / `--fs-3xl` | 24px / 30px | KPI numbers / auth headings |

- **Body:** `Fira Sans` · **Numbers/IDs:** `Fira Code`
- Numeric columns get `font-variant-numeric: tabular-nums` so digits line up.
- Line height `1.5` for body, `1.25` for headings.

### Space, radius, elevation, motion

`--space-1…12` (4→48px, compact dashboard scale) · `--radius-sm|--radius|--radius-lg|--radius-xl|--radius-pill`
· `--shadow-xs|sm|md|lg` · `--transition-fast` (150ms) / `--transition` (200ms) / `--transition-slow` (280ms).

Every interactive element transitions in **150–300ms**. Nothing changes state instantly.

---

## 3. Component catalogue

Import from `components/common`. Every one is accessible by default — that is the point of having
them, not just visual consistency.

| Component | Key props | Notes |
|---|---|---|
| `Button` | `variant` (`primary`/`secondary`/`ghost`/`danger`/`danger-ghost`/`success`), `size`, `icon`, `iconRight`, `loading`, `block`, `iconOnly`, `as` | Renders `<button>` by default, `type="button"` so it never submits accidentally. `iconOnly` **requires** `aria-label` (warns in dev). `loading` swaps in a spinner + `aria-busy` and disables. `as={Link} to="…"` gives a real link with button looks. |
| `Field` | `label`, `htmlFor`, `error`, `hint`, `required`, `full` | Clones its child to attach `aria-invalid` + `aria-describedby` automatically. Use it for **every** field. |
| `Badge` | `status` | Maps backend statuses to readable labels (`HALF_DAY` → "Half day") while keeping `badge-${status}` for styling. |
| `Card` / `CardHeader` / `CardBody` / `CardFooter` | `title`, `subtitle`, `icon`, `actions`, `flush` | `flush` removes body padding for tables. |
| `PageHeader` | `icon`, `title`, `subtitle`, `actions` | Owns the page's **single `<h1>`**. |
| `StatCard` | `to`, `icon`, `tone`, `value`, `label`, `delta`, `hint`, `error` | Whole tile is the click target when `to` is set. `error` shows "—" plus the failing service instead of a misleading `0`. |
| `Modal` / `ConfirmDialog` | `open`, `onClose`, `title`, `tone` | Focus trapped, focus restored, Escape closes, background scroll locked. |
| `useConfirm()` | `await confirm({ title, message, confirmLabel, tone })` | Promise-based. Returns `true`/`false`. |
| `useToast()` | `toast.success(title, msg)`, `.error`, `.info` | Auto-dismiss 5s, max 4, errors are `role="alert"`. |
| `Loading` / `LoadingCards` | `rows`, `count` | Skeletons that reserve layout — no jump when data lands. |
| `ErrorAlert` | `title`, `message`, `onRetry`, `children` | `role="alert"`. Pass a link as `children` for an escape hatch. |
| `EmptyState` | `icon`, `title`, `message`, `children` | Empty ≠ error. Always offer the next action. |
| `DonutChart` / `BarChart` | `data`, `formatValue` | Hand-built SVG/flexbox. Charts are `aria-hidden`; the same numbers appear as real text. |

### Example

```jsx
const confirm = useConfirm()
const toast = useToast()

async function handleDelete(employee) {
  const ok = await confirm({
    title: 'Delete this employee?',
    message: `"${employee.name}" will be permanently removed. This cannot be undone.`,
    confirmLabel: 'Delete employee',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await deleteEmployee(employee.id)
    await refresh()
    toast.success('Employee deleted', `${employee.name} has been removed.`)
  } catch (err) {
    toast.error('Could not delete employee', err.message)
  }
}
```

---

## 4. Layout

```
┌──────────────┬─────────────────────────────────────────┐
│  HRMS        │ [☰] Workforce / Employees    [☾] [user▾] │  ← Topbar (sticky)
│              ├─────────────────────────────────────────┤
│  OVERVIEW    │  PageHeader   [secondary] [primary]      │
│  · Dashboard │  ┌──────┬──────┬──────┐                  │
│  WORKFORCE   │  │ KPI  │ KPI  │ KPI  │  stats-grid      │
│  · Employees │  └──────┴──────┴──────┘                  │
│  · Leave     │  ┌───────────┬───────────┐               │
│  · Attendance│  │ chart     │ chart     │  chart-grid   │
│  FINANCE     │  └───────────┴───────────┘               │
│  · Payroll   │  ┌───────────┬───────────┐               │
│  ─────────── │  │ table     │ panel     │  detail-grid  │
│  [user]      │  └───────────┴───────────┘               │
│  [Log out]   │                                          │
└──────────────┴─────────────────────────────────────────┘
```

- **Layout is a route**, not a wrapper: `<ProtectedRoute><AppLayout /></ProtectedRoute>` with pages
  in `<Outlet />`. The sidebar never unmounts between navigations.
- Nav is grouped **Overview / Workforce / Finance** and defined in `config/navigation.js`.
  (Since the role-based update the same config also carries the EMPLOYEE "Personal" group
  and the ADMIN "Administration" group — see FRONTEND_GUIDE §4.)
- `PageHeader` → `.stats-grid` → `.chart-grid` → `.detail-grid` gives every page the same rhythm.

---

## 5. Responsive behaviour

Mobile-first, verified at **375 · 768 · 1024 · 1440px**. No horizontal scroll at any width.

| Breakpoint | What changes |
|---|---|
| `≤1024px` | Sidebar becomes an **overlay drawer** (scrim, Escape to close, locked background scroll). The topbar `☰` opens it instead of collapsing the rail. |
| `≤900px` | Auth brand panel hidden; compact brand lockup appears above the form instead. |
| `≤860px` | `.table--stack` turns tables into **labelled cards** — each cell shows its column name via `data-label`, so no column is lost and there is no sideways scrolling. |
| `≤720px` | Touch targets grow to **44px**; inputs use 16px type (prevents iOS zoom-on-focus); page-header actions go full width; breadcrumb root hidden; toasts span the screen; detail rows stack label-over-value. |

The one interaction JS must decide is the nav toggle: `useMediaQuery('(max-width: 1024px)')` picks
*open drawer* (mobile) vs *collapse rail* (desktop), because those are different actions on the same
button and CSS alone cannot swap the handler.

---

## 6. Accessibility rules this system enforces

| Rule | How |
|---|---|
| Visible keyboard focus | `:focus-visible` ring on every interactive element — never removed, only restyled |
| One `<h1>` per page | Always from `PageHeader` |
| Errors are programmatic, not just red | `Field` wires `aria-invalid` + `aria-describedby` to each message; `role="alert"` on banners |
| Focus returns to the user | Modal restores focus to whatever opened it |
| Nothing conveyed by colour alone | Every badge has a text label; chart legends repeat the values as text |
| Live regions are scoped | Toasts: polite for success/info, `role="alert"` only for errors |
| Skip link | First tab stop jumps to `#main` |
| Motion is optional | `prefers-reduced-motion` kills all non-essential animation |
| Icons are decorative or labelled | Icons `aria-hidden`; icon-only buttons always carry `aria-label` |
| Touch targets ≥44px | Enforced at `≤720px` |

---

## 7. Conventions

**Do**
- Style through tokens and existing classes; add a rule to `index.css` if something is missing.
- Use `Field` for form inputs and `Button` for anything clickable.
- Show loading → error → empty → data, in that order, on every data view.
- Confirm destructive actions with `useConfirm` and report the outcome with `useToast`.
- Reserve a skeleton for anything that loads.

**Don't**
- Use emoji as icons (every icon is a Lucide SVG now).
- Hardcode colours, sizes or shadows outside the token block.
- Reach for `window.confirm` / `alert` — replaced by the dialog and toast providers.
- Rely on `:hover` alone for important actions (touch devices have no hover).
- Leave a dead control on screen: if something should not work, disable it **and** explain why.

### Adding a new page
1. Add the route inside the layout route in `src/App.jsx`.
2. Add its title to `SECTION_TITLES` and, if it belongs in the nav, `NAV_GROUPS` in `config/navigation.js`.
3. Start from `PageHeader` + a `Card`.
4. Use `useXxx()` hooks for data — never call an API file directly from a page.

---

## 8. What changed in the redesign (and what deliberately did not)

**Changed — presentation only:** tokens and dark mode, grouped collapsible sidebar, topbar with
breadcrumb and account menu, KPI dashboard with charts, search + status filters on every list page,
right-aligned money columns with a totals row, tables that become cards on mobile, rewritten forms
with inline validation and contextual hints, confirm dialogs and toasts instead of
`window.confirm`/`alert`, skeleton loading states, human-readable dates and status labels,
a real 404 page.

**Not changed:** every route and URL, every API call and gateway path, the hooks layer, all
validation *rules* (only their presentation), and every backend contract. `payrollApi`, `leaveApi`,
`attendanceApi`, `employeeApi`, `authApi`, `axiosInstance` and `AuthContext` are untouched.

No page invented a new backend capability. Where a feature was missing (approve/reject leave,
global search, per-service `/stats` endpoints) it was left out rather than faked in the UI — see the
trade-off notes in `Dashboard.jsx` and `PayrollList.jsx`.

---

## 9. Deviations from the generated `MASTER.md`

`design-system/hrms/MASTER.md` is the raw skill output, kept for reference. Three deliberate
departures, because the generator does not know this codebase:

1. **Primary colour stays blue (`#1e40af`), not the generated amber CTA.** The existing app already
   used blue, and blue-for-primary + amber-for-highlight is the palette the generator itself
   describes ("Blue data + amber highlights"). Amber is used only for accents.
2. **Fira Code is for numbers, not headings.** Headings use Fira Sans; monospace is reserved for
   IDs and amounts where column alignment matters.
3. **Spacing tokens are named `--space-1…12`, not `--space-xs…3xl`.** The numeric scale matches the
   dense 8/10 dashboard density and reads the same as the rest of the codebase.

---

## 10. Pre-delivery checklist

Run through this before shipping UI changes:

- [ ] No emoji used as an icon
- [ ] All icons from one set (Lucide)
- [ ] `cursor: pointer` on every clickable element
- [ ] Hover **and** `:focus-visible` states present, with 150–300ms transitions
- [ ] Text contrast ≥ 4.5:1 in both light and dark themes
- [ ] Keyboard-only pass: skip link, tab order, Escape closes dialogs/drawer, focus never lost
- [ ] Errors reachable by screen reader (`aria-invalid` + `aria-describedby`)
- [ ] No horizontal scroll at 375px
- [ ] Loading, error and empty states all designed
- [ ] `prefers-reduced-motion` respected
- [ ] `npm run build` passes
