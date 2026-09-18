import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CalendarRange, Pencil, Trash2, UserRound } from 'lucide-react'

import { deleteLeave, getLeave } from '../api/leaveApi'
import { useAuth } from '../context/AuthContext'
import { ErrorAlert, Loading } from '../components/common/Loading'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/Toast'
import { formatDate, initials } from '../utils/format'

// =============================================================================
// LeaveDetail = GET /api/leaves/{id}.
// =============================================================================
// The response is a beautiful example of API composition: one JSON containing
// leave data (leave_db) AND employee data (fetched live by leave-service
// from employee-service via Feign). We simply render both.

/** Inclusive day count between two "yyyy-MM-dd" strings. */
function daysBetween(from, to) {
  if (!from || !to) return null
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return Math.round((end - start) / 86400000) + 1
}

export default function LeaveDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { isAdmin, isEmployee } = useAuth()
  // Same rule as the list: ADMIN any row; EMPLOYEE own PENDING rows only
  // (the backend scopes their list, and re-verifies ownership on the API).
  const canEdit = isAdmin || (isEmployee && leave?.status === 'PENDING')

  const [leave, setLeave] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)

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
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete leave request?',
      message: 'This request will be permanently removed from leave_db. This cannot be undone.',
      confirmLabel: 'Delete request',
      tone: 'danger',
    })
    if (!ok) return

    setDeleting(true)
    try {
      await deleteLeave(leave.id)
      toast.success('Leave request deleted')
      navigate('/leaves')
    } catch (err) {
      toast.error('Could not delete request', err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <Loading />

  if (error) {
    return (
      <div className="page">
        <PageHeader title="Leave request" />
        <ErrorAlert title="Could not load this request" message={error}>
          <Button as={Link} to="/leaves" variant="secondary" icon={ArrowLeft}>
            Back to leave
          </Button>
        </ErrorAlert>
      </div>
    )
  }

  const days = daysBetween(leave.fromDate, leave.toDate)

  return (
    <div className="page">
      <PageHeader
        icon={CalendarDays}
        title={`Leave request #${leave.id}`}
        subtitle={leave.employee ? `Applied by ${leave.employee.name}` : `Employee id ${leave.employeeId}`}
        actions={
          <>
            <Button as={Link} to="/leaves" variant="secondary" icon={ArrowLeft}>
              Back
            </Button>
            {canEdit ? (
              <>
                <Button as={Link} to={`/leaves/${leave.id}/edit`} variant="secondary" icon={Pencil}>
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
        {/* ---- The headline: how long, and is it approved ---- */}
        <Card>
          <CardBody>
            <div className="summary-strip">
              <div>
                <div className="summary-strip__label">Duration</div>
                <div className="summary-strip__value">{days ? `${days} day${days === 1 ? '' : 's'}` : '—'}</div>
              </div>
              <div>
                <div className="summary-strip__label">Status</div>
                <div style={{ marginTop: 6 }}>
                  <Badge status={leave.status} />
                </div>
              </div>
            </div>

            <dl className="detail-list" style={{ marginTop: 'var(--space-5)' }}>
              <div className="detail-row">
                <dt>Leave type</dt>
                <dd>{leave.leaveType}</dd>
              </div>
              <div className="detail-row">
                <dt>From</dt>
                <dd>{formatDate(leave.fromDate)}</dd>
              </div>
              <div className="detail-row">
                <dt>To</dt>
                <dd>{formatDate(leave.toDate)}</dd>
              </div>
              <div className="detail-row">
                <dt>Reason</dt>
                <dd>{leave.reason || '—'}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* ---- Employee, composed via Feign ---- */}
        <Card>
          <CardHeader
            title="Employee"
            subtitle="Fetched live from employee-service over OpenFeign"
            icon={UserRound}
          />
          <CardBody>
            {leave.employee ? (
              <>
                <div className="row" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                  <span className="avatar avatar--lg" aria-hidden="true">
                    {initials(leave.employee.name)}
                  </span>
                  <div className="grow">
                    <h3>{leave.employee.name}</h3>
                    <p className="text-muted" style={{ margin: 0 }}>
                      {leave.employee.department}
                    </p>
                  </div>
                </div>

                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>Email</dt>
                    <dd>{leave.employee.email}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Department</dt>
                    <dd>{leave.employee.department}</dd>
                  </div>
                </dl>

                <Button
                  as={Link}
                  to={`/employees/${leave.employee.id}`}
                  variant="secondary"
                  block
                  style={{ marginTop: 'var(--space-4)' }}
                >
                  View full profile
                </Button>
              </>
            ) : (
              // A failed Feign lookup is not an error state for the whole page -
              // the leave record itself loaded fine, so say exactly that.
              <div className="alert alert--warning">
                <CalendarRange size={17} aria-hidden="true" />
                <div className="alert__body">
                  <p className="alert__title">Employee details unavailable</p>
                  The request is stored against employee id {leave.employeeId}, but employee-service could not be
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
