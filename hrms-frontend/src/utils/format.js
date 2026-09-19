// =============================================================================
// Formatting helpers.
// =============================================================================
// The API speaks ISO ("2026-09-15", "2026-09"); humans do not. Every page used
// to print raw ISO strings, which is one of the fastest ways to make a UI feel
// unfinished. These helpers convert once, here, so every page agrees.

/** 15000 -> "15,000" ; null/undefined -> "0" */
export function formatNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString() : '0'
}

/** Money: keeps 2 decimals only when they carry information (1500.5 -> "1,500.5"). */
export function formatAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/**
 * "2026-09-15" -> "15 Sep 2026"
 *
 * Parsed from the string parts on purpose. `new Date('2026-09-15')` is treated
 * as UTC midnight, so in a negative-offset timezone it would render as the
 * 14th - a classic off-by-one-day bug in date fields.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(iso) {
  if (!iso) return '—'
  const [year, month, day] = String(iso).split('-')
  if (!year || !month || !day) return String(iso)
  const monthName = MONTHS[Number(month) - 1] || month
  return `${Number(day)} ${monthName} ${year}`
}

/** "2026-09" -> "Sep 2026" (for the payroll month column). */
export function formatMonth(value) {
  if (!value) return '—'
  const [year, month] = String(value).split('-')
  if (!year || !month) return String(value)
  const monthName = MONTHS[Number(month) - 1] || month
  return `${monthName} ${year}`
}

/**
 * A Date as "yyyy-MM-dd" in the LOCAL timezone - what <input type="date"> wants.
 *
 * Pass the `reference` Date when the value must come from a specific instant
 * (e.g. a live clock that re-renders every second) instead of "whatever the
 * clock says right now", so every field on the screen agrees on the day.
 */
export function todayISO(reference = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${reference.getFullYear()}-${pad(reference.getMonth() + 1)}-${pad(reference.getDate())}`
}

/**
 * A Date as "10:42:25 PM" - the live clock in the topbar.
 *
 * The timezone is the viewer's own (toLocaleTimeString's default), never the
 * server's. The format is pinned to the 12-hour English clock on purpose: the
 * month names above are hardcoded English too, so the UI stays consistent
 * instead of switching to "22:42" or "10:42:25 pm" per locale.
 */
export function formatTime(reference = new Date()) {
  return reference.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

/** "2026-09-15" -> "2026-09" (used to group payslips by month). */
export function monthKey(iso) {
  return iso ? String(iso).slice(0, 7) : ''
}

/**
 * Initials for an avatar: "Om Mishra" -> "OM", "admin" -> "AD".
 * Always returns something printable so the avatar is never empty.
 */
export function initials(userOrName) {
  const source = typeof userOrName === 'string' ? userOrName : userOrName?.fullName || userOrName?.username || '?'
  const parts = String(source).trim().split(/\s+/).slice(0, 2)
  const result = parts.map((part) => part[0]).join('')
  return (result || '?').toUpperCase()
}

/** Half-open range check between two "yyyy-MM-dd" strings (inclusive). */
export function isWithin(iso, from, to) {
  if (!iso) return false
  if (from && iso < from) return false
  if (to && iso > to) return false
  return true
}
