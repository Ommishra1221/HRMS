import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// =============================================================================
// PasswordInput - a password box with a show/hide toggle.
// =============================================================================
// Only the *value* is hidden; the field stays a normal text input underneath,
// so it remains readable when the user asks for it. This is the accessible
// alternative to masking that can never be revealed.
//
// It forwards every prop it receives onto the real <input>, which is what lets
// <Field> clone it and attach aria-invalid / aria-describedby correctly.

export default function PasswordInput({ id, ...rest }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-field">
      <input id={id} type={visible ? 'text' : 'password'} {...rest} />
      <button
        type="button"
        className="password-field__toggle"
        onClick={() => setVisible((v) => !v)}
        // The label states the ACTION and reflects state via aria-pressed.
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
  )
}

// =============================================================================
// useAutofocus - focus a field when a page opens.
// =============================================================================
// Used by the login form: focusing the first field saves a click, and focus
// order is preserved so keyboard users start in the right place.
export function useAutofocus() {
  const ref = useRef(null)
  useEffect(() => {
    // Defer a frame so the element exists after route transitions.
    const t = setTimeout(() => ref.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [])
  return ref
}
