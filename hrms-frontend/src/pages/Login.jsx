import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Banknote, CalendarDays, Clock, Info, LogIn, Users } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import Button from '../components/common/Button'
import Field from '../components/common/Field'
import PasswordInput, { useAutofocus } from '../components/common/PasswordInput'
import { useToast } from '../components/common/Toast'

// =============================================================================
// Login - the front door of the HRMS.
// =============================================================================
// FLOW: submit -> AuthContext.login() -> POST /api/auth/login (gateway) ->
// auth-service checks the BCrypt hash -> JWT comes back -> stored in
// localStorage -> we navigate to where the user was heading (or dashboard).
//
// All three roles (ADMIN, HR, EMPLOYEE) sign in through THIS page - the only
// public endpoint in the system. There is no registration link: an ADMIN
// creates accounts.
//
// The page is split: a brand panel on the left that says what the product
// does, and the form on the right. Below 900px the panel is dropped and a
// compact brand lockup appears above the form instead.

// What the product covers - shown on the panel so the login screen explains
// the app rather than being a bare box.
const CAPABILITIES = [
  { icon: Users, label: 'Employee directory' },
  { icon: CalendarDays, label: 'Leave requests' },
  { icon: Clock, label: 'Attendance tracking' },
  { icon: Banknote, label: 'Payroll & payslips' },
]

export default function Login() {
  const { login, isAuthenticated, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const usernameRef = useAutofocus()

  // ProtectedRoute parks the intended page here before bouncing to /login,
  // so after logging in we can send the user RIGHT back where they were.
  const from = location.state?.from || '/dashboard'

  // An already-signed-in user landing on /login (bookmark, back button) goes
  // straight back to their dashboard - the login form has no job to do.
  useEffect(() => {
    if (isAuthenticated) {
      navigate(isAdmin ? '/dashboard' : from, { replace: true })
    }
  }, [isAuthenticated, isAdmin, from, navigate])

  const [values, setValues] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  function handleChange(e) {
    const { name, value } = e.target
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => (prev[name] ? { ...prev, [name]: null } : prev))
  }

  function validate() {
    const errs = {}
    if (!values.username.trim()) errs.username = 'username is required'
    if (!values.password) errs.password = 'password is required'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const firstInvalid = ['username', 'password'].find((k) => errs[k])
      if (firstInvalid) document.getElementById(firstInvalid)?.focus()
      return
    }

    setSubmitting(true)
    setServerError(null)
    try {
      const user = await login({ username: values.username.trim(), password: values.password })
      toast.success('Signed in', `Welcome back, ${user.fullName || user.username}.`)
      navigate(from, { replace: true })
    } catch (err) {
      // Backend message: "Invalid username or password" (401) - shown as-is.
      // Deliberately vague on purpose: naming which half was wrong would let
      // anyone enumerate valid usernames.
      setServerError(err.message)
      document.getElementById('password')?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      {/* ---- Brand panel (decorative; hidden below 900px) ---- */}
      <aside className="auth-aside">
        <span className="auth-aside__glow" aria-hidden="true" />
        <span className="auth-aside__glow auth-aside__glow--2" aria-hidden="true" />

        <div className="auth-brand">
          <span className="auth-brand__mark" aria-hidden="true">
            HR
          </span>
          <span>
            <span className="auth-brand__name">HRMS</span>
            <span className="auth-brand__sub">Human Resource Management</span>
          </span>
        </div>

        <div className="auth-pitch">
          <h2>Everything your people team needs, in one place.</h2>
          <p>
            Employees, leave, attendance and payroll across four independent services, behind a single sign-on.
          </p>

          <div className="auth-points">
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <div className="auth-point" key={label}>
                <span className="auth-point__icon">
                  <Icon size={15} aria-hidden="true" />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>

        <p className="auth-aside__foot">Secured with BCrypt password hashing and JWT session tokens.</p>
      </aside>

      {/* ---- Form ---- */}
      <main className="auth-main">
        <div className="auth-card">
          {/* Shown only when the aside panel is hidden. */}
          <div className="auth-mobile-brand">
            <span className="auth-brand__mark" aria-hidden="true" style={{ background: 'var(--color-primary)' }}>
              HR
            </span>
            <span>
              <span className="auth-brand__name" style={{ color: 'var(--color-fg)' }}>
                HRMS
              </span>
              <span className="auth-brand__sub" style={{ color: 'var(--color-fg-subtle)' }}>
                Human Resource Management
              </span>
            </span>
          </div>

          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to continue to your workspace.</p>

          {serverError ? (
            <div className="alert alert--error" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
              <AlertTriangle size={17} aria-hidden="true" />
              <div className="alert__body">
                <p className="alert__title">Sign-in failed</p>
                {serverError}
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} noValidate>
            <Field label="Username" htmlFor="username" error={errors.username} required>
              <input
                id="username"
                name="username"
                type="text"
                ref={usernameRef}
                value={values.username}
                onChange={handleChange}
                placeholder="admin"
                autoComplete="username"
              />
            </Field>

            <Field label="Password" htmlFor="password" error={errors.password} required>
              <PasswordInput
                id="password"
                name="password"
                value={values.password}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>

            <Button type="submit" variant="primary" icon={LogIn} loading={submitting} block size="lg">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {/* There is no "Create one" link any more: public signup was removed,
              so an administrator creates accounts. Rather than a dead button,
              the page states where accounts come from. */}
          <p className="auth-note">
            Accounts are created by an administrator. Ask yours if you cannot sign in.
          </p>

          {/* Demo credentials. Role="note" so it is announced as a hint. */}
          <p className="auth-hint" role="note">
            <Info size={14} aria-hidden="true" />
            Demo logins: <strong>admin</strong> / <strong>Admin@123</strong> &middot; <strong>hr</strong> /{' '}
            <strong>Hr@123</strong> &middot; <strong>emp01</strong> / <strong>Emp01@123</strong>
          </p>
        </div>

        {/* Small muted credit. Doubles as the page footer on mobile, where the
            brand panel is hidden and the card loses its border/background. */}
        <p className="auth-credit">&copy; 2026 HRMS &middot; Developed by Om Kumar Mishra</p>
      </main>
    </div>
  )
}
