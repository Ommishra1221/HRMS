import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useEmployees from '../hooks/useEmployees'
import { createAttendance, getAttendanceRecord, updateAttendance } from '../api/attendanceApi'
import { Loading, ErrorAlert } from '../components/common/Loading'

const STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'WFH']
const EMPTY = { employeeId: '', attendanceDate: '', status: '', checkIn: '', checkOut: '' }

// AttendanceFormPage serves /attendance/new (mark) and /attendance/:id/edit.
//
// SAME MICROSERVICE MOMENT as LeaveFormPage: the employee dropdown is
// populated from GET /api/employees (Gateway -> employee-service), while the
// attendance record itself is saved through /api/attendance (Gateway ->
// attendance-service). The browser sees ONE origin; two microservices
// cooperate behind the gateway.
export default function AttendanceFormPage() {
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

  // EDIT mode: prefill from the existing record.
  useEffect(() => {
    if (!isEdit) return
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
    return () => { cancelled = true }
  }, [id, isEdit])

  function handleChange(e) {
    const { name, value } = e.target
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function validate() {
    const errs = {}
    if (!values.employeeId) errs.employeeId = 'employeeId is required'
    if (!values.attendanceDate) errs.attendanceDate = 'attendanceDate is required'
    if (!values.status) errs.status = 'status is required'
    // Mirror of the backend rule: a PRESENT day needs a check-in time.
    if (values.status === 'PRESENT' && !values.checkIn) {
      errs.checkIn = 'checkIn is required when status is PRESENT'
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
    if (Object.keys(errs).length > 0) return
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
      if (isEdit) await updateAttendance(id, payload)
      else await createAttendance(payload)
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
  if (loadError) return <ErrorAlert message={loadError} />
  if (employeesError) {
    // No employee list -> the dropdown cannot be filled -> block the form.
    return <ErrorAlert message={`Cannot load employees: ${employeesError}`} onRetry={refreshEmployees} />
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>{isEdit ? 'Edit Attendance' : 'Mark Attendance'}</h2>
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
          <label htmlFor="attendanceDate">Date</label>
          <input id="attendanceDate" name="attendanceDate" type="date" value={values.attendanceDate} onChange={handleChange} />
          {errors.attendanceDate && <p className="field-error">{errors.attendanceDate}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" value={values.status} onChange={handleChange}>
            <option value="">Select status…</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          {errors.status && <p className="field-error">{errors.status}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="checkIn">Check In (required for PRESENT)</label>
          <input id="checkIn" name="checkIn" type="time" value={values.checkIn} onChange={handleChange} />
          {errors.checkIn && <p className="field-error">{errors.checkIn}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="checkOut">Check Out (optional)</label>
          <input id="checkOut" name="checkOut" type="time" value={values.checkOut} onChange={handleChange} />
          {errors.checkOut && <p className="field-error">{errors.checkOut}</p>}
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
