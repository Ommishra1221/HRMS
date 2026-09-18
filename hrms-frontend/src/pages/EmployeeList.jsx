import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react'

import useEmployees from '../hooks/useEmployees'
import { deleteEmployee } from '../api/employeeApi'
import { useAuth } from '../context/AuthContext'
import { EmptyState, ErrorAlert, Loading } from '../components/common/Loading'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/Toast'
import { initials } from '../utils/format'

// =============================================================================
// EmployeeList - the directory.
// =============================================================================
// Data flow when this page opens (unchanged from the original):
//   EmployeeList renders -> useEmployees fires
//   -> employeeApi.getEmployees() -> axiosInstance (Bearer token attached)
//   -> GET http://localhost:8080/api/employees      (API Gateway)
//   -> strip /api -> GET http://localhost:8081/employees
//   -> EmployeeController -> EmployeeServiceImpl -> employee_db
//   -> JSON array flows back up the same chain -> setEmployees -> re-render
//
// NEW in the redesign (presentation only - the calls are identical):
//   - client-side search, so a long directory is actually usable
//   - icon actions with labels for assistive tech
//   - deletes confirmed in a branded dialog and reported with a toast,
//     instead of window.confirm + alert
//   - the table becomes stacked cards under 860px

export default function EmployeeList() {
  const { employees, loading, error, refresh } = useEmployees()
  const confirm = useConfirm()
  const toast = useToast()

  // ROLE SHAPING: ADMIN owns employee master data (create/edit/delete).
  // HR is read-only here - the backend 403s any HR write, so the buttons are
  // simply not offered. UX only; the backend remains the boundary.
  const { isAdmin } = useAuth()

  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  // Filtering in the browser keeps this instant and avoids re-hitting the
  // gateway on every keystroke. useMemo so it only recomputes when the data
  // or the query actually changes.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) =>
      [e.name, e.email, e.department].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)),
    )
  }, [employees, query])

  async function handleDelete(employee) {
    const ok = await confirm({
      title: 'Delete this employee?',
      message: `"${employee.name}" will be permanently removed from the directory. Leave, attendance and payroll records that reference them will no longer be able to look up their details. This cannot be undone.`,
      confirmLabel: 'Delete employee',
      tone: 'danger',
    })
    if (!ok) return

    setDeletingId(employee.id)
    try {
      await deleteEmployee(employee.id)
      await refresh() // re-fetch so the table reflects the database
      toast.success('Employee deleted', `${employee.name} has been removed.`)
    } catch (err) {
      // e.g. 404 "Employee not found with id: 99"
      toast.error('Could not delete employee', err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page">
      <PageHeader
        icon={Users}
        title="Employees"
        subtitle="The central directory. Leave, attendance and payroll all look employees up here by id."
        actions={
          isAdmin ? (
            <Button as={Link} to="/employees/new" variant="primary" icon={UserPlus}>
              Add employee
            </Button>
          ) : undefined
        }
      />

      {loading ? <Loading /> : null}

      {!loading && error ? (
        <ErrorAlert title="Could not load employees" message={error} onRetry={refresh} />
      ) : null}

      {!loading && !error && employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          message="Add your first employee to get started - leave, attendance and payroll all depend on this directory."
        >
          {isAdmin ? (
            <Button as={Link} to="/employees/new" variant="primary" icon={UserPlus}>
              Add employee
            </Button>
          ) : null}
        </EmptyState>
      ) : null}

      {!loading && !error && employees.length > 0 ? (
        <Card>
          <CardHeader
            title="All employees"
            subtitle={`${employees.length} ${employees.length === 1 ? 'record' : 'records'}${
              query ? ` · ${filtered.length} matching` : ''
            }`}
            actions={
              <div className="input-icon">
                {/* The label is visually hidden: the magnifier plus placeholder
                    are enough here, but screen readers still get a real name. */}
                <Search size={16} aria-hidden="true" />
                <label className="sr-only" htmlFor="employee-search">
                  Search employees
                </label>
                <input
                  id="employee-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, department…"
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
                  message={`No employee matches "${query}". Try a different name, email or department.`}
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
                      <th>Employee</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp) => (
                      <tr key={emp.id}>
                        <td data-label="">
                          <div className="row">
                            <span className="avatar" aria-hidden="true">
                              {initials(emp.name)}
                            </span>
                            <div className="grow">
                              <Link to={`/employees/${emp.id}`} className="cell-primary">
                                {emp.name}
                              </Link>
                              <span className="cell-sub mono">ID {emp.id}</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Email">
                          <a href={`mailto:${emp.email}`}>{emp.email}</a>
                        </td>
                        <td data-label="Department">
                          <span className="chip">{emp.department}</span>
                        </td>
                        <td data-label="Actions">
                          <div className="cell-actions">
                            <Button
                              as={Link}
                              to={`/employees/${emp.id}`}
                              variant="ghost"
                              size="sm"
                              iconOnly
                              icon={Eye}
                              title="View details"
                              aria-label={`View ${emp.name}`}
                            />
                            {/* Write actions exist only for ADMIN; HR gets view-only. */}
                            {isAdmin ? (
                              <>
                                <Button
                                  as={Link}
                                  to={`/employees/${emp.id}/edit`}
                                  variant="ghost"
                                  size="sm"
                                  iconOnly
                                  icon={Pencil}
                                  title="Edit"
                                  aria-label={`Edit ${emp.name}`}
                                />
                                <Button
                                  variant="danger-ghost"
                                  size="sm"
                                  iconOnly
                                  icon={Trash2}
                                  loading={deletingId === emp.id}
                                  onClick={() => handleDelete(emp)}
                                  title="Delete"
                                  aria-label={`Delete ${emp.name}`}
                                />
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
