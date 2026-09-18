import { useState } from 'react'
import { AlertTriangle, Save } from 'lucide-react'

import Field from '../common/Field'
import Button from '../common/Button'

// =============================================================================
// EmployeeForm - one reusable form for BOTH create and edit.
// =============================================================================
// The parent page decides the mode:
//   create -> initialValues={}          onSubmit calls createEmployee()
//   edit   -> initialValues=employee    onSubmit calls updateEmployee(id)
//
// The fields here match the backend EmployeeRequest DTO EXACTLY:
//   { name, email, department }   - nothing more, nothing less.
// (Sending extra fields would be silently ignored by Jackson; missing
//  required ones would fail backend validation -> we prevent both.)
//
// Client-side validation mirrors the backend's @NotBlank/@Email rules. It is
// UX (instant feedback, no wasted round-trip); the backend is still the real
// gate and its message is shown at the top if it disagrees.

const EMPTY = { name: '', email: '', department: '' }

export default function EmployeeForm({ initialValues, onSubmit, onCancel, submitting, serverError }) {
  const [values, setValues] = useState(initialValues || EMPTY)
  const [errors, setErrors] = useState({})

  function handleChange(e) {
    const { name, value } = e.target
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  /** Validate one field on blur so mistakes surface before submit. */
  function validateField(name, value) {
    const v = String(value ?? '')
    if (name === 'name') return v.trim() ? null : 'name is required'
    if (name === 'email') {
      if (!v.trim()) return 'email is required'
      return /^\S+@\S+\.\S+$/.test(v) ? null : 'email must be a valid email address'
    }
    if (name === 'department') return v.trim() ? null : 'department is required'
    return null
  }

  function handleBlur(e) {
    const { name, value } = e.target
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
  }

  function validate() {
    const errs = {}
    for (const key of Object.keys(EMPTY)) {
      const message = validateField(key, values[key])
      if (message) errs[key] = message
    }
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    await onSubmit({
      name: values.name.trim(),
      email: values.email.trim(),
      department: values.department.trim(),
    })
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      {/* Server errors stay at the top (they can concern the whole request),
          while field-level validation appears under each field. */}
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
          label="Full name"
          htmlFor="name"
          error={errors.name}
          required
          hint="Shown throughout the app and on reports."
        >
          <input
            id="name"
            name="name"
            value={values.name}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Asha Kumar"
            autoComplete="name"
          />
        </Field>

        <Field label="Email address" htmlFor="email" error={errors.email} required>
          <input
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="asha@corp.com"
            autoComplete="email"
          />
        </Field>

        <Field
          label="Department"
          htmlFor="department"
          error={errors.department}
          required
          hint="Used to group employees in lists and reports."
        >
          <input
            id="department"
            name="department"
            value={values.department}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Engineering"
            list="department-suggestions"
          />
        </Field>
      </div>

      {/* Suggestions only - the field stays free text because the backend
          accepts any string. */}
      <datalist id="department-suggestions">
        <option value="Engineering" />
        <option value="Human Resources" />
        <option value="Finance" />
        <option value="Sales" />
        <option value="Operations" />
      </datalist>

      <div className="form-actions">
        <Button type="submit" variant="primary" icon={Save} loading={submitting}>
          {submitting ? 'Saving…' : 'Save employee'}
        </Button>
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
