import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Clock, Pencil, Timer, Trash2, UserRound } from 'lucide-react'

import { deleteAttendance, getAttendanceRecord, markCheckOut } from '../api/attendanceApi'
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
// AttendanceDetail = GET /api/attendance/{id}.
// =============================================================================
// Another example of API composition: one JSON containing attendance data
// (attendance_db) AND employee data (fetched live by attendance-service from
// employee-service via Feign). We render both.

function toMinutes(time) {
  if (!time) return null
  const [h, m] = String(time).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function workedHours(checkIn, checkOut) {
  const start = toMinutes(checkIn)
  const end = toMinutes(checkOut)
  if (start == null || end == null || end < start) return null
  return (end - start) / 60
}

export default function AttendanceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  // Attendance is ADMIN-managed; HR/EMPLOYEE view records only. Check-out is
  // a PATCH write, so it is ADMIN-only as well.
  const { isAdmin } = useAuth()

  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleCheckOut() {
    const now = new Date()
    const checkOut = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setCheckingOut(true)
    try {
      const updated = await markCheckOut(record.id, checkOut)
      setRecord(updated) // no refetch needed - the response IS the new state
      toast.success('Checked out', `Check-out recorded at ${checkOut}.`)
    } catch (err) {
      toast.error('Could not check out', err.message)
    } finally {
      setCheckingOut(false)
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete attendance record?',
      message: 'This record will be permanently removed from attendance_db. This cannot be undone.',
      confirmLabel: 'Delete record',
      tone: 'danger',
    })
    if (!ok) return

    setDeleting(true)
    try {
      await deleteAttendance(record.id)
      toast.success('Attendance record deleted')
      navigate('/attendance')
    } catch (err) {
      toast.error('Could not delete record', err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <Loading />

  if (error) {
    return (
      <div className="page">
        <PageHeader title="Attendance record" />
        <ErrorAlert title="Could not load this record" message={error}>
          <Button as={Link} to="/attendance" variant="secondary" icon={ArrowLeft}>
            Back to attendance
          </Button>
        </ErrorAlert>
      </div>
    )
  }

  const hours = workedHours(record.checkIn, record.checkOut)
  const canCheckOut = record.status === 'PRESENT' && !record.checkOut

  return (
    <div className="page">
      <PageHeader
        icon={Clock}
        title={`Attendance #${record.id}`}
        subtitle={
          record.employee ? `${record.employee.name} · ${formatDate(record.attendanceDate)}` : formatDate(record.attendanceDate)
        }
        actions={
          <>
            <Button as={Link} to="/attendance" variant="secondary" icon={ArrowLeft}>
              Back
            </Button>
            {isAdmin ? (
              <>
                {canCheckOut ? (
                  <Button variant="primary" icon={Timer} onClick={handleCheckOut} loading={checkingOut}>
                    Check out now
                  </Button>
                ) : null}
                <Button as={Link} to={`/attendance/${record.id}/edit`} variant="secondary" icon={Pencil}>
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
        <Card>
          <CardBody>
            <div className="summary-strip">
              <div>
                <div className="summary-strip__label">Worked</div>
                <div className="summary-strip__value">{hours != null ? `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} h` : '—'}</div>
              </div>
              <div>
                <div className="summary-strip__label">Status</div>
                <div style={{ marginTop: 6 }}>
                  <Badge status={record.status} />
                </div>
              </div>
            </div>

            <dl className="detail-list" style={{ marginTop: 'var(--space-5)' }}>
              <div className="detail-row">
                <dt>Date</dt>
                <dd>{formatDate(record.attendanceDate)}</dd>
              </div>
              <div className="detail-row">
                <dt>Check in</dt>
                <dd className="mono">{record.checkIn || '—'}</dd>
              </div>
              <div className="detail-row">
                <dt>Check out</dt>
                <dd className="mono">{record.checkOut || 'Not yet'}</dd>
              </div>
            </dl>

            {/* Explain the disabled action rather than just hiding it. */}
            {record.status !== 'PRESENT' && !record.checkOut ? (
              <div className="alert alert--info" style={{ marginTop: 'var(--space-4)' }}>
                <Clock size={17} aria-hidden="true" />
                <div className="alert__body">
                  Check-out only applies to records marked <strong>PRESENT</strong>. This one is{' '}
                  <strong>{record.status}</strong>.
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
            {record.employee ? (
              <>
                <div className="row" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                  <span className="avatar avatar--lg" aria-hidden="true">
                    {initials(record.employee.name)}
                  </span>
                  <div className="grow">
                    <h3>{record.employee.name}</h3>
                    <p className="text-muted" style={{ margin: 0 }}>
                      {record.employee.department}
                    </p>
                  </div>
                </div>

                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>Email</dt>
                    <dd>{record.employee.email}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Department</dt>
                    <dd>{record.employee.department}</dd>
                  </div>
                </dl>

                <Button
                  as={Link}
                  to={`/employees/${record.employee.id}`}
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
                  The record is stored against employee id {record.employeeId}, but employee-service could not be
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
