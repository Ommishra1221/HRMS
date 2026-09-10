import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getLeave, deleteLeave } from '../api/leaveApi'
import { Loading, ErrorAlert } from '../components/common/Loading'

// LeaveDetail = GET /api/leaves/{id}.
// The response is a beautiful example of API composition: one JSON containing
// leave data (leave_db) AND employee data (fetched live by leave-service
// from employee-service via Feign). We simply render both.
export default function LeaveDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [leave, setLeave] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getLeave(id)
        if (!cancelled) setLeave(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  async function handleDelete() {
    if (!window.confirm('Delete this leave request?')) return
    try {
      await deleteLeave(leave.id)
      navigate('/leaves')
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorAlert message={error} />

  return (
    <div className="page">
      <div className="page-header">
        <h2>Leave Details</h2>
        <div>
          <Link to={`/leaves/${leave.id}/edit`} className="btn btn-secondary">Edit</Link>{' '}
          <button onClick={handleDelete} className="btn btn-danger">Delete</button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginTop: 0 }}>Leave</h3>
          <p><strong>ID:</strong> {leave.id}</p>
          <p>
            <strong>Status:</strong>{' '}
            <span className={`badge badge-${leave.status}`}>{leave.status}</span>
          </p>
          <p><strong>Type:</strong> {leave.leaveType}</p>
          <p><strong>From:</strong> {leave.fromDate}</p>
          <p><strong>To:</strong> {leave.toDate}</p>
          <p><strong>Reason:</strong> {leave.reason || '—'}</p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginTop: 0 }}>Employee</h3>
          {leave.employee ? (
            <>
              <p><strong>Name:</strong> {leave.employee.name}</p>
              <p><strong>Email:</strong> {leave.employee.email}</p>
              <p><strong>Department:</strong> {leave.employee.department}</p>
              <Link to={`/employees/${leave.employee.id}`} className="btn btn-secondary">
                View Employee
              </Link>
            </>
          ) : (
            <p>Employee information unavailable (id {leave.employeeId}).</p>
          )}
        </div>
      </div>
    </div>
  )
}
