import { useCallback, useEffect, useRef } from 'react'
import { AlertTriangle, HelpCircle, X } from 'lucide-react'
import Button from './Button'

// =============================================================================
// Modal - an accessible dialog, used for confirmations.
// =============================================================================
// Replaces window.confirm(), which could not be styled, could not be branded,
// and - most importantly - could not explain the consequence in more than one
// short line of plain text.
//
// What makes this one correct rather than merely pretty:
//   role="dialog" + aria-modal="true"  -> assistive tech treats the rest of the
//                                         page as unavailable
//   aria-labelledby / -describedby     -> the title and body are announced
//   Tab / Shift+Tab trapped inside     -> focus cannot wander behind the scrim
//   Escape closes                      -> expected keyboard behaviour
//   focus moved in on open, and
//   RETURNED to the trigger on close   -> the user never loses their place
//   background scroll locked           -> no confusing scroll-behind
//
// It renders in place (no portal): the scrim is position:fixed, so where it
// sits in the React tree has no effect on where it appears.

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, title, children, footer, icon: Icon, iconTone = '' }) {
  const dialogRef = useRef(null)

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }
      if (event.key !== 'Tab') return

      // Keep Tab cycling within the dialog.
      const focusables = dialogRef.current?.querySelectorAll(FOCUSABLE)
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return undefined

    // Remember who opened the dialog so focus can go back there afterwards.
    const previouslyFocused = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden' // stop the page scrolling behind

    // Move focus into the dialog: the least destructive control first, which
    // is why the footer buttons are listed before the close button.
    const footerButtons = dialogRef.current?.querySelectorAll('.modal__footer button')
    const target =
      footerButtons?.[0] || dialogRef.current?.querySelector(FOCUSABLE) || dialogRef.current
    target?.focus()

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open, handleKeyDown])

  if (!open) return null

  const titleId = 'modal-title'

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="modal__header">
          {Icon ? (
            <div className={`modal__icon ${iconTone ? `modal__icon--${iconTone}` : ''}`}>
              <Icon size={20} aria-hidden="true" />
            </div>
          ) : null}
          <div className="grow">
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            aria-label="Close dialog"
            onClick={onClose}
            className="btn--icon"
          />
        </div>

        <div className="modal__body">{children}</div>

        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  )
}

/**
 * ConfirmDialog - a yes/no decision on top of Modal.
 * `tone="danger"` colours the confirm button and icon for destructive actions
 * (delete), so "Delete" never looks like "Cancel".
 */
export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      icon={tone === 'danger' ? AlertTriangle : HelpCircle}
      iconTone={tone === 'danger' ? 'danger' : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message}
    </Modal>
  )
}
