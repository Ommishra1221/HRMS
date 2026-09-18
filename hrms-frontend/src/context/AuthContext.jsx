import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getMe, login as loginApi } from '../api/authApi'

// AuthContext = the app's memory of "who is logged in?".
//
// THE JWT LIFECYCLE, end to end:
// 1. login() POSTs to auth-service through the gateway (the ONLY public call).
// 2. The response carries { token, id, username, roles, employeeId, ... }.
// 3. We save the token in localStorage (survives a page refresh) and the user
//    object in React state (drives the UI instantly).
// 4. axiosInstance's request interceptor attaches the token to EVERY api call.
// 5. logout() wipes both -> ProtectedRoute sends the user to /login.
//
// WHAT CHANGED WITH THE THREE-ROLE MODEL:
//   - register() is GONE. There is no public signup; an ADMIN creates accounts.
//   - the user now carries employeeId (null for admin/HR accounts), and
//     exactly ONE role out of ADMIN / HR / EMPLOYEE.
//   - on startup we call GET /auth/me to re-check the stored token. The local
//     profile is only a cache; the server is the source of truth.
//
// AuthResponse.roles arrives as ["ROLE_ADMIN"] - we strip the prefix once here
// so the rest of the app compares plain "ADMIN" / "HR" / "EMPLOYEE".

const AuthContext = createContext(null)

const TOKEN_KEY = 'hrms_token'
const USER_KEY = 'hrms_user'

/** The three roles that exist in this system. Nothing else is valid. */
export const ROLES = { ADMIN: 'ADMIN', HR: 'HR', EMPLOYEE: 'EMPLOYEE' }

function stripRolePrefix(roles) {
  return (roles || []).map((r) => String(r).replace(/^ROLE_/, ''))
}

/** Server payload -> the shape this app stores and reads. */
function toUser(res) {
  return {
    id: res.id,
    username: res.username,
    email: res.email,
    fullName: res.fullName,
    roles: stripRolePrefix(res.roles),
    employeeId: res.employeeId ?? null,
  }
}

export function AuthProvider({ children }) {
  // Initialize FROM localStorage: a refresh (F5) keeps you logged in, and the
  // first render is not "logged out" for a moment (no redirect flicker).
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const persist = (token, nextUser) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setUser(nextUser)
  }

  const login = useCallback(async (credentials) => {
    const res = await loginApi(credentials)
    const nextUser = toUser(res)
    persist(res.token, nextUser)
    return nextUser
  }, [])

  const logout = useCallback(() => {
    // JWTs cannot be "un-issued" (stateless!) - we just forget it. The token
    // dies on its own when its exp claim passes (24h in auth-service).
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  /**
   * Re-read the current user from auth-service (GET /auth/me) and refresh the
   * cached profile. Use this after anything that may have changed the account
   * server-side (e.g. an admin renamed you or changed your role).
   */
  const refreshUser = useCallback(async () => {
    const res = await getMe()
    const nextUser = toUser(res)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setUser(nextUser)
    return nextUser
  }, [])

  // ---- Startup check ----
  // The cached profile can be stale (an admin may have disabled or demoted the
  // account, or the token may simply have expired). So once per mount we ask
  // the server. If the call fails we KEEP the cached user rather than logging
  // out: a 401 is already handled globally by the axios interceptor (token
  // wiped + redirect to /login), while a network error just means the gateway
  // is down and should not throw the user out of the UI.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      // No token but leftover profile data -> treat as logged out.
      localStorage.removeItem(USER_KEY)
      setUser(null)
      return
    }
    refreshUser().catch(() => {})
  }, [refreshUser])

  const value = useMemo(() => {
    const roles = user?.roles || []
    return {
      user,
      token: localStorage.getItem(TOKEN_KEY),
      isAuthenticated: Boolean(user && localStorage.getItem(TOKEN_KEY)),
      // An account holds exactly one of these; the helpers stay booleans so
      // components read naturally: `if (isAdmin) ...`
      isAdmin: roles.includes(ROLES.ADMIN),
      isHr: roles.includes(ROLES.HR),
      isEmployee: roles.includes(ROLES.EMPLOYEE),
      roles,
      employeeId: user?.employeeId ?? null,
      /** hasRole('ADMIN') / hasRole('HR', 'EMPLOYEE') */
      hasRole: (...wanted) => wanted.some((r) => roles.includes(r)),
      login,
      logout,
      refreshUser,
    }
  }, [user, login, logout, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// useAuth() = how any component asks "who is logged in?" / "am I admin?"
// e.g.  const { user, isAdmin, logout } = useAuth()
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
