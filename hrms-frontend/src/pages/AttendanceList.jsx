import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, ClockPlus, Eye, Pencil, Search, Trash2 } from 'lucide-react'

import useAttendance from '../hooks/useAttendance'
import { deleteAttendance, markCheckOut } from '../api/attendanceApi'
import { useAuth } from '../context/AuthContext'
import { EmptyState, ErrorAlert, Loading } from '../components/common/Loading'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/Toast'
import { formatDate, initials, todayISO } from '../utils/format'

// =============================================================================
// AttendanceList = GET /api/attendance rendered as a filterable table.
// =============================================================================
// Each row's "employee" column comes from the NESTED object the backend
// composed via Feign (attendance_db row + live HTTP call to employee-service).
//
// Extra microservice moment: "Check out" calls PATCH /api/attendance/{id}/checkout
// - a partial update, not a full PUT. The backend validates the times.
//
// NEW: a "Today" shortcut filter. On a day-to-day basis the only rows anyone
// looks at are today's, so they now cost one click instead of a scroll.

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'TODAY', label: 'Today' },
  { key: 'PRESENT', label: 'Present' },
  { key: 'WFH', label: 'WFH' },
  { key: 'ABSENT', label: 'Absent' },
]

/** "HH:mm" (or "HH:mm:ss") -> minutes since midnight, for duration maths. */
function toMinutes(time) {
  if (!time) return null
  const [h, m] = String(time).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

/** Worked hours between check-in and check-out, e.g. "8.5 h". */
function workedHours(checkIn, checkOut) {
  const start = toMinutes(checkIn)
  const end = toMinutes(checkOut)
  if (start == null || end == null || end < start) return null
  const hours = (end - start) / 60
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} h`
}

export default function AttendanceList() {
  const { attendance, loading, error, refresh } = useAttendance()
  const confirm = useConfirm()
  const toast = useToast()

  // ROLE SHAPING: attendance is ADMIN-managed. HR and EMPLOYEE are read-only
  // here (EMPLOYEE tokens receive only their own rows from the backend).
  // "Check out" is deliberately ADMIN-only too - the backend PATCH is a
  // write and would 403 for anyone else; no self-service action was invented.
  const { isAdmin } = useAuth()

  const [filter, setFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [checkingOutId, setCheckingOutId] = useState(null)

  const today = todayISO()

  const counts = useMemo(() => {
    const base = { ALL: attendance.length, TODAY: 0, PRESENT: 0, WFH: 0, ABSENT: 0 }
    attendance.forEach((a) => {
      if (a.attendanceDate === today) base.TODAY += 1
      if (base[a.status] != null) base[a.status] += 1
    })
    return base
  }, [attendance, today])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return attendance
      .filter((a) => {
        if (filter === 'ALL') return true
        if (filter === 'TODAY') return a.attendanceDate === today
        return a.status === filter
      })
      .filter((a) => {
        if (!q) return true
        const name = a.employee?.name || ''
        return [name, a.status, a.attendanceDate].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      })
      .sort((a, b) => (a.attendanceDate === b.attendanceDate ? b.id - a.id : b.attendanceDate.localeCompare(a.attendanceDate)))
  }, [attendance, filter, query, today])

  async function handleCheckOut(record) {
    // Default: now. In a real app you would offer a time picker.
    const now = new Date()
    const checkOut = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    setCheckingOutId(record.id)
    try {
      await markCheckOut(record.id, checkOut)
      await refresh()
      toast.success('Checked out', `Check-out recorded at ${checkOut}.`)
    } catch (err) {
      // e.g. "checkOut cannot be before checkIn"
      toast.error('Could not check out', err.message)
    } finally {
      setCheckingOutId(null)
    }
  }

  async function handleDelete(record) {
    const ok = await confirm({
      title: 'Delete attendance record?',
      message: `The record for ${record.attendanceDate} will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete record',
      tone: 'danger',
    })
    if (!ok) return

    setDeletingId(record.id)
    try {
      await deleteAttendance(record.id)
      await refresh()
      toast.success('Attendance record deleted')
    } catch (err) {
      toast.error('Could not delete record', err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page">
      <PageHeader
        icon={Clock}
        title="Attendance"
        subtitle="Daily records from attendance_db, with employee details composed live from employee-service."
        actions={
          isAdmin ? (
            <Button as={Link} to="/attendance/new" variant="primary" icon={ClockPlus}>
              Mark attendance
            </Button>
          ) : undefined
        }
      />

      {loading ? <Loading /> : null}

      {!loading && error ? (
        <ErrorAlert title="Could not load attendance" message={error} onRetry={refresh} />
      ) : null}

      {!loading && !error && attendance.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No attendance records yet"
          message="Mark the first record to start tracking attendance."
        >
          {isAdmin ? (
            <Button as={Link} to="/attendance/new" variant="primary" icon={ClockPlus}>
              Mark attendance
            </Button>
          ) : null}
        </EmptyState>
      ) : null}

      {!loading && !error && attendance.length > 0 ? (
        <Card>
          <CardHeader
            title="Records"
            subtitle={`${filtered.length} of ${attendance.length} shown · ${today}`}
            actions={
              <div className="input-icon">
                <Search size={16} aria-hidden="true" />
                <label className="sr-only" htmlFor="attendance-search">
                  Search attendance records
                </label>
                <input
                  id="attendance-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employee, status, date…"
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

          <div style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--color-border)' }}>
            <div className="segmented" role="group" aria-label="Filter attendance">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="segmented__item"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
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
                  title="No matching records"
                  message="Nothing matches the current filter and search."
                >
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilter('ALL')
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
                      <th>Date</th>
                      <th>Status</th>
                      <th>In → Out</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((record) => {
                      const hours = workedHours(record.checkIn, record.checkOut)
                      return (
                        <tr key={record.id}>
                          <td data-label="">
                            <div className="row">
                              <span className="avatar" aria-hidden="true">
                                {initials(record.employee?.name || `ID ${record.employeeId}`)}
                              </span>
                              <div className="grow">
                                <Link to={`/attendance/${record.id}`} className="cell-primary">
                                  {record.employee ? record.employee.name : `Unknown (id ${record.employeeId})`}
                                </Link>
                                <span className="cell-sub">
                                  {record.employee ? record.employee.department : 'employee lookup failed'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td data-label="Date" className="nowrap">
                            {formatDate(record.attendanceDate)}
                          </td>
                          <td data-label="Status">
                            <Badge status={record.status} />
                          </td>
                          <td data-label="In → Out" className="nowrap">
                            <span className="mono">{record.checkIn || '—'}</span>
                            {' → '}
                            <span className="mono">{record.checkOut || '—'}</span>
                            {/* Duration only appears once we actually know it. */}
                            {hours ? <span className="cell-sub">{hours} worked</span> : null}
                          </td>
                          <td data-label="Actions">
                            <div className="cell-actions">
                              {/* ADMIN write actions; HR/EMPLOYEE get view only. */}
                              {isAdmin ? (
                                <>
                                  {/* The one-click path for the most common desk task. */}
                                  {!record.checkOut && record.status === 'PRESENT' ? (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      icon={Clock}
                                      loading={checkingOutId === record.id}
                                      onClick={() => handleCheckOut(record)}
                                    >
                                      Check out
                                    </Button>
                                  ) : null}
                                  <Button
                                    as={Link}
                                    to={`/attendance/${record.id}/edit`}
                                    variant="ghost"
                                    size="sm"
                                    iconOnly
                                    icon={Pencil}
                                    title="Edit"
                                    aria-label={`Edit attendance record ${record.id}`}
                                  />
                                  <Button
                                    variant="danger-ghost"
                                    size="sm"
                                    iconOnly
                                    icon={Trash2}
                                    loading={deletingId === record.id}
                                    onClick={() => handleDelete(record)}
                                    title="Delete"
                                    aria-label={`Delete attendance record ${record.id}`}
                                  />
                                </>
                              ) : null}
                              <Button
                                as={Link}
                                to={`/attendance/${record.id}`}
                                variant="ghost"
                                size="sm"
                                iconOnly
                                icon={Eye}
                                title="View details"
                                aria-label={`View attendance record ${record.id}`}
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
    </div>
  )
}
