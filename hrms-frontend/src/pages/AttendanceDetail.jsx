import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAttendanceRecord, deleteAttendance, markCheckOut } from '../api/attendanceApi'
import { Loading, ErrorAlert } from '../components/common/Loading'

// AttendanceDetail = GET /api/attendance/{id}.
// The response is another example of API composition: one JSON containing
// attendance data (attendance_db) AND employee data (fetched live by
// attendance-service from employee-service via Feign). We simply render both.
export default function AttendanceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [checkingOut, setCheckingOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getAttendanceRecord(id)
        if (!cancelled) setRecord(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  async function handleCheckOut() {
    const now = new Date()
    const checkOut = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setCheckingOut(true)
    try {
      const updated = await markCheckOut(record.id, checkOut)
      setRecord(updated) // no refetch needed - the PUT-like response IS the new state
    } catch (err) {
      alert(err.message)
    } finally {
      setCheckingOut(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this attendance record?')) return
    try {
      await deleteAttendance(record.id)
      navigate('/attendance')
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorAlert message={error} />

  return (
    <div className="page">
      <div className="page-header">
        <h2>Attendance Details</h2>
        <div>
          <Link to={`/attendance/${record.id}/edit`} className="btn btn-secondary">Edit</Link>{' '}
          <button onClick={handleDelete} className="btn btn-danger">Delete</button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginTop: 0 }}>Attendance</h3>
          <p><strong>ID:</strong> {record.id}</p>
          <p>
            <strong>Status:</strong>{' '}
            <span className={`badge badge-${record.status}`}>{record.status}</span>
          </p>
          <p><strong>Date:</strong> {record.attendanceDate}</p>
          <p><strong>Check In:</strong> {record.checkIn || '—'}</p>
          <p>
            <strong>Check Out:</strong> {record.checkOut || '—'}{' '}
            {record.status === 'PRESENT' && !record.checkOut && (
              <button onClick={handleCheckOut} disabled={checkingOut} className="btn btn-secondary">
                {checkingOut ? 'Saving…' : 'Check out now'}
              </button>
            )}
          </p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginTop: 0 }}>Employee</h3>
          {record.employee ? (
            <>
              <p><strong>Name:</strong> {record.employee.name}</p>
              <p><strong>Email:</strong> {record.employee.email}</p>
              <p><strong>Department:</strong> {record.employee.department}</p>
              <Link to={`/employees/${record.employee.id}`} className="btn btn-secondary">
                View Employee
              </Link>
            </>
          ) : (
            <p>Employee information unavailable (id {record.employeeId}).</p>
          )}
        </div>
      </div>
    </div>
  )
}
