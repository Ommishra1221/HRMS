import { Link } from 'react-router-dom'
import {
  Banknote,
  CalendarDays,
  CalendarPlus,
  CircleDollarSign,
  Clock,
  ClockPlus,
  LayoutDashboard,
  Receipt,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'

import useEmployees from '../hooks/useEmployees'
import useLeaves from '../hooks/useLeaves'
import useAttendance from '../hooks/useAttendance'
import usePayrolls from '../hooks/usePayrolls'
import { useAuth } from '../context/AuthContext'
import EmployeeDashboard from './EmployeeDashboard'
import { ErrorAlert, LoadingCards } from '../components/common/Loading'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import StatCard from '../components/common/StatCard'
import Badge from '../components/common/Badge'
import Button from '../components/common/Button'
import DonutChart from '../components/charts/DonutChart'
import BarChart from '../components/charts/BarChart'
import { formatAmount, formatDate, formatMonth, formatNumber, todayISO } from '../utils/format'

// =============================================================================
// Dashboard - read-only overview of all four services.
// =============================================================================
// Built entirely from the SAME hooks the list pages use, so opening the
// dashboard issues four parallel GETs through the gateway - one per service -
// and never touches a service-specific API file directly.
//
// Stats are computed in the browser by filtering the lists. That is honest for
// this project's scale, but it is a real design smell: a production HRMS would
// expose per-service /stats endpoints instead of shipping every row to the
// browser. Noted here so it is a known trade-off rather than an oversight.

// Colours for the attendance mix donut, one per backend status value.
const ATTENDANCE_COLORS = {
  PRESENT: '#059669',
  WFH: '#2563eb',
  LEAVE: '#d97706',
  HALF_DAY: '#64748b',
  ABSENT: '#dc2626',
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Group payslips by their `month` field and return the last six months. */
function payslipsByMonth(payrolls) {
  const counts = new Map()
  payrolls.forEach((p) => {
    if (!p.month) return
    counts.set(p.month, (counts.get(p.month) || 0) + 1)
  })

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b)) // "yyyy-MM" sorts correctly as text
    .slice(-6)
    .map(([month, value]) => ({ label: month, value }))
}

export default function Dashboard() {
  const { user, isEmployee, isAdmin } = useAuth()

  // ROLE DISPATCH: an EMPLOYEE gets a dedicated self-service dashboard, not
  // the org overview (an employee token would 403 the employees list anyway).
  // Rendered as a SIBLING component (not an early return) so this component
  // keeps calling its hooks unconditionally - React's Rules of Hooks demand
  // the same hook order on every render, and a role can change between
  // renders while the account session lives (e.g. after refreshUser).
  return isEmployee ? <EmployeeDashboard /> : <OrgDashboard isAdmin={isAdmin} />
}

function OrgDashboard({ isAdmin }) {
  // Org dashboard is only rendered for ADMIN/HR; reading the user here is
  // safe and keeps the greeting working without prop drilling.
  const { user } = useAuth()
  const { employees, loading: empLoading, error: empError, refresh: refreshEmp } = useEmployees()
  const { leaves, loading: leaveLoading, error: leaveError, refresh: refreshLeaves } = useLeaves()
  const { attendance, loading: attLoading, error: attError, refresh: refreshAtt } = useAttendance()
  const { payrolls, loading: payLoading, error: payError, refresh: refreshPay } = usePayrolls()

  const anyLoading = empLoading || leaveLoading || attLoading || payLoading

  // Every service down = a real outage, so say so once rather than showing
  // four separate error tiles. One service down is handled per-card below.
  if (!anyLoading && empError && leaveError && attError && payError) {
    return (
      <div className="page">
        <PageHeader title="Dashboard" />
        <ErrorAlert
          title="Cannot reach the backend"
          message={empError}
          onRetry={() => {
            refreshEmp()
            refreshLeaves()
            refreshAtt()
            refreshPay()
          }}
        />
      </div>
    )
  }

  // ---- Derived numbers -------------------------------------------------------
  const today = todayISO()
  const presentToday = attendance.filter((a) => a.status === 'PRESENT' && a.attendanceDate === today).length
  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length
  const paidPayrolls = payrolls.filter((p) => p.status === 'PAID')
  const totalPaid = paidPayrolls.reduce((sum, p) => sum + Number(p.netSalary || 0), 0)

  // Attendance mix: only include statuses that actually occur, so the donut
  // never has a zero-width segment with a legend entry next to it.
  const attendanceMix = ['PRESENT', 'WFH', 'LEAVE', 'HALF_DAY', 'ABSENT']
    .map((status) => ({
      label: status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      value: attendance.filter((a) => a.status === status).length,
      color: ATTENDANCE_COLORS[status],
    }))
    .filter((slice) => slice.value > 0)

  const highestMonth = payslipsByMonth(payrolls).reduce(
    (best, m) => (m.value > (best?.value ?? 0) ? m : best),
    null,
  )

  const recentLeaves = [...leaves].sort((a, b) => b.id - a.id).slice(0, 5)
  const serviceTag = (name) => `${name}-service unavailable`

  return (
    <div className="page">
      <PageHeader
        icon={LayoutDashboard}
        title={`${greeting()}, ${user?.fullName?.split(' ')[0] || user?.username || 'there'}`}
        subtitle="Here is where the organisation stands today."
      />

      {/* ---- KPI row ---- */}
      {anyLoading ? (
        <LoadingCards count={6} />
      ) : (
        <div className="stats-grid">
          <StatCard
            to="/employees"
            icon={Users}
            tone="blue"
            value={formatNumber(employees.length)}
            label="Total employees"
            error={empError ? serviceTag('employee') : null}
          />
          <StatCard
            to="/leaves"
            icon={CalendarDays}
            tone="amber"
            value={formatNumber(pendingCount)}
            label="Leave awaiting approval"
            hint={`of ${formatNumber(leaves.length)} requests`}
            error={leaveError ? serviceTag('leave') : null}
          />
          <StatCard
            to="/attendance"
            icon={Clock}
            tone="green"
            value={formatNumber(presentToday)}
            label="Present today"
            hint={today}
            error={attError ? serviceTag('attendance') : null}
          />
          <StatCard
            to="/attendance"
            icon={Users}
            tone="blue"
            value={formatNumber(attendance.length)}
            label="Attendance records"
            error={attError ? serviceTag('attendance') : null}
          />
          <StatCard
            to="/payrolls"
            icon={Receipt}
            tone="blue"
            value={formatNumber(payrolls.length)}
            label="Payslips generated"
            hint={`${formatNumber(paidPayrolls.length)} paid`}
            error={payError ? serviceTag('payroll') : null}
          />
          <StatCard
            to="/payrolls"
            icon={CircleDollarSign}
            tone="green"
            value={formatAmount(totalPaid)}
            label="Total paid (net)"
            hint="Across all settled payslips"
            error={payError ? serviceTag('payroll') : null}
          />
        </div>
      )}

      {/* ---- Charts ---- */}
      <div className="chart-grid">
        <Card>
          <CardHeader
            title="Attendance mix"
            subtitle="All records grouped by status"
            icon={Clock}
            actions={
              <Button as={Link} to="/attendance" variant="ghost" size="sm">
                View
              </Button>
            }
          />
          <CardBody>
            {anyLoading ? (
              <div className="skeleton" style={{ height: 148 }} />
            ) : attError ? (
              <p className="text-muted">{attError}</p>
            ) : attendanceMix.length === 0 ? (
              <p className="text-muted">No attendance recorded yet.</p>
            ) : (
              <DonutChart
                data={attendanceMix}
                caption="Records"
                centerLabel="records"
                formatValue={formatNumber}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Payslips by month"
            subtitle={highestMonth ? `Busiest month: ${formatMonth(highestMonth.label)}` : 'Payroll runs per month'}
            icon={TrendingUp}
            actions={
              <Button as={Link} to="/payrolls" variant="ghost" size="sm">
                View
              </Button>
            }
          />
          <CardBody>
            {anyLoading ? (
              <div className="skeleton" style={{ height: 170 }} />
            ) : payError ? (
              <p className="text-muted">{payError}</p>
            ) : payrolls.length === 0 ? (
              <p className="text-muted">No payslips generated yet.</p>
            ) : (
              <BarChart
                data={payslipsByMonth(payrolls)}
                formatValue={formatNumber}
                formatLabel={formatMonth}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* ---- Recent activity + quick actions ---- */}
      <div className="detail-grid">
        <Card>
          <CardHeader
            title="Latest leave requests"
            icon={CalendarDays}
            actions={
              <Button as={Link} to="/leaves" variant="ghost" size="sm">
                View all
              </Button>
            }
          />
          <CardBody flush>
            {anyLoading ? (
              <div className="skeleton-rows">
                {[0, 1, 2].map((i) => (
                  <div className="skeleton-row" key={i}>
                    <div className="skeleton" style={{ flex: 2 }} />
                    <div className="skeleton" style={{ flex: 1 }} />
                  </div>
                ))}
              </div>
            ) : leaveError ? (
              <div className="card__body">
                <p className="text-muted">{leaveError}</p>
              </div>
            ) : recentLeaves.length === 0 ? (
              <div className="card__body">
                <p className="text-muted">No leave requests yet.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table--stack">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Dates</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeaves.map((leave) => (
                      <tr key={leave.id}>
                        <td data-label="Employee">
                          <Link to={`/leaves/${leave.id}`} className="cell-primary">
                            {leave.employee ? leave.employee.name : `Unknown (id ${leave.employeeId})`}
                          </Link>
                          <span className="cell-sub">{leave.leaveType}</span>
                        </td>
                        <td data-label="Dates" className="nowrap">
                          {formatDate(leave.fromDate)} → {formatDate(leave.toDate)}
                        </td>
                        <td data-label="Status">
                          <Badge status={leave.status} />
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
              {/* HR is read-only everywhere, so HR gets links instead of write
                  shortcuts. The full write set belongs to ADMIN alone. */}
              {isAdmin ? (
                <>
                  <Button as={Link} to="/leaves/new" variant="secondary" icon={CalendarPlus} block>
                    Apply for leave
                  </Button>
                  <Button as={Link} to="/attendance/new" variant="secondary" icon={ClockPlus} block>
                    Mark attendance
                  </Button>
                  <Button as={Link} to="/payrolls/new" variant="secondary" icon={Wallet} block>
                    Create payslip
                  </Button>
                  <Button as={Link} to="/employees/new" variant="secondary" icon={UserPlus} block>
                    Add employee
                  </Button>
                </>
              ) : (
                <>
                  <Button as={Link} to="/employees" variant="secondary" icon={Users} block>
                    Browse employees
                  </Button>
                  <Button as={Link} to="/leaves" variant="secondary" icon={CalendarDays} block>
                    Review leave requests
                  </Button>
                  <Button as={Link} to="/payrolls" variant="secondary" icon={Receipt} block>
                    View payroll
                  </Button>
                </>
              )}
            </div>
          </CardBody>
          <CardBody className="text-subtle" style={{ borderTop: '1px solid var(--color-border)' }}>
            <Banknote size={14} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px' }} /> Totals
            refresh every time you open this page.
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
