import { cloneElement, isValidElement, useId } from 'react'
import { AlertCircle, HelpCircle } from 'lucide-react'

// =============================================================================
// Field - one form field: label + control + hint + inline error.
// =============================================================================
// The reason this exists is accessibility, not looks. For every field it wires
// up, automatically:
//
//   <label for="email">          -> clicking the label focuses the control
//   aria-invalid="true"          -> the control is marked invalid, not just red
//   aria-describedby="email-err" -> the error is READ OUT as part of the field
//   id="email-err"               -> ...because the error text carries that id
//
// This matters because "red border, no programmatic signal" is invisible to
// anyone using a screen reader, and colour-only status fails WCAG 1.4.1.
//
// The child element is cloned so the attributes land on the real <input>,
// which means pages stay readable:
//
//   <Field label="Email" htmlFor="email" error={errors.email} required>
//     <input id="email" name="email" value={...} onChange={...} />
//   </Field>

export default function Field({
  label,
  htmlFor,
  children,
  error,
  hint,
  required = false,
  full = false,
  className = '',
}) {
  // useId keeps ids unique even if two forms are on the page at once.
  const uid = useId()
  const controlId = htmlFor || `field-${uid}`
  const errorId = `${controlId}-error`
  const hintId = `${controlId}-hint`

  // Build the list of things that describe this control.
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  // Clone the control to inject the ARIA wiring. Only a single element child
  // can be cloned - anything else is rendered as-is.
  let control = children
  if (isValidElement(children)) {
    control = cloneElement(children, {
      id: children.props.id || controlId,
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': describedBy || undefined,
      'aria-required': required || undefined,
    })
  }

  return (
    <div className={`form-field ${full ? 'form-field--full' : ''} ${className}`}>
      {label ? (
        <label htmlFor={controlId}>
          {label}
          {required ? (
            <span className="req" aria-hidden="true">
              *
            </span>
          ) : null}
          {required ? <span className="sr-only">(required)</span> : null}
        </label>
      ) : null}

      {control}

      {hint && !error ? (
        <p className="field-hint" id={hintId}>
          <HelpCircle size={13} aria-hidden="true" />
          {hint}
        </p>
      ) : null}

      {/* Errors sit directly under their field, never only at the top of the
          form, so the user does not have to hunt for what went wrong. */}
      {error ? (
        <p className="field-error" id={errorId}>
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
