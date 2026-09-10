// Tiny reusable building blocks. Every list page will show ONE of these
// three states: loading -> error -> data (or empty state).

export function Loading() {
  return <p className="state-message">Loading…</p>
}

export function ErrorAlert({ message, onRetry }) {
  return (
    <div className="state-message state-error" role="alert">
      <p>⚠️ {message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary">
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message, children }) {
  return (
    <div className="state-message">
      <p>{message}</p>
      {children}
    </div>
  )
}
