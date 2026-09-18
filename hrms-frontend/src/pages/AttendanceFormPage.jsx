import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Clock, ClockPlus, Save, Timer } from 'lucide-react'

import useEmployees from '../hooks/useEmployees'
import { createAttendance, getAttendanceRecord, updateAttendance } from '../api/attendanceApi'
import { ErrorAlert, Loading } from '../components/common/Loading'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Field from '../components/common/Field'
import { useToast } from '../components/common/Toast'
import { todayISO } from '../utils/format'

const STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'WFH']
const EMPTY = { employeeId: '', attendanceDate: '', status: '', checkIn: '', checkOut: '' }

/** Current local time as "HH:mm" - what <input type="time"> expects. */
function nowTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

// =============================================================================
// AttendanceFormPage - serves /attendance/new (mark) and /attendance/:id/edit.
// =============================================================================
// SAME MICROSERVICE MOMENT as LeaveFormPage: the employee dropdown is
// populated from GET /api/employees (Gateway -> employee-service), while the
// attendance record itself is saved through /api/attendance (Gateway ->
// attendance-service). The browser sees ONE origin; two microservices
// cooperate behind the gateway.
//
// NEW: the form adapts to the chosen status. A PRESENT day needs a check-in,
// an ABSENT day does not - so the time fields are only marked required (and
// only validated) when they actually apply, and "Now" buttons fill the
// current time in one tap.

export default function AttendanceFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()

  // Employee list for the dropdown (reuses the same hook as EmployeeList!)
  const { employees, loading: employeesLoading, error: employeesError, refresh: refreshEmployees } =
    useEmployees()

  const [values, setValues] = useState({ ...EMPTY, attendanceDate: isEdit ? '' : todayISO() })
  const [errors, setErrors] = useState({})
  const [initializing, setInitializing] = useState(isEdit)
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  // EDIT mode: prefill from the existing record.
  useEffect(() => {
    if (!isEdit) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const record = await getAttendanceRecord(id)
        if (!cancelled) {
          setValues({
            employeeId: String(record.employeeId), // <select> values are strings
            attendanceDate: record.attendanceDate, // backend sends "yyyy-MM-dd" - what <input type="date"> wants
            status: record.status,
            checkIn: record.checkIn || '',
            checkOut: record.checkOut || '',
          })
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message)
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isEdit])

  function handleChange(e) {
    const { name, value } = e.target
    setValues((prev) => {
      const next = { ...prev, [name]: value }
      // Choosing a non-working status clears the times, so a stale 09:00 cannot
      // end up stored against an ABSENT day.
      if (name === 'status' && value !== 'PRESENT' && value !== 'HALF_DAY') {
        next.checkIn = ''
        next.checkOut = ''
      }
      return next
    })
    setErrors((prev) => (prev[name] ? { ...prev, [name]: null } : prev))
  }

  function fillTime(field) {
    setValues((prev) => ({ ...prev, [field]: nowTime() }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }

  // Times are only meaningful for statuses that involve working.
  const timeApplies = values.status === 'PRESENT' || values.status === 'HALF_DAY'

  function validate() {
    const errs = {}
    if (!values.employeeId) errs.employeeId = 'employeeId is required'
    if (!values.attendanceDate) errs.attendanceDate = 'attendanceDate is required'
    if (!values.status) errs.status = 'status is required'

    if (timeApplies && !values.checkIn) {
      errs.checkIn = `checkIn is required when status is ${values.status}`
    }
    if (values.checkIn && values.checkOut && values.checkOut < values.checkIn) {
      errs.checkOut = 'checkOut cannot be before checkIn'
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const firstInvalid = ['employeeId', 'attendanceDate', 'status', 'checkIn', 'checkOut'].find((k) => errs[k])
      if (firstInvalid) document.getElementById(firstInvalid)?.focus()
      return
    }

    setSubmitting(true)
    setServerError(null)
    // Payload matches AttendanceRequest EXACTLY. employeeId must be a NUMBER
    // (backend Long); select values are strings -> convert. Empty optional
    // fields are sent as null so the backend stores NULL, not "".
    const payload = {
      employeeId: Number(values.employeeId),
      attendanceDate: values.attendanceDate,
      status: values.status,
      checkIn: values.checkIn || null,
      checkOut: values.checkOut || null,
    }

    try {
      if (isEdit) {
        await updateAttendance(id, payload)
        toast.success('Attendance updated')
      } else {
        await createAttendance(payload)
        toast.success('Attendance marked')
      }
      navigate('/attendance')
    } catch (err) {
      // e.g. "Attendance already exists for employee 1 on 2026-09-15" (409)
      // or "Employee not found with id: 999 (checked in employee-service)"
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (initializing || employeesLoading) return <Loading />

  if (loadError) {
    return (
      <div className="page">
        <PageHeader title="Edit attendance" />
        <ErrorAlert title="Could not load this record" message={loadError} />
      </div>
    )
  }

  if (employeesError) {
    // No employee list -> the dropdown cannot be filled -> block the form.
    return (
      <div className="page">
        <PageHeader title={isEdit ? 'Edit attendance' : 'Mark attendance'} />
        <ErrorAlert
          title="Cannot load employees"
          message={`The employee dropdown needs employee-service: ${employeesError}`}
          onRetry={refreshEmployees}
        />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        icon={isEdit ? Clock : ClockPlus}
        title={isEdit ? 'Edit attendance' : 'Mark attendance'}
        subtitle="Attendance is stored in attendance_db; the employee is validated against employee-service."
        actions={
          <Button as={Link} to="/attendance" variant="secondary" icon={ArrowLeft}>
            Back to attendance
          </Button>
        }
      />

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        {serverError ? (
          <div className="alert alert--error" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
            <AlertTriangle size={17} aria-hidden="true" />
            <div className="alert__body">
              <p className="alert__title">Could not save</p>
              {serverError}
            </div>
          </div>
        ) : null}

        <div className="form-grid">
          <Field
            label="Employee"
            htmlFor="employeeId"
            error={errors.employeeId}
            required
            hint="Loaded from employee-service."
          >
            <select id="employeeId" name="employeeId" value={values.employeeId} onChange={handleChange}>
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.department}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Date"
            htmlFor="attendanceDate"
            error={errors.attendanceDate}
            required
            hint="One record per employee per day."
          >
            <input
              id="attendanceDate"
              name="attendanceDate"
              type="date"
              value={values.attendanceDate}
              onChange={handleChange}
            />
          </Field>

          <Field
            label="Status"
            htmlFor="status"
            error={errors.status}
            required
            full
            hint="Only working statuses ask for times."
          >
            <select id="status" name="status" value={values.status} onChange={handleChange}>
              <option value="">Select status…</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Check in"
            htmlFor="checkIn"
            error={errors.checkIn}
            required={timeApplies}
            hint={timeApplies ? 'Required for this status.' : 'Not used for this status.'}
          >
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <input
                id="checkIn"
                name="checkIn"
                type="time"
                value={values.checkIn}
                onChange={handleChange}
                disabled={!timeApplies}
                style={{ flex: 1 }}
              />
              <Button
                variant="secondary"
                size="sm"
                icon={Timer}
                onClick={() => fillTime('checkIn')}
                disabled={!timeApplies}
              >
                Now
              </Button>
            </div>
          </Field>

          <Field
            label="Check out"
            htmlFor="checkOut"
            error={errors.checkOut}
            hint="Optional - can also be filled in later with one click."
          >
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <input
                id="checkOut"
                name="checkOut"
                type="time"
                value={values.checkOut}
                onChange={handleChange}
                disabled={!timeApplies}
                style={{ flex: 1 }}
              />
              <Button
                variant="secondary"
                size="sm"
                icon={Timer}
                onClick={() => fillTime('checkOut')}
                disabled={!timeApplies}
              >
                Now
              </Button>
            </div>
          </Field>
        </div>

        <div className="form-actions">
          <Button type="submit" variant="primary" icon={Save} loading={submitting}>
            {isEdit ? 'Save changes' : 'Mark attendance'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/attendance')} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
