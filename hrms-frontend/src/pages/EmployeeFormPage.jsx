import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, UserPlus, UserRoundPen } from 'lucide-react'

import EmployeeForm from '../components/employee/EmployeeForm'
import { createEmployee, getEmployee, updateEmployee } from '../api/employeeApi'
import { ErrorAlert, Loading } from '../components/common/Loading'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import { useToast } from '../components/common/Toast'

// =============================================================================
// EmployeeFormPage - ONE page component serving two routes.
// =============================================================================
//   /employees/new        -> params.id is undefined -> CREATE mode
//   /employees/:id/edit   -> params.id exists       -> EDIT mode (fetch first)
//
// Creating and editing are the same UI with different initial data - a classic
// way to avoid duplicating a form component.

export default function EmployeeFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [initialValues, setInitialValues] = useState(null)
  const [loading, setLoading] = useState(isEdit) // create mode: nothing to load
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  // EDIT mode: load the employee so the form starts filled.
  useEffect(() => {
    if (!isEdit) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const emp = await getEmployee(id)
        if (!cancelled) {
          setInitialValues({ name: emp.name, email: emp.email, department: emp.department })
        }
      } catch (err) {
        // e.g. 404 "Employee not found with id: 99"
        if (!cancelled) setLoadError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    // Cleanup avoids "setState after unmount" warnings on fast navigation.
    return () => {
      cancelled = true
    }
  }, [id, isEdit])

  async function handleSubmit(data) {
    setSubmitting(true)
    setServerError(null)
    try {
      if (isEdit) {
        await updateEmployee(id, data)
        toast.success('Employee updated', `${data.name}'s details have been saved.`)
      } else {
        await createEmployee(data)
        toast.success('Employee added', `${data.name} is now in the directory.`)
      }
      navigate('/employees') // back to the list, which re-fetches on mount
    } catch (err) {
      // Kept on the form as well as toasted, so the message stays visible
      // beside the fields the user needs to fix.
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loading />

  if (loadError) {
    return (
      <div className="page">
        <PageHeader title="Edit employee" />
        <ErrorAlert title="Could not load this employee" message={loadError}>
          <Button as={Link} to="/employees" variant="secondary">
            Back to employees
          </Button>
        </ErrorAlert>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        icon={isEdit ? UserRoundPen : UserPlus}
        title={isEdit ? 'Edit employee' : 'Add employee'}
        subtitle={
          isEdit
            ? 'Update the details stored in employee-service.'
            : 'Create a record in employee-service. Leave, attendance and payroll can then reference it.'
        }
        actions={
          <Button as={Link} to="/employees" variant="secondary" icon={ArrowLeft}>
            Back to list
          </Button>
        }
      />

      <EmployeeForm
        key={isEdit ? `edit-${id}` : 'create'} // reset internal state when switching modes
        initialValues={initialValues || undefined}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/employees')}
        submitting={submitting}
        serverError={serverError}
      />
    </div>
  )
}
