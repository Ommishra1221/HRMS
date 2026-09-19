import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { ROLES, useAuth } from '../context/AuthContext'
import { HOME } from '../config/access'
import Button from './common/Button'
import { EmptyState } from './common/Loading'

// ProtectedRoute = the client-side gatekeeper, now ROLE-AWARE.
//
// IMPORTANT: this is UX, NOT real security. The JWT itself cannot be faked
// in the browser, but localStorage CAN be edited by a curious user - so the
// REAL gate is always the backend (each service's SecurityConfig + the
// ownership checks in its ServiceImpl). If you call an API without a valid
// token you get 401 and axios bounces you to /login anyway; call an
// ADMIN-only API as an EMPLOYEE and you get 403.
//
// What this component actually buys:
// 1. Anonymous visitors never see an app shell that would immediately error.
// 2. A deep link to a page the role cannot use lands on a friendly "no
//    permission" card - WITH a way back to the dashboard, so being refused is
//    never a dead end (a bookmark or hand-typed /users as an employee is the
//    usual cause, not a bug).
// 3. The intended destination is remembered so Login can return the user.
//
// USAGE
//   <ProtectedRoute><AppLayout /></ProtectedRoute>           -> any logged-in role
//   <ProtectedRoute adminOnly><UsersPage /></ProtectedRoute> -> ADMIN only
//   <ProtectedRoute roles={['ADMIN', 'HR']} />               -> layout route:
//     with NO children it renders <Outlet />, guarding the nested <Route>s
//     declared inside it (see App.jsx).

export default function ProtectedRoute({ children, adminOnly = false, roles = null }) {
  const { isAuthenticated, isAdmin, hasRole } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // `state.from` lets Login send the user back here after signing in.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // adminOnly is the common case; `roles` covers "ADMIN or HR" style rules.
  const allowed = roles ? hasRole(...roles) : !adminOnly || isAdmin

  if (!allowed) {
    // 403 territory: already logged in, just not permitted. We say WHICH access
    // is required but never read the role out of the token for the user - the
    // server decides, the UI only explains.
    const required = roles ? roles.join(' or ') : ROLES.ADMIN
    return (
      <div className="page">
        <EmptyState
          icon={ShieldAlert}
          title={`${required} access required`}
          message="Your account does not have permission to view this page. Ask an administrator if you think this is a mistake."
        >
          {/* The escape hatch. Without it the only way off this card was the
              sidebar, which is exactly what a deep link skips past. */}
          <Button as={Link} to={HOME} variant="secondary" icon={ArrowLeft}>
            Back to dashboard
          </Button>
        </EmptyState>
      </div>
    )
  }

  // Layout-route form (<ProtectedRoute roles={...} /> wrapping nested routes):
  // there are no children, so render the matched child route instead.
  // eslint-disable-next-line react/jsx-no-useless-fragment
  return children ?? <Outlet />
}
