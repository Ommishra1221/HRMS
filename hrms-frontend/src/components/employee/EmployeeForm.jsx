import { useState } from 'react'

// EmployeeForm = one reusable form for BOTH create and edit.
//
// The parent page decides the mode:
//   create -> initialValues={}          onSubmit calls createEmployee()
//   edit   -> initialValues=employee    onSubmit calls updateEmployee(id)
//
// The fields here match the backend EmployeeRequest DTO EXACTLY:
//   { name, email, department }   - nothing more, nothing less.
// (Sending extra fields would be silently ignored by Jackson; missing
//  required ones would fail backend validation -> we prevent both.)
const EMPTY = { name: '', email: '', department: '' }

export default function EmployeeForm({ initialValues, onSubmit, submitting, serverError }) {
  const [values, setValues] = useState(initialValues || EMPTY)
  const [errors, setErrors] = useState({})

  function handleChange(e) {
    const { name, value } = e.target
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  // Mirror of the backend rules (@NotBlank/@Email) - instant feedback
  // without a wasted network round-trip. The backend still re-checks;
  // client validation is UX, server validation is the real gate.
  function validate() {
    const errs = {}
    if (!values.name.trim()) errs.name = 'name is required'
    if (!values.email.trim()) errs.email = 'email is required'
    else if (!/^\S+@\S+\.\S+$/.test(values.email)) errs.email = 'email must be a valid email address'
    if (!values.department.trim()) errs.department = 'department is required'
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
      {/* Server errors (e.g. duplicate email -> 500 unique constraint,
          or a backend validation message) show on top of the form. */}
      {serverError && <div className="state-message state-error" style={{ marginBottom: 16 }}>{serverError}</div>}

      <div className="form-field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" value={values.name} onChange={handleChange} placeholder="Asha Kumar" />
        {errors.name && <p className="field-error">{errors.name}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" value={values.email} onChange={handleChange} placeholder="asha@corp.com" />
        {errors.email && <p className="field-error">{errors.email}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="department">Department</label>
        <input id="department" name="department" value={values.department} onChange={handleChange} placeholder="Engineering" />
        {errors.department && <p className="field-error">{errors.department}</p>}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
