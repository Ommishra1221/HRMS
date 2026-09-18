import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, IdCard, Mail, Pencil, Trash2, UserRound } from 'lucide-react'

import { deleteEmployee, getEmployee } from '../api/employeeApi'
import { useAuth } from '../context/AuthContext'
import { ErrorAlert, Loading } from '../components/common/Loading'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/Toast'
import { initials } from '../utils/format'

// =============================================================================
// EmployeeDetail - GET /api/employees/{id} rendered as a profile.
// =============================================================================
// The id comes from the URL (:id route param), NOT from any hardcoded value.
//
// It also shows where this record is used: employee-service owns this row, but
// leave, attendance and payroll all reference the same id through OpenFeign.
// Making that visible is what turns a CRUD screen into a system overview.

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { isAdmin } = useAuth()

  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)

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
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete this employee?',
      message: `"${employee.name}" will be permanently removed. Leave, attendance and payroll records that reference them will lose their employee details. This cannot be undone.`,
      confirmLabel: 'Delete employee',
      tone: 'danger',
    })
    if (!ok) return

    setDeleting(true)
    try {
      await deleteEmployee(employee.id)
      toast.success('Employee deleted', `${employee.name} has been removed.`)
      navigate('/employees')
    } catch (err) {
      toast.error('Could not delete employee', err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <Loading />

  if (error) {
    return (
      <div className="page">
        <PageHeader title="Employee" />
        <ErrorAlert title="Could not load this employee" message={error}>
          <Button as={Link} to="/employees" variant="secondary" icon={ArrowLeft}>
            Back to employees
          </Button>
        </ErrorAlert>
      </div>
    )
  }

  const displayName = employee.name || 'Unnamed employee'

  return (
    <div className="page">
      <PageHeader
        icon={UserRound}
        title={displayName}
        subtitle={`Employee ${employee.id} · employee-service`}
        actions={
          <>
            <Button as={Link} to="/employees" variant="secondary" icon={ArrowLeft}>
              Back
            </Button>
            {/* Write actions are ADMIN-only (backend 403s HR writes). */}
            {isAdmin ? (
              <>
                <Button as={Link} to={`/employees/${employee.id}/edit`} variant="secondary" icon={Pencil}>
                  Edit
                </Button>
                <Button variant="danger" icon={Trash2} onClick={handleDelete} loading={deleting}>
                  Delete
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="detail-grid">
        {/* ---- Identity summary ---- */}
        <Card>
          <CardBody>
            <div className="row" style={{ gap: 'var(--space-4)' }}>
              <span className="avatar avatar--lg" aria-hidden="true">
                {initials(displayName)}
              </span>
              <div className="grow">
                <h2 style={{ fontSize: 'var(--fs-lg)' }}>{displayName}</h2>
                <p className="text-muted" style={{ margin: 0 }}>
                  {employee.department}
                </p>
              </div>
            </div>

            <div className="stack stack-2" style={{ marginTop: 'var(--space-5)' }}>
              <a href={`mailto:${employee.email}`} className="row">
                <Mail size={16} aria-hidden="true" className="text-subtle" />
                {employee.email}
              </a>
              <span className="row">
                <Building2 size={16} aria-hidden="true" className="text-subtle" />
                {employee.department}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* ---- Raw record ---- */}
        <Card>
          <CardHeader title="Record" subtitle="Stored in employee_db" icon={IdCard} />
          <CardBody>
            <dl className="detail-list">
              <div className="detail-row">
                <dt>Employee ID</dt>
                <dd className="mono">{employee.id}</dd>
              </div>
              <div className="detail-row">
                <dt>Name</dt>
                <dd>{displayName}</dd>
              </div>
              <div className="detail-row">
                <dt>Email</dt>
                <dd>{employee.email}</dd>
              </div>
              <div className="detail-row">
                <dt>Department</dt>
                <dd>{employee.department}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* ---- Cross-service usage ---- */}
        <Card>
          <CardHeader
            title="Referenced by other services"
            subtitle="These services look this employee up over OpenFeign"
            icon={Building2}
          />
          <CardBody>
            <div className="stack stack-2">
              <Button as={Link} to="/leaves" variant="secondary" block>
                Leave requests
              </Button>
              <Button as={Link} to="/attendance" variant="secondary" block>
                Attendance records
              </Button>
              <Button as={Link} to="/payrolls" variant="secondary" block>
                Payroll payslips
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
