import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Banknote, Building2, Pencil, Trash2, UserRound } from 'lucide-react'

import { deletePayroll, getPayroll, markPayrollPaid } from '../api/payrollApi'
import { useAuth } from '../context/AuthContext'
import { ErrorAlert, Loading } from '../components/common/Loading'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/Toast'
import { formatAmount, formatDate, formatMonth, initials } from '../utils/format'

// =============================================================================
// PayrollDetail = GET /api/payroll/{id} - "the payslip".
// =============================================================================
// Another example of API composition: one JSON containing payroll data
// (payroll_db) AND employee data (fetched live by payroll-service from
// employee-service via Feign).
//
// The layout deliberately mirrors a real payslip: the number that matters
// (net pay) is the headline, with the arithmetic that produced it directly
// underneath, so the figure can be checked rather than just trusted.

export default function PayrollDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  // Payroll writes (incl. the terminal PAID transition) are ADMIN-only.
  // HR sees the payslip read-only; EMPLOYEE sees only their own.
  const { isAdmin } = useAuth()

  const [payroll, setPayroll] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paying, setPaying] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getPayroll(id)
        if (!cancelled) setPayroll(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleMarkPaid() {
    const ok = await confirm({
      title: 'Mark this payslip as paid?',
      message: `Payslip #${payroll.id} will be marked PAID and today's date stamped as the payment date.`,
      confirmLabel: 'Mark as paid',
    })
    if (!ok) return

    setPaying(true)
    try {
      const updated = await markPayrollPaid(payroll.id) // no date -> backend uses today
      setPayroll(updated) // no refetch needed - the response IS the new state
      toast.success('Payslip marked paid')
    } catch (err) {
      toast.error('Could not mark as paid', err.message)
    } finally {
      setPaying(false)
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete this payslip?',
      message: 'The payslip will be permanently removed from payroll_db. This cannot be undone.',
      confirmLabel: 'Delete payslip',
      tone: 'danger',
    })
    if (!ok) return

    setDeleting(true)
    try {
      await deletePayroll(payroll.id)
      toast.success('Payslip deleted')
      navigate('/payrolls')
    } catch (err) {
      toast.error('Could not delete payslip', err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <Loading />

  if (error) {
    return (
      <div className="page">
        <PageHeader title="Payslip" />
        <ErrorAlert title="Could not load this payslip" message={error}>
          <Button as={Link} to="/payrolls" variant="secondary" icon={ArrowLeft}>
            Back to payroll
          </Button>
        </ErrorAlert>
      </div>
    )
  }

  const basic = Number(payroll.basicSalary || 0)
  const allowances = Number(payroll.allowances || 0)
  const deductions = Number(payroll.deductions || 0)
  const net = Number(payroll.netSalary || 0)

  return (
    <div className="page">
      <PageHeader
        icon={Banknote}
        title={`Payslip #${payroll.id}`}
        subtitle={
          payroll.employee
            ? `${payroll.employee.name} · ${formatMonth(payroll.month)}`
            : `Payslip for ${formatMonth(payroll.month)}`
        }
        actions={
          <>
            <Button as={Link} to="/payrolls" variant="secondary" icon={ArrowLeft}>
              Back
            </Button>
            {isAdmin ? (
              <>
                {payroll.status !== 'PAID' ? (
                  <Button variant="success" icon={BadgeCheck} onClick={handleMarkPaid} loading={paying}>
                    Mark as paid
                  </Button>
                ) : null}
                <Button as={Link} to={`/payrolls/${payroll.id}/edit`} variant="secondary" icon={Pencil}>
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
        {/* ---- Net pay headline + the arithmetic ---- */}
        <Card>
          <CardBody>
            <div className="summary-strip">
              <div>
                <div className="summary-strip__label">Net pay · {formatMonth(payroll.month)}</div>
                <div className="summary-strip__value">{formatAmount(net)}</div>
              </div>
              <Badge status={payroll.status} />
            </div>

            <dl className="detail-list" style={{ marginTop: 'var(--space-5)' }}>
              <div className="detail-row">
                <dt>Basic salary</dt>
                <dd className="amount">{formatAmount(basic)}</dd>
              </div>
              <div className="detail-row">
                <dt>Allowances</dt>
                <dd className="amount amount--positive">+ {formatAmount(allowances)}</dd>
              </div>
              <div className="detail-row">
                <dt>Deductions</dt>
                <dd className="amount amount--muted">− {formatAmount(deductions)}</dd>
              </div>
              <div className="detail-row">
                <dt>
                  <strong>Net salary</strong>
                </dt>
                <dd className="amount">{formatAmount(net)}</dd>
              </div>
            </dl>

            <p className="text-subtle" style={{ marginTop: 'var(--space-3)' }}>
              Net salary is calculated by payroll-service, not sent by the browser.
            </p>
          </CardBody>
        </Card>

        {/* ---- Payment + employee ---- */}
        <Card>
          <CardHeader title="Payment" subtitle="Set when the payslip is marked paid" icon={BadgeCheck} />
          <CardBody>
            <dl className="detail-list">
              <div className="detail-row">
                <dt>Status</dt>
                <dd>
                  <Badge status={payroll.status} />
                </dd>
              </div>
              <div className="detail-row">
                <dt>Payroll month</dt>
                <dd>{formatMonth(payroll.month)}</dd>
              </div>
              <div className="detail-row">
                <dt>Payment date</dt>
                <dd>{payroll.paymentDate ? formatDate(payroll.paymentDate) : 'Not paid yet'}</dd>
              </div>
            </dl>

            {payroll.status !== 'PAID' ? (
              <div className="alert alert--info" style={{ marginTop: 'var(--space-4)' }}>
                <BadgeCheck size={17} aria-hidden="true" />
                <div className="alert__body">
                  This payslip is still <strong>PENDING</strong>. Marking it paid stamps today's date and locks the
                  transition on the backend.
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Employee"
            subtitle="Fetched live from employee-service over OpenFeign"
            icon={UserRound}
          />
          <CardBody>
            {payroll.employee ? (
              <>
                <div className="row" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                  <span className="avatar avatar--lg" aria-hidden="true">
                    {initials(payroll.employee.name)}
                  </span>
                  <div className="grow">
                    <h3>{payroll.employee.name}</h3>
                    <p className="text-muted" style={{ margin: 0 }}>
                      {payroll.employee.department}
                    </p>
                  </div>
                </div>

                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>Email</dt>
                    <dd>{payroll.employee.email}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Department</dt>
                    <dd>{payroll.employee.department}</dd>
                  </div>
                </dl>

                <Button
                  as={Link}
                  to={`/employees/${payroll.employee.id}`}
                  variant="secondary"
                  block
                  style={{ marginTop: 'var(--space-4)' }}
                >
                  View full profile
                </Button>
              </>
            ) : (
              <div className="alert alert--warning">
                <Building2 size={17} aria-hidden="true" />
                <div className="alert__body">
                  <p className="alert__title">Employee details unavailable</p>
                  The payslip is stored against employee id {payroll.employeeId}, but employee-service could not be
                  reached to load their profile.
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
