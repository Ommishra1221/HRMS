import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CalendarDays, CalendarPlus, CalendarRange, Save } from 'lucide-react'

import useEmployees from '../hooks/useEmployees'
import { useAuth } from '../context/AuthContext'
import { createLeave, getLeave, updateLeave } from '../api/leaveApi'
import { ErrorAlert, Loading } from '../components/common/Loading'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Field from '../components/common/Field'
import { useToast } from '../components/common/Toast'

const LEAVE_TYPES = ['SICK', 'CASUAL', 'EARNED']
const EMPTY = { employeeId: '', leaveType: '', fromDate: '', toDate: '', reason: '' }

// =============================================================================
// LeaveFormPage - serves /leaves/new (apply) and /leaves/:id/edit.
// =============================================================================
// KEY MICROSERVICE MOMENT: the employee dropdown is populated from
// GET /api/employees (Gateway -> employee-service), while the leave itself is
// saved through GET/POST /api/leaves (Gateway -> leave-service).
// The browser sees ONE origin; two microservices cooperate behind the gateway.
//
// NEW: as soon as both dates are valid the form reports how many days the
// request covers. That number is the one thing a person applying for leave
// actually cares about, and it used to require counting on your fingers.

/** Inclusive day count between two "yyyy-MM-dd" strings. */
function daysBetween(from, to) {
  if (!from || !to || to < from) return null
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.round((end - start) / 86400000) + 1
}

export default function LeaveFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()

  // OWNERSHIP FROM THE TOKEN, NOT THE FORM: an EMPLOYEE always files leave
  // under their own employee record (the JWT's employeeId claim, surfaced by
  // AuthContext). The employeeId picker never appears in their UI, and the
  // backend re-verifies the submitted id against the token anyway. Only ADMIN
  // picks an employee from the directory dropdown.
  const { isAdmin, isEmployee, employeeId: myEmployeeId } = useAuth()
  const employeeMode = Boolean(isEmployee)

  // Employee list for the dropdown - ADMIN only. An EMPLOYEE token gets 403
  // from GET /api/employees, so the hook is disabled in employee mode.
  const { employees, loading: employeesLoading, error: employeesError, refresh: refreshEmployees } =
    useEmployees(!employeeMode)

  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [initializing, setInitializing] = useState(isEdit)
  const [loadError, setLoadError] = useState(null)
  // The loaded request's lifecycle status (edit mode only) - drives the
  // "only PENDING can change" guard for employees.
  const [loadedStatus, setLoadedStatus] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  // EDIT mode: prefill from the existing leave.
  useEffect(() => {
    if (!isEdit) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const leave = await getLeave(id)
        if (!cancelled) {
          // EMPLOYEE with a tampered/foreign URL: the backend would 403 the
          // save - fail fast here with a clear message instead.
          if (employeeMode && leave.employeeId !== myEmployeeId) {
            setLoadError('This leave request does not belong to your account.')
            return
          }
          setLoadedStatus(leave.status)
          setValues({
            employeeId: String(leave.employeeId), // <select> values are strings
            leaveType: leave.leaveType,
            fromDate: leave.fromDate, // backend sends "yyyy-MM-dd" - exactly what <input type="date"> wants
            toDate: leave.toDate,
            reason: leave.reason || '',
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
    setValues((prev) => ({ ...prev, [name]: value }))
    // Clear a field's error as soon as the user starts fixing it - leaving a
    // stale red message under a corrected field is its own kind of bug.
    setErrors((prev) => (prev[name] ? { ...prev, [name]: null } : prev))
  }

  function validate() {
    const errs = {}
    // In employee mode the id comes from the JWT - there is no field to check.
    if (!employeeMode && !values.employeeId) errs.employeeId = 'employeeId is required'
    if (!values.leaveType) errs.leaveType = 'leaveType is required'
    if (!values.fromDate) errs.fromDate = 'fromDate is required'
    if (!values.toDate) errs.toDate = 'toDate is required'
    if (values.fromDate && values.toDate && values.toDate < values.fromDate) {
      errs.toDate = 'toDate must be on or after fromDate'
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      // Move focus to the first invalid field so keyboard users are not left
      // hunting for what went wrong.
      const firstInvalid = ['employeeId', 'leaveType', 'fromDate', 'toDate'].find((k) => errs[k])
      if (firstInvalid) document.getElementById(firstInvalid)?.focus()
      return
    }

    setSubmitting(true)
    setServerError(null)
    // Payload matches LeaveRequest EXACTLY. employeeId must be a NUMBER
    // (backend Long); select values are strings -> convert.
    const payload = {
      // EMPLOYEE: their own id from the JWT. ADMIN: the picked directory entry.
      employeeId: employeeMode ? myEmployeeId : Number(values.employeeId),
      leaveType: values.leaveType,
      fromDate: values.fromDate,
      toDate: values.toDate,
      reason: values.reason.trim(),
    }

    try {
      if (isEdit) {
        await updateLeave(id, payload)
        toast.success('Leave request updated')
      } else {
        await createLeave(payload) // backend sets status = PENDING
        toast.success('Leave request submitted', 'It is now pending approval.')
      }
      navigate('/leaves')
    } catch (err) {
      // e.g. "Employee not found with id: 999 (checked in employee-service)"
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const duration = useMemo(() => daysBetween(values.fromDate, values.toDate), [values.fromDate, values.toDate])

  // EMPLOYEE lifecycle guard: only PENDING requests may be edited/withdrawn.
  const pendingLocked = isEdit && employeeMode && loadedStatus !== 'PENDING'

  if (initializing || (!employeeMode && employeesLoading)) return <Loading />

  if (loadError) {
    return (
      <div className="page">
        <PageHeader title="Edit leave request" />
        <ErrorAlert title="Could not load this request" message={loadError} />
      </div>
    )
  }

  if (!employeeMode && employeesError) {
    // No employee list -> the dropdown cannot be filled -> block the form.
    return (
      <div className="page">
        <PageHeader title={isEdit ? 'Edit leave request' : 'Apply for leave'} />
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
        icon={isEdit ? CalendarDays : CalendarPlus}
        title={isEdit ? 'Edit leave request' : 'Apply for leave'}
        subtitle="Leave is stored in leave_db; the employee is validated against employee-service."
        actions={
          <Button as={Link} to="/leaves" variant="secondary" icon={ArrowLeft}>
            Back to leave
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
          {employeeMode ? (
            // EMPLOYEE: no id picker. The request is filed under the signed-in
            // user's own record, resolved server-side from the JWT.
            <Field label="Employee" htmlFor="employeeId" hint="Filed under your own employee record.">
              <input id="employeeId" value="You (own employee record)" readOnly />
            </Field>
          ) : (
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
          )}

          <Field
            label="Leave type"
            htmlFor="leaveType"
            error={errors.leaveType}
            required
            hint="Sick, casual or earned."
          >
            <select id="leaveType" name="leaveType" value={values.leaveType} onChange={handleChange}>
              <option value="">Select type…</option>
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <Field label="From date" htmlFor="fromDate" error={errors.fromDate} required>
            <input id="fromDate" name="fromDate" type="date" value={values.fromDate} onChange={handleChange} />
          </Field>

          <Field
            label="To date"
            htmlFor="toDate"
            error={errors.toDate}
            required
            hint="Inclusive - the last day of leave."
          >
            <input id="toDate" name="toDate" type="date" value={values.toDate} onChange={handleChange} />
          </Field>

          <Field
            label="Reason"
            htmlFor="reason"
            error={errors.reason}
            full
            hint="Optional, but helpful for whoever reviews the request."
          >
            <textarea
              id="reason"
              name="reason"
              rows={3}
              value={values.reason}
              onChange={handleChange}
              placeholder="e.g. Family function out of town"
            />
          </Field>
        </div>

        {/* Live feedback: the one number the applicant actually cares about. */}
        {duration ? (
          <div className="alert alert--info" role="status">
            <CalendarRange size={17} aria-hidden="true" />
            <div className="alert__body">
              This request covers <strong>{duration}</strong> day{duration === 1 ? '' : 's'} and will be submitted
              with a <strong>PENDING</strong> status.
            </div>
          </div>
        ) : null}

        {pendingLocked ? (
          <div className="alert alert--warning" role="status">
            <AlertTriangle size={17} aria-hidden="true" />
            <div className="alert__body">
              <p className="alert__title">Only pending requests can be changed</p>
              This request is {loadedStatus}; it can no longer be edited or withdrawn.
            </div>
          </div>
        ) : null}

        <div className="form-actions">
          <Button type="submit" variant="primary" icon={Save} loading={submitting} disabled={pendingLocked}>
            {isEdit ? 'Save changes' : 'Submit request'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/leaves')} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
