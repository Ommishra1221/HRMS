import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CalendarPlus, Eye, Pencil, Search, Trash2 } from 'lucide-react'

import useLeaves from '../hooks/useLeaves'
import { deleteLeave } from '../api/leaveApi'
import { useAuth } from '../context/AuthContext'
import { EmptyState, ErrorAlert, Loading } from '../components/common/Loading'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/Toast'
import { formatDate, initials } from '../utils/format'

// =============================================================================
// LeaveList = GET /api/leaves rendered as a filterable table.
// =============================================================================
// Each row's "employee" column comes from the NESTED object the backend
// composed via Feign (leave_db row + live HTTP call to employee-service).
// The frontend does nothing special - it just reads leave.employee?.name.
//
// NEW: a status filter and a name search. The filter is a segmented control
// rather than a dropdown because there are only four options and every one of
// them is worth seeing at a glance - a select box would hide the choices.

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
]

export default function LeaveList() {
  const { leaves, loading, error, refresh } = useLeaves()
  const confirm = useConfirm()
  const toast = useToast()

  // ROLE SHAPING (backend is the real boundary):
  //   ADMIN    -> full CRUD on any request
  //   HR       -> read-only (cannot create on behalf of others, cannot modify)
  //   EMPLOYEE -> apply, and edit/delete ONLY their own PENDING requests
  // For an EMPLOYEE token the backend already scopes this list to own rows,
  // so status !== 'PENDING' is the only extra guard the UI needs.
  const { isAdmin, isEmployee } = useAuth()
  const canEditRow = (leave) => isAdmin || (isEmployee && leave.status === 'PENDING')

  const [status, setStatus] = useState('ALL')
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const counts = useMemo(() => {
    const base = { ALL: leaves.length, PENDING: 0, APPROVED: 0, REJECTED: 0 }
    leaves.forEach((l) => {
      if (base[l.status] != null) base[l.status] += 1
    })
    return base
  }, [leaves])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leaves
      .filter((l) => status === 'ALL' || l.status === status)
      .filter((l) => {
        if (!q) return true
        const name = l.employee?.name || ''
        return [name, l.leaveType, l.reason].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      })
      .sort((a, b) => b.id - a.id) // newest first
  }, [leaves, status, query])

  async function handleDelete(leave) {
    const who = leave.employee?.name ? `${leave.employee.name}'s` : 'this'
    const ok = await confirm({
      title: 'Delete leave request?',
      message: `${who} leave request (${formatDate(leave.fromDate)} → ${formatDate(leave.toDate)}) will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete request',
      tone: 'danger',
    })
    if (!ok) return

    setDeletingId(leave.id)
    try {
      await deleteLeave(leave.id)
      await refresh()
      toast.success('Leave request deleted')
    } catch (err) {
      toast.error('Could not delete request', err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page">
      <PageHeader
        icon={CalendarDays}
        title="Leave"
        subtitle="Requests stored in leave_db, with employee details composed live from employee-service."
        actions={
          isAdmin || isEmployee ? (
            <Button as={Link} to="/leaves/new" variant="primary" icon={CalendarPlus}>
              Apply for leave
            </Button>
          ) : undefined
        }
      />

      {loading ? <Loading /> : null}

      {!loading && error ? (
        <ErrorAlert title="Could not load leave requests" message={error} onRetry={refresh} />
      ) : null}

      {!loading && !error && leaves.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave requests yet"
          message="Once someone applies for leave it will appear here, ready to review."
        >
          {isAdmin || isEmployee ? (
            <Button as={Link} to="/leaves/new" variant="primary" icon={CalendarPlus}>
              Apply for leave
            </Button>
          ) : null}
        </EmptyState>
      ) : null}

      {!loading && !error && leaves.length > 0 ? (
        <Card>
          <CardHeader
            title="All requests"
            subtitle={`${filtered.length} of ${leaves.length} shown`}
            actions={
              <div className="input-icon">
                <Search size={16} aria-hidden="true" />
                <label className="sr-only" htmlFor="leave-search">
                  Search leave requests
                </label>
                <input
                  id="leave-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employee, type, reason…"
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

          {/* Status filter. aria-pressed tells assistive tech which one is on. */}
          <div style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--color-border)' }}>
            <div className="segmented" role="group" aria-label="Filter by status">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="segmented__item"
                  aria-pressed={status === f.key}
                  onClick={() => setStatus(f.key)}
                >
                  {f.label} ({counts[f.key] ?? 0})
                </button>
              ))}
            </div>
          </div>

          <CardBody flush>
            {filtered.length === 0 ? (
              <div style={{ padding: 'var(--space-6)' }}>
                <EmptyState
                  icon={Search}
                  title="No matching requests"
                  message="Nothing matches the current filter and search. Try widening them."
                >
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStatus('ALL')
                      setQuery('')
                    }}
                  >
                    Clear filters
                  </Button>
                </EmptyState>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table--stack">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((leave) => (
                      <tr key={leave.id}>
                        <td data-label="">
                          <div className="row">
                            {/* Optional chaining: employee can be null in rare
                                edge cases (e.g. the employee was deleted in the
                                other service while this list was loading). */}
                            <span className="avatar" aria-hidden="true">
                              {initials(leave.employee?.name || `ID ${leave.employeeId}`)}
                            </span>
                            <div className="grow">
                              <Link to={`/leaves/${leave.id}`} className="cell-primary">
                                {leave.employee ? leave.employee.name : `Unknown (id ${leave.employeeId})`}
                              </Link>
                              <span className="cell-sub">
                                {leave.employee ? leave.employee.department : 'employee lookup failed'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Type">
                          <span className="chip">{leave.leaveType}</span>
                        </td>
                        <td data-label="Dates" className="nowrap">
                          {formatDate(leave.fromDate)} → {formatDate(leave.toDate)}
                        </td>
                        <td data-label="Status">
                          <Badge status={leave.status} />
                        </td>
                        <td data-label="Actions">
                          <div className="cell-actions">
                            <Button
                              as={Link}
                              to={`/leaves/${leave.id}`}
                              variant="ghost"
                              size="sm"
                              iconOnly
                              icon={Eye}
                              title="View details"
                              aria-label={`View leave request ${leave.id}`}
                            />
                            {canEditRow(leave) ? (
                              <>
                                <Button
                                  as={Link}
                                  to={`/leaves/${leave.id}/edit`}
                                  variant="ghost"
                                  size="sm"
                                  iconOnly
                                  icon={Pencil}
                                  title="Edit"
                                  aria-label={`Edit leave request ${leave.id}`}
                                />
                                <Button
                                  variant="danger-ghost"
                                  size="sm"
                                  iconOnly
                                  icon={Trash2}
                                  loading={deletingId === leave.id}
                                  onClick={() => handleDelete(leave)}
                                  title="Delete"
                                  aria-label={`Delete leave request ${leave.id}`}
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
