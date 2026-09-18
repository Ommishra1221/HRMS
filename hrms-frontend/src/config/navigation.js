import { Banknote, CalendarDays, Clock, IdCard, LayoutDashboard, Users, UsersRound } from 'lucide-react'

// =============================================================================
// Navigation config - the single source of truth for the sidebar AND topbar.
// =============================================================================
// Keeping the nav here (rather than inside Sidebar.jsx) means the sidebar and
// the topbar breadcrumb can never disagree about what a route is called, and
// adding a page is a one-line change.
//
// ROLE-BASED NAVIGATION (added for the authorization model):
// Every group and item can carry a `roles` array. navGroupsFor(role) filters
// this config down to what the signed-in role may see. This is UX only - the
// backend remains the real gate; hiding a link simply keeps users away from
// pages that would answer 403 anyway.
//
//   ADMIN    Dashboard · Employees · Leave · Attendance · Payroll · Users
//   HR       Dashboard · Employees · Leave · Attendance · Payroll  (read-only)
//   EMPLOYEE Dashboard · My Profile · My Leave · My Attendance · My Payroll
//
// The EMPLOYEE entries point at the SAME routes (/leaves, /attendance,
// /payrolls): the backend scopes those lists to the caller's own rows, so no
// separate "my-*" endpoints or pages are needed - the label reflects what the
// employee will actually see.

export const NAV_GROUPS = [
  {
    label: 'Overview',
    roles: ['ADMIN', 'HR', 'EMPLOYEE'],
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    ],
  },
  {
    label: 'Workforce',
    roles: ['ADMIN', 'HR'],
    items: [
      { to: '/employees', label: 'Employees', icon: Users, roles: ['ADMIN', 'HR'] },
      { to: '/leaves', label: 'Leave', icon: CalendarDays, roles: ['ADMIN', 'HR'] },
      { to: '/attendance', label: 'Attendance', icon: Clock, roles: ['ADMIN', 'HR'] },
    ],
  },
  {
    label: 'Finance',
    roles: ['ADMIN', 'HR'],
    items: [{ to: '/payrolls', label: 'Payroll', icon: Banknote, roles: ['ADMIN', 'HR'] }],
  },
  {
    // Employee self-service. "My Leave" etc. reuse the org routes - the
    // backend returns only the caller's own rows for an EMPLOYEE token.
    label: 'Personal',
    roles: ['EMPLOYEE'],
    items: [
      { to: '/me', label: 'My Profile', icon: IdCard, roles: ['EMPLOYEE'] },
      { to: '/leaves', label: 'My Leave', icon: CalendarDays, roles: ['EMPLOYEE'] },
      { to: '/attendance', label: 'My Attendance', icon: Clock, roles: ['EMPLOYEE'] },
      { to: '/payrolls', label: 'My Payroll', icon: Banknote, roles: ['EMPLOYEE'] },
    ],
  },
  {
    label: 'Administration',
    roles: ['ADMIN'],
    items: [{ to: '/users', label: 'Users', icon: UsersRound, roles: ['ADMIN'] }],
  },
]

/** The nav for one role: groups whose `roles` include it, with items filtered too. */
export function navGroupsFor(role) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0 && (!group.roles || group.roles.includes(role)))
}

// Section titles keyed by the FIRST path segment, so detail and edit routes
// (/employees/7/edit) resolve to the same title as their list page.
const SECTION_TITLES = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  leaves: 'Leave',
  attendance: 'Attendance',
  payrolls: 'Payroll',
  me: 'My Profile',
  users: 'Users',
  login: 'Sign in',
}

// What the same route is called for an EMPLOYEE (self-service wording).
const EMPLOYEE_TITLES = {
  leaves: 'My Leave',
  attendance: 'My Attendance',
  payrolls: 'My Payroll',
}

export function sectionFor(pathname) {
  const segment = pathname.split('/').filter(Boolean)[0]
  return segment || 'dashboard'
}

/**
 * Page title for the topbar breadcrumb and the browser tab.
 * Pass the active role (e.g. user?.roles?.[0]) to get the self-service
 * wording for employees; without it the org-wide titles are used.
 */
export function pageTitleFor(pathname, role) {
  const segment = sectionFor(pathname)
  if (role === 'EMPLOYEE' && EMPLOYEE_TITLES[segment]) return EMPLOYEE_TITLES[segment]
  return SECTION_TITLES[segment] || 'HRMS'
}
