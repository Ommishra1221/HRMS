import { Link } from 'react-router-dom'
import { useState } from 'react'
import useLeaves from '../hooks/useLeaves'
import { deleteLeave } from '../api/leaveApi'
import { Loading, ErrorAlert, EmptyState } from '../components/common/Loading'

// LeaveList = GET /api/leaves rendered as a table.
//
// Each row's "employee" column comes from the NESTED object the backend
// composed via Feign (leave_db row + live HTTP call to employee-service).
// The frontend does nothing special - it just reads leave.employee?.name.
export default function LeaveList() {
  const { leaves, loading, error, refresh } = useLeaves()
  const [deletingId, setDeletingId] = useState(null)

  async function handleDelete(leave) {
    if (!window.confirm('Cancel (delete) this leave request?')) return
    setDeletingId(leave.id)
    try {
      await deleteLeave(leave.id)
      await refresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Leaves</h2>
        <Link to="/leaves/new" className="btn btn-primary">+ Apply for Leave</Link>
      </div>

      {loading && <Loading />}
      {!loading && error && <ErrorAlert message={error} onRetry={refresh} />}
      {!loading && !error && leaves.length === 0 && (
        <EmptyState message="No leave requests yet.">
          <Link to="/leaves/new" className="btn btn-primary">+ Apply for Leave</Link>
        </EmptyState>
      )}
      {!loading && !error && leaves.length > 0 && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave.id}>
                  <td>{leave.id}</td>
                  <td>
                    <Link to={`/leaves/${leave.id}`}>
                      {/* Optional chaining: employee can be null in rare
                          edge cases (e.g. employee deleted in the other
                          service while this list was loading). */}
                      {leave.employee ? leave.employee.name : `Unknown (id ${leave.employeeId})`}
                    </Link>
                    {leave.employee && (
                      <span style={{ color: '#52606d' }}> · {leave.employee.department}</span>
                    )}
                  </td>
                  <td>{leave.leaveType}</td>
                  <td>{leave.fromDate} → {leave.toDate}</td>
                  <td><span className={`badge badge-${leave.status}`}>{leave.status}</span></td>
                  <td>
                    <Link to={`/leaves/${leave.id}/edit`} className="btn btn-secondary">Edit</Link>{' '}
                    <button
                      onClick={() => handleDelete(leave)}
                      disabled={deletingId === leave.id}
                      className="btn btn-danger"
                    >
                      {deletingId === leave.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
