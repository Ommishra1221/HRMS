// =============================================================================
// Badge - the coloured status pill used by every list and detail page.
// =============================================================================
// The backend speaks in SCREAMING_SNAKE statuses (PENDING, HALF_DAY, WFH...).
// Those are correct for the database and for `badge-${status}` CSS classes,
// but ugly in the UI - so the *display* text is mapped here while the CSS
// class keeps using the raw value. One place to translate, everywhere benefits.

const STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LEAVE: 'On leave',
  HALF_DAY: 'Half day',
  WFH: 'Work from home',
  PAID: 'Paid',
}

/**
 * Human label for a raw status value.
 * Unknown values fall back to a de-underscored version of themselves so a new
 * backend status never renders as a blank pill.
 */
export function statusLabel(status) {
  if (!status) return '—'
  if (STATUS_LABELS[status]) return STATUS_LABELS[status]
  return String(status)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

export default function Badge({ status, children, dotless = false, className = '' }) {
  const cls = ['badge', `badge-${status}`, dotless ? 'badge--dotless' : '', className]
    .filter(Boolean)
    .join(' ')

  return <span className={cls}>{children ?? statusLabel(status)}</span>
}
