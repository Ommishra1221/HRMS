import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  CalendarDays,
  CalendarPlus,
  Clock,
  Eye,
  IdCard,
  Inbox,
  LayoutDashboard,
  Pencil,
  Receipt,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import useLeaves from '../hooks/useLeaves'
import useAttendance from '../hooks/useAttendance'
import usePayrolls from '../hooks/usePayrolls'
import { getMyProfile } from '../api/employeeApi'
import { EmptyState, ErrorAlert, Loading } from '../components/common/Loading'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import StatCard from '../components/common/StatCard'
import Badge from '../components/common/Badge'
import Button from '../components/common/Button'
import { formatAmount, formatDate } from '../utils/format'

// =============================================================================
// EmployeeDashboard - the EMPLOYEE home screen.
// =============================================================================
// The backend already scopes every list endpoint to the caller's own rows
// (ownership is resolved from the JWT server-side, never from a frontend
// id), so this page calls the SAME list hooks the org-wide screens use -
// whatever arrives is guaranteed to be "mine". There is no client-side
// authorization here; if the backend rules change, this page simply follows.
//
// GET /api/employees/me is the one self-service call. An ADMIN/HR account
// has no employee link, so the backend 403s it - that is a normal state,
// handled as a quiet notice rather than a crash.

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function EmployeeDashboard() {
  const { user } = useAuth()

  const { leaves, loading: leavesLoading, error: leavesError } = useLeaves()
  const { attendance, loading: attLoading, error: attError } = useAttendance()
  const { payrolls, loading: payLoading, error: payError } = usePayrolls()

  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getMyProfile()
        if (!cancelled) setProfile(data)
      } catch (err) {
        if (!cancelled) setProfileError(err.message)
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Backend statuses are SCREAMING_SNAKE; compare defensively.
  const pendingLeaves = leaves.filter((l) => (l.status || '').toUpperCase() === 'PENDING')
  const latestPayroll = payrolls.length > 0 ? payrolls[0] : null

  // Hours logged this calendar month, summed in the browser from the caller's
  // own rows (the backend already scoped them to this employee).
  const hoursThisMonth = useMemo(
    () =>
      attendance.reduce((sum, a) => {
        const d = a.attendanceDate
        if (!d) return sum
        const now = new Date()
        const isThisMonth =
          d.startsWith(`${now.getFullYear()}-`) && Number(d.slice(5, 7)) === now.getMonth() + 1
        return sum + (isThisMonth ? Number(a.hoursWorked) || 0 : 0)
      }, 0),
    [attendance],
  )

  const loading = leavesLoading || attLoading || payLoading || profileLoading
  const recentLeaves = useMemo(() => [...leaves].sort((a, b) => b.id - a.id).slice(0, 5), [leaves])

  return (
    <div className="page">
      <PageHeader
        icon={LayoutDashboard}
        title={`${greeting()}, ${user?.fullName?.split(' ')[0] || user?.username || 'there'}`}
        subtitle="Your own leave, attendance and payslips in one place."
      />

      {/* ---- Loading: skeletons that reserve the real layout ---- */}
      {loading && <Loading rows={4} label="Loading your data…" />}

      {/* ---- A real outage: every list failed. One message, one retry. ---- */}
      {!loading && leavesError && attError && payError && (
        <ErrorAlert
          title="Cannot reach the backend"
          message={leavesError}
          onRetry={() => window.location.reload()}
        />
      )}

      {!loading && !(leavesError && attError && payError) && (
        <>
          {/* ---- Profile summary (self-service endpoint) ---- */}
          <Card>
            <CardHeader
              title="My profile"
              subtitle={profile ? `Employee ${profile.id}` : undefined}
              icon={IdCard}
              actions={
                <Button as={Link} to="/me" variant="ghost" size="sm">
                  View
                </Button>
              }
            />
            <CardBody>
              {profileLoading ? (
                <div className="skeleton" style={{ height: 60 }} aria-hidden="true" />
              ) : profile ? (
                <div className="summary-strip">
                  <div>
                    <div className="summary-strip__label">Name</div>
                    <div className="summary-strip__value">{profile.name}</div>
                  </div>
                  <div>
                    <div className="summary-strip__label">Email</div>
                    <div className="summary-strip__value">{profile.email}</div>
                  </div>
                  <div>
                    <div className="summary-strip__label">Department</div>
                    <div className="summary-strip__value">{profile.department}</div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={IdCard}
                  title="No linked employee record"
                  message={
                    profileError
                      ? 'Your account is not linked to an employee record, so a profile cannot be shown.'
                      : undefined
                  }
                />
              )}
            </CardBody>
          </Card>

          {/* ---- KPI row (own numbers only) ---- */}
          <div className="stats-grid">
            <StatCard
              to="/leaves"
              icon={CalendarDays}
              tone="amber"
              value={pendingLeaves.length}
              label="My pending leaves"
              hint={`of ${leaves.length} requests`}
              error={leavesError ? 'leave-service unavailable' : null}
            />
            <StatCard
              to="/attendance"
              icon={Clock}
              tone="green"
              value={hoursThisMonth}
              label="Hours this month"
              error={attError ? 'attendance-service unavailable' : null}
            />
            <StatCard
              to="/payrolls"
              icon={Receipt}
              tone="blue"
              value={payrolls.length}
              label="My payslips"
              error={payError ? 'payroll-service unavailable' : null}
            />
            <StatCard
              to="/payrolls"
              icon={Banknote}
              tone="green"
              value={latestPayroll ? formatAmount(latestPayroll.netSalary) : '—'}
              label="Latest net pay"
              hint={latestPayroll ? formatDate(latestPayroll.month) : undefined}
              error={payError ? 'payroll-service unavailable' : null}
            />
          </div>

          {/* ---- Recent leave + quick actions ---- */}
          <div className="detail-grid">
            <Card>
              <CardHeader
                title="My recent leave"
                icon={CalendarDays}
                actions={
                  <Button as={Link} to="/leaves/new" variant="ghost" size="sm" icon={CalendarPlus}>
                    Apply
                  </Button>
                }
              />
              <CardBody flush>
                {leavesError ? (
                  <div className="card__body">
                    <p className="text-muted">{leavesError}</p>
                  </div>
                ) : recentLeaves.length === 0 ? (
                  <div className="card__body">
                    <EmptyState
                      icon={Inbox}
                      title="No leave requests yet"
                      message="When you apply, your requests will appear here."
                    >
                      <Button as={Link} to="/leaves/new" variant="primary" icon={CalendarPlus}>
                        Apply for leave
                      </Button>
                    </EmptyState>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table--stack">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Dates</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentLeaves.map((leave) => (
                          <tr key={leave.id}>
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
                                  title="View"
                                  aria-label={`View leave request ${leave.id}`}
                                />
                                {(leave.status || '').toUpperCase() === 'PENDING' && (
                                  <Button
                                    as={Link}
                                    to={`/leaves/${leave.id}/edit`}
                                    variant="ghost"
                                    size="sm"
                                    iconOnly
                                    icon={Pencil}
                                    title="Edit pending request"
                                    aria-label={`Edit leave request ${leave.id}`}
                                  />
                                )}
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

            <Card>
              <CardHeader title="Quick actions" subtitle="Jump straight to a task" icon={LayoutDashboard} />
              <CardBody>
                <div className="stack stack-2">
                  <Button as={Link} to="/leaves/new" variant="secondary" icon={CalendarPlus} block>
                    Apply for leave
                  </Button>
                  <Button as={Link} to="/me" variant="secondary" icon={IdCard} block>
                    View my profile
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
