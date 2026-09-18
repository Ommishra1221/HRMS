import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'

// =============================================================================
// ToastProvider / useToast - non-blocking feedback.
// =============================================================================
// Replaces alert(), which froze the whole page and gave the user no context
// about which action failed. Toasts appear in the corner, never steal focus,
// and can be dismissed or left to expire.
//
// Accessibility notes:
//   - Success/info toasts are polite: announced when the screen reader is idle.
//   - Error toasts are assertive (role="alert"): something went wrong, so they
//     interrupt. This is the ONLY case where interrupting is justified.
//   - The close button is a real button with a label - not a clickable div.
//   - Toasts never contain the only copy of essential information; the page
//     state itself always reflects the change.

const ToastContext = createContext(null)

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }
const AUTO_DISMISS_MS = 5000
const MAX_VISIBLE = 4

let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // Timer handles per toast id, so a manual dismiss can cancel its timer.
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type, title, message) => {
      const id = (nextId += 1)
      // Keep the region short: drop the oldest when the cap is exceeded.
      setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { id, type, title, message }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      )
      return id
    },
    [dismiss],
  )

  // Clear any pending timers when the provider unmounts (e.g. in tests).
  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((t) => clearTimeout(t))
      map.clear()
    }
  }, [])

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
      info: (title, message) => push('info', title, message),
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* aria-live region: assistive tech watches this container for children. */}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type] || Info
          return (
            <div
              key={toast.id}
              className={`toast toast--${toast.type}`}
              // Only errors interrupt the screen reader.
              role={toast.type === 'error' ? 'alert' : 'status'}
            >
              <Icon size={18} aria-hidden="true" />
              <div className="toast__text">
                {toast.title ? <div className="toast__title">{toast.title}</div> : null}
                {toast.message ? <div className="toast__msg">{toast.message}</div> : null}
              </div>
              <button
                type="button"
                className="toast__close"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

/** useToast() -> { success, error, info, push, dismiss } */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
