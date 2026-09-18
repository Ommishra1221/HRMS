import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Banknote, Calculator, Save, Wallet } from 'lucide-react'

import useEmployees from '../hooks/useEmployees'
import { createPayroll, getPayroll, updatePayroll } from '../api/payrollApi'
import { ErrorAlert, Loading } from '../components/common/Loading'
import PageHeader from '../components/common/PageHeader'
import Card, { CardBody } from '../components/common/Card'
import Button from '../components/common/Button'
import Field from '../components/common/Field'
import { useToast } from '../components/common/Toast'
import { formatAmount } from '../utils/format'

const EMPTY = {
  employeeId: '',
  month: '',
  basicSalary: '',
  allowances: '0',
  deductions: '0',
}

// =============================================================================
// PayrollFormPage - serves /payrolls/new (create) and /payrolls/:id/edit.
// =============================================================================
// SAME MICROSERVICE MOMENT as LeaveFormPage / AttendanceFormPage: the employee
// dropdown is populated from GET /api/employees (Gateway -> employee-service),
// while the payslip itself is saved through /api/payroll (Gateway ->
// payroll-service). The browser sees ONE origin; two microservices cooperate
// behind the gateway.
//
// NEW: a live preview of the computed net salary. The backend is still the
// source of truth (the browser never sends netSalary), but seeing the figure
// update as you type turns "will this save what I expect?" into a yes.

export default function PayrollFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()

  // Employee list for the dropdown (reuses the same hook as EmployeeList!)
  const { employees, loading: employeesLoading, error: employeesError, refresh: refreshEmployees } =
    useEmployees()

  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [initializing, setInitializing] = useState(isEdit)
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  // EDIT mode: prefill from the existing payslip.
  useEffect(() => {
    if (!isEdit) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const payroll = await getPayroll(id)
        if (!cancelled) {
          setValues({
            employeeId: String(payroll.employeeId), // <select> values are strings
            month: payroll.month, // backend sends "yyyy-MM" - what <input type="month"> wants
            basicSalary: String(payroll.basicSalary),
            allowances: String(payroll.allowances),
            deductions: String(payroll.deductions),
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
    setErrors((prev) => (prev[name] ? { ...prev, [name]: null } : prev))
  }

  // Mirror of the backend rules (@NotNull/@NotBlank/@PositiveOrZero) -
  // instant feedback without a wasted network round-trip. The backend still
  // re-checks; client validation is UX, server validation is the real gate.
  function validate() {
    const errs = {}
    if (!values.employeeId) errs.employeeId = 'employeeId is required'

    if (!values.month) {
      errs.month = 'month is required'
    } else if (!/^\d{4}-\d{2}$/.test(values.month)) {
      errs.month = 'month must be in yyyy-MM format (e.g. 2026-09)'
    }

    for (const field of ['basicSalary', 'allowances', 'deductions']) {
      if (values[field] === '' || values[field] === null) {
        errs[field] = `${field} is required`
      } else if (Number.isNaN(Number(values[field])) || Number(values[field]) < 0) {
        errs[field] = `${field} must be zero or positive`
      }
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const firstInvalid = ['employeeId', 'month', 'basicSalary', 'allowances', 'deductions'].find((k) => errs[k])
      if (firstInvalid) document.getElementById(firstInvalid)?.focus()
      return
    }

    setSubmitting(true)
    setServerError(null)
    // Payload matches PayrollRequest EXACTLY. employeeId must be a NUMBER
    // (backend Long); select values are strings -> convert. Money fields are
    // numbers too. netSalary is NOT sent - the backend computes it, and
    // status is NOT sent - the backend sets it (new payslip = PENDING).
    const payload = {
      employeeId: Number(values.employeeId),
      month: values.month,
      basicSalary: Number(values.basicSalary),
      allowances: Number(values.allowances),
      deductions: Number(values.deductions),
    }

    try {
      if (isEdit) {
        await updatePayroll(id, payload)
        toast.success('Payslip updated')
      } else {
        await createPayroll(payload) // backend sets status = PENDING
        toast.success('Payslip created', 'It starts with a PENDING status.')
      }
      navigate('/payrolls')
    } catch (err) {
      // e.g. "Payroll already exists for employee 1 for month 2026-09" (409)
      // or "Employee not found with id: 999 (checked in employee-service)"
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Live preview - pure presentation of the same formula payroll-service uses.
  const preview = useMemo(() => {
    const basic = Number(values.basicSalary) || 0
    const allowances = Number(values.allowances) || 0
    const deductions = Number(values.deductions) || 0
    return { basic, allowances, deductions, net: basic + allowances - deductions }
  }, [values.basicSalary, values.allowances, values.deductions])

  if (initializing || employeesLoading) return <Loading />

  if (loadError) {
    return (
      <div className="page">
        <PageHeader title="Edit payslip" />
        <ErrorAlert title="Could not load this payslip" message={loadError} />
      </div>
    )
  }

  if (employeesError) {
    // No employee list -> the dropdown cannot be filled -> block the form.
    return (
      <div className="page">
        <PageHeader title={isEdit ? 'Edit payslip' : 'Create payslip'} />
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
        icon={isEdit ? Banknote : Wallet}
        title={isEdit ? 'Edit payslip' : 'Create payslip'}
        subtitle="One payslip per employee per month. Net salary is calculated by payroll-service."
        actions={
          <Button as={Link} to="/payrolls" variant="secondary" icon={ArrowLeft}>
            Back to payroll
          </Button>
        }
      />

      <div className="detail-grid">
        <form className="form-card" onSubmit={handleSubmit} noValidate style={{ maxWidth: 'none' }}>
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
              label="Payroll month"
              htmlFor="month"
              error={errors.month}
              required
              hint="The payslip can only be raised once per month per employee."
            >
              <input id="month" name="month" type="month" value={values.month} onChange={handleChange} />
            </Field>

            <Field
              label="Basic salary"
              htmlFor="basicSalary"
              error={errors.basicSalary}
              required
              hint="Gross monthly basic, before allowances."
            >
              <input
                id="basicSalary"
                name="basicSalary"
                type="number"
                min="0"
                step="0.01"
                value={values.basicSalary}
                onChange={handleChange}
                placeholder="50000"
              />
            </Field>

            <Field label="Allowances" htmlFor="allowances" error={errors.allowances} required hint="Added to basic.">
              <input
                id="allowances"
                name="allowances"
                type="number"
                min="0"
                step="0.01"
                value={values.allowances}
                onChange={handleChange}
                placeholder="0"
              />
            </Field>

            <Field
              label="Deductions"
              htmlFor="deductions"
              error={errors.deductions}
              required
              hint="Tax, provident fund, and so on."
            >
              <input
                id="deductions"
                name="deductions"
                type="number"
                min="0"
                step="0.01"
                value={values.deductions}
                onChange={handleChange}
                placeholder="0"
              />
            </Field>
          </div>

          <div className="form-actions">
            <Button type="submit" variant="primary" icon={Save} loading={submitting}>
              {isEdit ? 'Save changes' : 'Create payslip'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/payrolls')} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>

        {/* ---- Live preview ---- */}
        <Card>
          <CardBody>
            <div className="card__title" style={{ marginBottom: 'var(--space-4)' }}>
              <Calculator size={17} aria-hidden="true" />
              Net salary preview
            </div>

            <dl className="detail-list">
              <div className="detail-row">
                <dt>Basic salary</dt>
                <dd className="amount">{formatAmount(preview.basic)}</dd>
              </div>
              <div className="detail-row">
                <dt>Allowances</dt>
                <dd className="amount amount--positive">+ {formatAmount(preview.allowances)}</dd>
              </div>
              <div className="detail-row">
                <dt>Deductions</dt>
                <dd className="amount amount--muted">− {formatAmount(preview.deductions)}</dd>
              </div>
            </dl>

            <div className="summary-strip" style={{ marginTop: 'var(--space-4)' }}>
              <div>
                <div className="summary-strip__label">Net salary</div>
                <div className="summary-strip__value">{formatAmount(preview.net)}</div>
              </div>
            </div>

            <p className="text-subtle" style={{ marginTop: 'var(--space-3)' }}>
              This preview mirrors the calculation payroll-service performs. The saved figure always comes from the
              service, so the two can never disagree.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
