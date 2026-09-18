import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'

// =============================================================================
// The three states every data view can be in: LOADING -> ERROR -> DATA/EMPTY.
// =============================================================================
// Filename kept as Loading.jsx so every existing
// `import { Loading, ErrorAlert, EmptyState } from '../components/common/Loading'`
// keeps working.

/** Spinner for inline "working…" situations (inside buttons, small panels). */
export function Spinner({ size = 18, label = 'Loading' }) {
  return (
    <>
      <Loader2 size={size} className="spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </>
  )
}

/**
 * Loading placeholder.
 *
 * Deliberately a SKELETON rather than the words "Loading…": it reserves the
 * real layout, so when data arrives nothing jumps (keeps Cumulative Layout
 * Shift near zero). The visible text is hidden from screen readers and a
 * single polite announcement is made instead, so assistive tech hears
 * "Loading employees" once rather than reading a dozen empty boxes.
 */
export function Loading({ rows = 5, label = 'Loading…' }) {
  return (
    <div className="card" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="skeleton-rows" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="skeleton-row" key={i}>
            <div className="skeleton skeleton--circle" style={{ width: 32, height: 32, flexShrink: 0 }} />
            <div className="skeleton" style={{ flex: 2 }} />
            <div className="skeleton" style={{ flex: 1 }} />
            <div className="skeleton" style={{ flex: 1, maxWidth: 110 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Loading placeholder shaped like the KPI grid on the dashboard. */
export function LoadingCards({ count = 4 }) {
  return (
    <div className="stats-grid" role="status" aria-live="polite">
      <span className="sr-only">Loading statistics…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div className="card card--pad" key={i} aria-hidden="true">
          <div className="skeleton skeleton--circle" style={{ width: 38, height: 38, marginBottom: 14 }} />
          <div className="skeleton skeleton--title" style={{ width: '50%' }} />
          <div className="skeleton skeleton--text" style={{ width: '75%' }} />
        </div>
      ))}
    </div>
  )
}

/**
 * Error state. role="alert" makes screen readers announce it immediately,
 * because an error appearing is a change the user must know about.
 */
export function ErrorAlert({ message, title = 'Something went wrong', onRetry, children }) {
  return (
    <div className="state-message state-error" role="alert">
      <div className="state-message__icon">
        <AlertTriangle size={22} aria-hidden="true" />
      </div>
      <div>
        <p className="state-message__title">{title}</p>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-secondary">
          Try again
        </button>
      ) : null}
      {/* Callers can pass their own escape hatch (e.g. "Back to employees") -
          an error with no way out leaves the user stuck on a dead page. */}
      {children ? <div className="row row-wrap">{children}</div> : null}
    </div>
  )
}

/**
 * Empty state - "there is no data yet", never an error.
 * Framed positively with the next action, because an empty table is the
 * first thing a new user sees and it should invite, not scold.
 */
export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, children }) {
  return (
    <div className="state-message">
      <div className="state-message__icon">
        <Icon size={22} aria-hidden="true" />
      </div>
      <div>
        <p className="state-message__title">{title}</p>
        {message ? <p>{message}</p> : null}
      </div>
      {children ? <div className="row row-wrap">{children}</div> : null}
    </div>
  )
}
