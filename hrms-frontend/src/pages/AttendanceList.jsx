import { Link } from 'react-router-dom'
import { useState } from 'react'
import useAttendance from '../hooks/useAttendance'
import { deleteAttendance, markCheckOut } from '../api/attendanceApi'
import { Loading, ErrorAlert, EmptyState } from '../components/common/Loading'

// AttendanceList = GET /api/attendance rendered as a table.
//
// Each row's "employee" column comes from the NESTED object the backend
// composed via Feign (attendance_db row + live HTTP call to employee-service).
// The frontend does nothing special - it just reads attendance.employee?.name.
//
// Extra microservice moment: "Check out" calls PATCH /api/attendance/{id}/checkout
// - a partial update, not a full PUT. The backend validates the times.
export default function AttendanceList() {
  const { attendance, loading, error, refresh } = useAttendance()
  const [deletingId, setDeletingId] = useState(null)
  const [checkingOutId, setCheckingOutId] = useState(null)

  async function handleCheckOut(record) {
    // Default: now. In a real app you'd offer a time picker.
    const now = new Date()
    const checkOut = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setCheckingOutId(record.id)
    try {
      await markCheckOut(record.id, checkOut)
      await refresh()
    } catch (err) {
      alert(err.message) // e.g. "checkOut cannot be before checkIn"
    } finally {
      setCheckingOutId(null)
    }
  }

  async function handleDelete(record) {
    if (!window.confirm('Delete this attendance record?')) return
    setDeletingId(record.id)
    try {
      await deleteAttendance(record.id)
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
        <h2>Attendance</h2>
        <Link to="/attendance/new" className="btn btn-primary">+ Mark Attendance</Link>
      </div>

      {loading && <Loading />}
      {!loading && error && <ErrorAlert message={error} onRetry={refresh} />}
      {!loading && !error && attendance.length === 0 && (
        <EmptyState message="No attendance records yet. Mark the first one to get started.">
          <Link to="/attendance/new" className="btn btn-primary">+ Mark Attendance</Link>
        </EmptyState>
      )}
      {!loading && !error && attendance.length > 0 && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Employee</th>
                <th>Date</th>
                <th>Status</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record) => (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  <td>
                    <Link to={`/attendance/${record.id}`}>
                      {record.employee ? record.employee.name : `Unknown (id ${record.employeeId})`}
                    </Link>
                    {record.employee && (
                      <span style={{ color: '#52606d' }}> · {record.employee.department}</span>
                    )}
                  </td>
                  <td>{record.attendanceDate}</td>
                  <td><span className={`badge badge-${record.status}`}>{record.status}</span></td>
                  <td>{record.checkIn || '—'}</td>
                  <td>
                    {record.checkOut || (
                      record.status === 'PRESENT' && (
                        <button
                          onClick={() => handleCheckOut(record)}
                          disabled={checkingOutId === record.id}
                          className="btn btn-secondary"
                        >
                          {checkingOutId === record.id ? 'Saving…' : 'Check out'}
                        </button>
                      )
                    )}
                  </td>
                  <td>
                    <Link to={`/attendance/${record.id}/edit`} className="btn btn-secondary">Edit</Link>{' '}
                    <button
                      onClick={() => handleDelete(record)}
                      disabled={deletingId === record.id}
                      className="btn btn-danger"
                    >
                      {deletingId === record.id ? 'Deleting…' : 'Delete'}
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
