// =============================================================================
// access - "may this role open this path?"
// =============================================================================
// This answers ONE question, asked in one place: when Login is about to send a
// freshly signed-in user back to the page they were originally bounced from,
// is that page actually open to the role that just signed in?
//
// WHY IT IS NEEDED: ProtectedRoute parks the intended path in `location.state`
// while the visitor is ANONYMOUS - at that moment nobody knows which role will
// sign in next, and the same browser is routinely used to test an admin and an
// employee back to back. Blindly honouring that saved path meant an EMPLOYEE
// signing in after an ADMIN session was thrown straight at /users, which the
// guard then refused: a dead end instead of a dashboard.
//
// ⚠ KEEP IN SYNC WITH App.jsx. The route guards there are the real rule, and
// this is a second copy of them used for CLIENT-SIDE NAVIGATION ONLY. A wrong
// answer here can at worst route somebody to the wrong landing page - the
// backend still authorises every API call, and ProtectedRoute still refuses
// the page itself.
//
//   ADMIN    everything
//   HR       dashboard, employees (read), leave, attendance, payroll (read)
//   EMPLOYEE dashboard, own profile, own leave/attendance/payroll + leave form

/** Where a signed-in user lands when the page they asked for is off-limits. */
export const HOME = '/dashboard'

const ROLES = { ADMIN: 'ADMIN', HR: 'HR', EMPLOYEE: 'EMPLOYEE' }

/**
 * May `role` open `pathname`?
 *
 * Unknown paths answer `true` on purpose: everything unmatched renders the
 * in-shell 404 page, which every signed-in role is allowed to see.
 */
export function canAccess(pathname, role) {
  if (!role) return false

  const segments = String(pathname).split('/').filter(Boolean)
  const [section, second, third] = segments

  // Write routes are /<section>/new and /<section>/<id>/edit; the read routes
  // (list and detail) are everything else under the same section.
  const isForm = second === 'new' || (segments.length === 3 && third === 'edit')

  switch (section) {
    // "/" redirects to /dashboard.
    case undefined:
      return true

    // Shared routes: the backend scopes the lists to the caller's own rows for
    // an EMPLOYEE token, so every role reads them - but writes differ.
    case 'leaves':
    case 'attendance':
    case 'payrolls':
    case 'dashboard':
      if (!isForm) return true
      // Filing leave is self-service; attendance and payroll are data-entry
      // that only ADMIN performs.
      if (section === 'leaves') return role === ROLES.ADMIN || role === ROLES.EMPLOYEE
      return role === ROLES.ADMIN

    // Employee master data: HR reads the directory, only ADMIN writes it.
    case 'employees':
      return isForm ? role === ROLES.ADMIN : role === ROLES.ADMIN || role === ROLES.HR

    // Self-service profile, resolved from the JWT's employeeId claim.
    case 'me':
      return role === ROLES.EMPLOYEE

    // Account management - the ADMIN toolbox.
    case 'users':
      return role === ROLES.ADMIN

    default:
      return true
  }
}

/**
 * The path to navigate to: the requested one when the role may open it,
 * otherwise the landing page. Use this instead of navigating to a remembered
 * path directly.
 */
export function destinationFor(pathname, role) {
  return canAccess(pathname, role) ? pathname : HOME
}
