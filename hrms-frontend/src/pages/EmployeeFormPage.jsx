import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EmployeeForm from '../components/employee/EmployeeForm'
import { createEmployee, getEmployee, updateEmployee } from '../api/employeeApi'
import { Loading, ErrorAlert } from '../components/common/Loading'

// ONE page component serves two routes:
//   /employees/new        -> params.id is undefined -> CREATE mode
//   /employees/:id/edit   -> params.id exists       -> EDIT mode (fetch first)
//
// Creating and editing are the same UI with different initial data -
// a classic way to avoid duplicating a form component.
export default function EmployeeFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [initialValues, setInitialValues] = useState(null)
  const [loading, setLoading] = useState(isEdit) // create mode: nothing to load
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  // EDIT mode: load the employee so the form starts filled.
  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    ;(async () => {
      try {
        const emp = await getEmployee(id)
        if (!cancelled) setInitialValues({ name: emp.name, email: emp.email, department: emp.department })
      } catch (err) {
        // e.g. 404 "Employee not found with id: 99"
        if (!cancelled) setLoadError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    // Cleanup avoids "setState after unmount" warnings on fast navigation.
    return () => { cancelled = true }
  }, [id, isEdit])

  async function handleSubmit(data) {
    setSubmitting(true)
    setServerError(null)
    try {
      if (isEdit) {
        await updateEmployee(id, data)
      } else {
        await createEmployee(data)
      }
      navigate('/employees') // back to the list, which re-fetches on mount
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loading />
  if (loadError) return <ErrorAlert message={loadError} />

  return (
    <div className="page">
      <div className="page-header">
        <h2>{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
      </div>
      <EmployeeForm
        key={isEdit ? `edit-${id}` : 'create'} // reset internal state when switching modes
        initialValues={initialValues || undefined}
        onSubmit={handleSubmit}
        submitting={submitting}
        serverError={serverError}
      />
    </div>
  )
}
