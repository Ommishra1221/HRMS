import { Link } from 'react-router-dom'
import { useState } from 'react'
import useEmployees from '../hooks/useEmployees'
import { deleteEmployee } from '../api/employeeApi'
import { Loading, ErrorAlert, EmptyState } from '../components/common/Loading'

// EmployeeList = the first page wired to the REAL backend.
//
// Data flow when this page opens:
//   EmployeeList renders -> useEffect (inside useEmployees) fires
//   -> employeeApi.getEmployees() -> axiosInstance
//   -> GET http://localhost:8080/api/employees   (API Gateway)
//   -> strip /api -> GET http://localhost:8081/employees
//   -> EmployeeController -> EmployeeServiceImpl -> employee_db
//   -> JSON array flows back up the same chain -> setEmployees -> re-render
export default function EmployeeList() {
  const { employees, loading, error, refresh } = useEmployees()
  const [deletingId, setDeletingId] = useState(null)

  async function handleDelete(employee) {
    // Confirm before destroying data - small habit that scales well.
    if (!window.confirm(`Delete employee "${employee.name}"?`)) return
    setDeletingId(employee.id)
    try {
      await deleteEmployee(employee.id)
      await refresh() // re-fetch so the table reflects the database
    } catch (err) {
      alert(err.message) // e.g. "Employee not found with id: 99"
    } finally {
      setDeletingId(null)
   }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Employees</h2>
        <Link to="/employees/new" className="btn btn-primary">
          + Add Employee
        </Link>
        {/* /employees/new doesn't exist yet -> shows the "Page not found" route.
            The real form page arrives in the next step. */}
      </div>

      {loading && <Loading />}
      {!loading && error && <ErrorAlert message={error} onRetry={refresh} />}
      {!loading && !error && employees.length === 0 && (
        <EmptyState message="No employees yet. Add your first employee to get started.">
          <Link to="/employees/new" className="btn btn-primary">+ Add Employee</Link>
        </EmptyState>
      )}
      {!loading && !error && employees.length > 0 && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Actions</th>
            </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.id}</td>
                  <td>
                    <Link to={`/employees/${emp.id}`}>{emp.name}</Link>
                    {/* /employees/:id detail page also comes in the next steps */}
                  </td>
                  <td>{emp.email}</td>
                  <td>{emp.department}</td>
                  <td>
                    <Link to={`/employees/${emp.id}/edit`} className="btn btn-secondary">
                      Edit
                    </Link>{' '}
                    <button
                      onClick={() => handleDelete(emp)}
                      disabled={deletingId === emp.id}
                      className="btn btn-danger"
                    >
                      {deletingId === emp.id ? 'Deleting…' : 'Delete'}
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
