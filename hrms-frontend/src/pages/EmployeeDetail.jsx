import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getEmployee, deleteEmployee } from '../api/employeeApi'
import { Loading, ErrorAlert } from '../components/common/Loading'

// EmployeeDetail = GET /api/employees/{id} rendered as a profile card.
// The id comes from the URL (:id route param), NOT from any hardcoded value.
export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getEmployee(id)
        if (!cancelled) setEmployee(data)
      } catch (err) {
        if (!cancelled) setError(err.message) // "Employee not found with id: 99"
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  async function handleDelete() {
    if (!window.confirm(`Delete employee "${employee.name}"?`)) return
    try {
      await deleteEmployee(employee.id)
      navigate('/employees')
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorAlert message={error} />

  return (
    <div className="page">
      <div className="page-header">
        <h2>Employee Details</h2>
        <div>
          <Link to={`/employees/${employee.id}/edit`} className="btn btn-secondary">Edit</Link>{' '}
          <button onClick={handleDelete} className="btn btn-danger">Delete</button>
        </div>
      </div>

      <div className="card" style={{ padding: 24, maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>{employee.name}</h3>
        <p><strong>ID:</strong> {employee.id}</p>
        <p><strong>Email:</strong> {employee.email}</p>
        <p><strong>Department:</strong> {employee.department}</p>
      </div>
    </div>
  )
}
