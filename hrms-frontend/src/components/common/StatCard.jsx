import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Minus, TriangleAlert } from 'lucide-react'

// =============================================================================
// StatCard - one KPI tile on the dashboard.
// =============================================================================
// Renders as a <Link> when `to` is given (the whole tile is the click target,
// which is far easier to hit than a small "view" link), otherwise a plain div.
//
// When its source microservice is down the tile shows an em dash and names the
// failing service, instead of a misleading 0 or a blank screen. Showing "0
// employees" when employee-service is actually down would be a lie - and a
// damaging one in an HR tool.

const TONE_CLASS = {
  blue: 'stat-card__icon--blue',
  green: 'stat-card__icon--green',
  amber: 'stat-card__icon--amber',
  red: 'stat-card__icon--red',
}

function Delta({ value, tone = 'flat', suffix = '' }) {
  const Icon = tone === 'up' ? ArrowUpRight : tone === 'down' ? ArrowDownRight : Minus
  return (
    <span className={`delta delta--${tone}`}>
      <Icon size={12} aria-hidden="true" />
      {value}
      {suffix}
    </span>
  )
}

export default function StatCard({
  to,
  icon: Icon,
  tone = 'blue',
  value,
  label,
  delta,
  deltaTone = 'flat',
  deltaSuffix = '',
  error,
  hint,
}) {
  const Wrapper = to ? Link : 'div'
  const wrapperProps = to ? { to } : {}

  return (
    <Wrapper className="stat-card" {...wrapperProps}>
      <div className="stat-card__top">
        {Icon ? (
          <span className={`stat-card__icon ${TONE_CLASS[tone] || TONE_CLASS.blue}`}>
            <Icon size={19} aria-hidden="true" />
          </span>
        ) : null}
        {delta != null ? <Delta value={delta} tone={deltaTone} suffix={deltaSuffix} /> : null}
      </div>

      <div>
        <div className="stat-card__value">{error ? '—' : value}</div>
        <div className="stat-card__label">{label}</div>

        {error ? (
          <span className="stat-card__error">
            <TriangleAlert size={12} aria-hidden="true" />
            {error}
          </span>
        ) : hint ? (
          <span className="text-subtle">{hint}</span>
        ) : null}
      </div>
    </Wrapper>
  )
}
