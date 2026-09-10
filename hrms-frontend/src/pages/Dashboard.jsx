import { Link } from 'react-router-dom'
import useEmployees from '../hooks/useEmployees'
import useLeaves from '../hooks/useLeaves'
import { Loading, ErrorAlert } from '../components/common/Loading'

// Dashboard = read-only overview built from the SAME two hooks the list
// pages use. No new API code - reuse is the point of the hook layer.
//
// "Pending Leaves" is computed in the FRONTEND by filtering the leave list
// on status === 'PENDING'. (A real system would have a dedicated backend
// stats endpoint instead of shipping all rows to the browser.)
export default function Dashboard() {
  const { employees, loading: empLoading, error: empError, refresh: refreshEmp } = useEmployees()
  const { leaves, loading: leaveLoading, error: leaveError, refresh: refreshLeaves } = useLeaves()

  if (empLoading || leaveLoading) return <Loading />

  // Either service being down should not blank the whole dashboard.
  if (empError && leaveError) {
    return <ErrorAlert message={empError} onRetry={() => { refreshEmp(); refreshLeaves() }} />
  }

  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length

  return (
    <div className="page">
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      <div className="stats-grid">
        <Link to="/employees" className="stat-card card">
          <span className="stat-number">
            {empError ? '—' : employees.length}
          </span>
          <span className="stat-label">Total Employees</span>
          {empError && <span className="stat-error">employee-service error</span>}
        </Link>

        <Link to="/leaves" className="stat-card card">
          <span className="stat-number">{leaveError ? '—' : leaves.length}</span>
          <span className="stat-label">Total Leave Requests</span>
          {leaveError && <span className="stat-error">leave-service error</span>}
        </Link>

        <Link to="/leaves" className="stat-card card">
          <span className="stat-number">{leaveError ? '—' : pendingCount}</span>
          <span className="stat-label">Pending Leaves</span>
        </Link>
      </div>

      <p style={{ color: '#52606d' }}>
        Use the sidebar to manage <Link to="/employees">Employees</Link> and{' '}
        <Link to="/leaves">Leaves</Link>.
      </p>
    </div>
  )
}
