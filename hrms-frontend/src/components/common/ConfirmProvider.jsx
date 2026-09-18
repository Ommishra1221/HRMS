import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { ConfirmDialog } from './Modal'

// =============================================================================
// ConfirmProvider / useConfirm - confirmations as a promise.
// =============================================================================
// Deleting an employee used to be:
//
//     if (!window.confirm(`Delete "${name}"?`)) return
//
// ...which cannot be styled and cannot show a warning for a destructive row.
// This provider turns the same idea into an awaitable call:
//
//     const confirm = useConfirm()
//     if (!(await confirm({ title: 'Delete employee?', message: ..., tone: 'danger' })))
//       return
//
// Behind the scenes each call stores a `resolve` function in a ref. Clicking
// Confirm or Cancel calls it, which settles the promise the page is awaiting.
// One dialog instance serves the whole app.

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null) // the options of the open dialog
  const resolverRef = useRef(null) //          its promise resolver

  const confirm = useCallback((options = {}) => {
    // If a dialog is somehow already open, resolve it as "cancelled" first so
    // the earlier await never hangs forever.
    resolverRef.current?.(false)
    setRequest(options)
    return new Promise((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = useCallback((result) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setRequest(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={Boolean(request)}
        title={request?.title}
        message={request?.message}
        confirmLabel={request?.confirmLabel}
        cancelLabel={request?.cancelLabel}
        tone={request?.tone}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  )
}

/**
 * useConfirm() -> (options) => Promise<boolean>
 * Resolves true when the user confirms, false when they cancel or press Escape.
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
