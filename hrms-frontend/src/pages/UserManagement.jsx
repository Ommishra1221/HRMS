import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  KeyRound,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCog,
  UserPlus,
  UsersRound,
} from 'lucide-react'

import {
  changeUserRole,
  createUser,
  listUsers,
  setUserEnabled,
  updateUser,
} from '../api/userApi'
import { EmptyState, ErrorAlert, Loading } from '../components/common/Loading'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Field from '../components/common/Field'
import Modal from '../components/common/Modal'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/Toast'
import { useAuth } from '../context/AuthContext'
import { initials } from '../utils/format'

// =============================================================================
// UserManagement - the ADMIN account toolbox over /auth/users/**.
// =============================================================================
// With public signup gone, this page is where every account comes from.
// Every call here is ADMIN-only on the backend (URL rule + @PreAuthorize) -
// the page itself is only reachable by ADMIN via ProtectedRoute, and even if
// someone from another role deep-linked here, the backend would 403 each call.
//
// What each account shows: identity, role chip, enabled state and, when the
// account is linked to a directory record, which employee it belongs to.
//
// Password reset is intentionally simple (prompt + updateUser with only the
// password field set). The API never echoes a password back - it is stored
// as a BCrypt hash - so nothing sensitive can appear in the UI.

const ROLES = ['ADMIN', 'HR', 'EMPLOYEE']

const EMPTY_FORM = {
  username: '',
  email: '',
  fullName: '',
  password: '',
  role: 'EMPLOYEE',
  employeeId: '',
}

/**
 * UserResponse.roles arrives as ["ROLE_ADMIN"] - one entry, prefixed.
 * Reduce it to the plain "ADMIN" the rest of the UI speaks, exactly the way
 * AuthContext strips the prefix for the signed-in user.
 */
function roleOf(user) {
  return String(user?.roles?.[0] || '').replace(/^ROLE_/, '')
}

export default function UserManagement() {
  const { user: me, refreshUser } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  // Create-account modal state
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Role-editor modal state
  const [editingRole, setEditingRole] = useState(null) // the account being edited
  const [roleValue, setRoleValue] = useState('EMPLOYEE')
  const [savingRole, setSavingRole] = useState(false)

  // Enable/disable in-flight marker
  const [busyId, setBusyId] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listUsers()
      setUsers(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      [u.username, u.email, u.fullName, roleOf(u), String(u.employeeId ?? '')]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [users, query])

  function validate() {
    const errs = {}
    if (!form.username.trim()) errs.username = 'Username is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    if (!form.password) {
      errs.password = 'Password is required'
    } else if (form.password.length < 6) {
      errs.password = 'At least 6 characters'
    }
    return errs
  }

  async function handleCreate(e) {
    e.preventDefault()
    const errs = validate()
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      await createUser({
        username: form.username.trim(),
        email: form.email.trim(),
        fullName: form.fullName.trim() || undefined,
        password: form.password,
        role: form.role,
        employeeId: form.employeeId ? Number(form.employeeId) : undefined,
      })
      toast.success('Account created', `${form.username} can now sign in as ${form.role}.`)
      setShowCreate(false)
      setForm(EMPTY_FORM)
      setFormErrors({})
      await fetchUsers()
    } catch (err) {
      // 409 duplicate username/email/employeeId, 400 unknown role, etc.
      setFormErrors({ form: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleRoleSave() {
    setSavingRole(true)
    try {
      await changeUserRole(editingRole.id, roleValue)
      toast.success('Role updated', `${editingRole.username} is now ${roleValue}.`)
      setEditingRole(null)
      // If I just changed my own role, the cached profile is stale.
      if (editingRole.id === me?.id) await refreshUser()
      await fetchUsers()
    } catch (err) {
      // 403 last-admin guard, 400 unknown role, 403 self-demotion guard...
      toast.error('Could not change role', err.message)
    } finally {
      setSavingRole(false)
    }
  }

  async function handleToggleEnabled(u) {
    const disabling = u.enabled
    const ok = await confirm({
      title: disabling ? 'Disable this account?' : 'Enable this account?',
      message: disabling
        ? `${u.username} will no longer be able to sign in. Their employee data is untouched.`
        : `${u.username} will be able to sign in again.`,
      confirmLabel: disabling ? 'Disable' : 'Enable',
      tone: disabling ? 'danger' : 'default',
    })
    if (!ok) return

    setBusyId(u.id)
    try {
      await setUserEnabled(u.id, !disabling)
      toast.success(disabling ? 'Account disabled' : 'Account enabled')
      await fetchUsers()
    } catch (err) {
      // 403: disabling yourself or the last enabled admin
      toast.error('Could not update account', err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleResetPassword(u) {
    const next = window.prompt(`New password for ${u.username}:`)
    if (!next) return
    try {
      await updateUser(u.id, { password: next })
      toast.success('Password reset', `${u.username} can sign in with the new password.`)
    } catch (err) {
      toast.error('Could not reset password', err.message)
    }
  }

  return (
    <div className="page">
      <PageHeader
        icon={UsersRound}
        title="Users"
        subtitle="Application accounts live in auth_schema; only ADMIN sees this page."
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setShowCreate(true)}>
            Add account
          </Button>
        }
      />

      {loading ? <Loading /> : null}

      {!loading && error ? (
        <ErrorAlert title="Could not load accounts" message={error} onRetry={fetchUsers} />
      ) : null}

      {!loading && !error && users.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No accounts yet"
          message="Create the first account - an ADMIN creates every HR and EMPLOYEE login."
        >
          <Button variant="primary" icon={UserPlus} onClick={() => setShowCreate(true)}>
            Add account
          </Button>
        </EmptyState>
      ) : null}

      {!loading && !error && users.length > 0 ? (
        <Card>
          <CardHeader
            title="All accounts"
            subtitle={`${filtered.length} of ${users.length} shown`}
            actions={
              <div className="input-icon">
                <Search size={16} aria-hidden="true" />
                <label className="sr-only" htmlFor="user-search">
                  Search accounts
                </label>
                <input
                  id="user-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search username, email, role…"
                  style={{
                    minHeight: 36,
                    padding: '8px 12px 8px 36px',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    font: 'inherit',
                    background: 'var(--color-card)',
                    color: 'var(--color-fg)',
                  }}
                />
              </div>
            }
          />
          <CardBody flush>
            {filtered.length === 0 ? (
              <div style={{ padding: 'var(--space-6)' }}>
                <EmptyState
                  icon={Search}
                  title="No matches"
                  message={`No account matches "${query}".`}
                >
                  <Button variant="secondary" onClick={() => setQuery('')}>
                    Clear search
                  </Button>
                </EmptyState>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table--stack">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Role</th>
                      <th>Linked employee</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => {
                      const role = roleOf(u)
                      const disabled = u.enabled === false
                      return (
                        <tr key={u.id} style={disabled ? { opacity: 0.55 } : undefined}>
                          <td data-label="">
                            <div className="row">
                              <span className="avatar" aria-hidden="true">
                                {initials(u.fullName || u.username)}
                              </span>
                              <div className="grow">
                                <span className="cell-primary">{u.fullName || u.username}</span>
                                <span className="cell-sub">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          {/* Roles are identities, not statuses - a chip, not a
                              status badge. The closed set is backend-enforced. */}
                          <td data-label="Role">
                            <span className="chip">{role || '—'}</span>
                          </td>
                          <td data-label="Linked employee">
                            {u.employeeId ? (
                              <Link to={`/employees/${u.employeeId}`} className="cell-primary">
                                ID {u.employeeId}
                              </Link>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td data-label="Status">
                            <span className="chip">{disabled ? 'Disabled' : 'Enabled'}</span>
                          </td>
                          <td data-label="Actions">
                            <div className="cell-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                iconOnly
                                icon={UserCog}
                                title="Change role"
                                aria-label={`Change role for ${u.username}`}
                                onClick={() => {
                                  setEditingRole(u)
                                  setRoleValue(role || 'EMPLOYEE')
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                iconOnly
                                icon={disabled ? ShieldCheck : ShieldOff}
                                title={disabled ? 'Enable' : 'Disable'}
                                aria-label={disabled ? `Enable ${u.username}` : `Disable ${u.username}`}
                                loading={busyId === u.id}
                                onClick={() => handleToggleEnabled(u)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                iconOnly
                                icon={KeyRound}
                                title="Reset password"
                                aria-label={`Reset password for ${u.username}`}
                                onClick={() => handleResetPassword(u)}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      {/* ---- Create-account modal ---- */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add account"
        icon={UserPlus}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} type="submit" form="user-create-form">
              Create account
            </Button>
          </>
        }
      >
        <form id="user-create-form" onSubmit={handleCreate} noValidate>
          <div className="form-grid">
            <Field label="Username" htmlFor="u-username" error={formErrors.username} required>
              <input
                id="u-username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </Field>
            <Field label="Full name" htmlFor="u-fullName">
              <input
                id="u-fullName"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </Field>
            <Field label="Email" htmlFor="u-email" error={formErrors.email} required>
              <input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field
              label="Password"
              htmlFor="u-password"
              error={formErrors.password}
              required
              hint="Stored as a BCrypt hash; the API never echoes it back."
            >
              <input
                id="u-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="Role" htmlFor="u-role" required>
              <select
                id="u-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Linked employee ID"
              htmlFor="u-employeeId"
              hint="Optional. Links this login to the employee directory (required for EMPLOYEE self-service)."
            >
              <input
                id="u-employeeId"
                type="number"
                min="1"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              />
            </Field>
            {formErrors.form ? (
              <p className="field-error" role="alert" style={{ gridColumn: '1 / -1' }}>
                {formErrors.form}
              </p>
            ) : null}
          </div>
        </form>
      </Modal>

      {/* ---- Role editor modal ---- */}
      <Modal
        open={Boolean(editingRole)}
        onClose={() => setEditingRole(null)}
        title={editingRole ? `Change role · ${editingRole.username}` : 'Change role'}
        icon={UserCog}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingRole(null)} disabled={savingRole}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRoleSave} loading={savingRole}>
              Save role
            </Button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>
          An account holds exactly one role. This is the only place a role can change - users cannot elevate
          themselves, and the backend refuses the last enabled admin's demotion with 403.
        </p>
        <Field label="Role" htmlFor="role-select" required>
          <select id="role-select" value={roleValue} onChange={(e) => setRoleValue(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </Modal>
    </div>
  )
}
