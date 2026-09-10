import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useEmployees from '../hooks/useEmployees'
import { createLeave, getLeave, updateLeave } from '../api/leaveApi'
import { Loading, ErrorAlert } from '../components/common/Loading'

const LEAVE_TYPES = ['SICK', 'CASUAL', 'EARNED']
const EMPTY = { employeeId: '', leaveType: '', fromDate: '', toDate: '', reason: '' }

// LeaveFormPage serves /leaves/new (apply) and /leaves/:id/edit.
//
// KEY MICROSERVICE MOMENT: the employee dropdown is populated from
// GET /api/employees (Gateway -> employee-service), while the leave itself is
// saved through GET/POST /api/leaves (Gateway -> leave-service).
// The browser sees ONE origin; two microservices cooperate behind the gateway.
export default function LeaveFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  // Employee list for the dropdown (reuses the same hook as EmployeeList!)
  const { employees, loading: employeesLoading, error: employeesError, refresh: refreshEmployees } = useEmployees()

  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [initializing, setInitializing] = useState(isEdit)
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  // EDIT mode: prefill from the existing leave.
  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    ;(async () => {
      try {
        const leave = await getLeave(id)
        if (!cancelled) {
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
    return () => { cancelled = true }
  }, [id, isEdit])

  function handleChange(e) {
    const { name, value } = e.target
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function validate() {
    const errs = {}
    if (!values.employeeId) errs.employeeId = 'employeeId is required'
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
    if (Object.keys(errs).length > 0) return
    setSubmitting(true)
    setServerError(null)
    // Payload matches LeaveRequest EXACTLY. employeeId must be a NUMBER
    // (backend Long); select values are strings -> convert.
    const payload = {
      employeeId: Number(values.employeeId),
      leaveType: values.leaveType,
      fromDate: values.fromDate,
      toDate: values.toDate,
      reason: values.reason.trim(),
    }
    try {
      if (isEdit) await updateLeave(id, payload)
      else await createLeave(payload) // backend sets status = PENDING
      navigate('/leaves')
    } catch (err) {
      // e.g. "Employee not found with id: 999 (checked in employee-service)"
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (initializing || employeesLoading) return <Loading />
  if (loadError) return <ErrorAlert message={loadError} />
  if (employeesError) {
    // No employee list -> the dropdown cannot be filled -> block the form.
    return <ErrorAlert message={`Cannot load employees: ${employeesError}`} onRetry={refreshEmployees} />
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>{isEdit ? 'Edit Leave' : 'Apply for Leave'}</h2>
      </div>

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        {serverError && <div className="state-message state-error" style={{ marginBottom: 16 }}>{serverError}</div>}

        <div className="form-field">
          <label htmlFor="employeeId">Employee</label>
          <select id="employeeId" name="employeeId" value={values.employeeId} onChange={handleChange}>
            <option value="">Select employee…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} - {emp.department}
              </option>
            ))}
          </select>
          {errors.employeeId && <p className="field-error">{errors.employeeId}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="leaveType">Leave Type</label>
          <select id="leaveType" name="leaveType" value={values.leaveType} onChange={handleChange}>
            <option value="">Select type…</option>
            {LEAVE_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          {errors.leaveType && <p className="field-error">{errors.leaveType}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="fromDate">From Date</label>
          <input id="fromDate" name="fromDate" type="date" value={values.fromDate} onChange={handleChange} />
          {errors.fromDate && <p className="field-error">{errors.fromDate}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="toDate">To Date</label>
          <input id="toDate" name="toDate" type="date" value={values.toDate} onChange={handleChange} />
          {errors.toDate && <p className="field-error">{errors.toDate}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="reason">Reason (optional)</label>
          <textarea id="reason" name="reason" rows={3} value={values.reason} onChange={handleChange} placeholder="Short reason…" />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
