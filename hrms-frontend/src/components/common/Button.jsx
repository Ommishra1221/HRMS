import { Loader2 } from 'lucide-react'

// =============================================================================
// Button - one component, every button in the app.
// =============================================================================
// Why a component instead of `className="btn btn-primary"` written by hand?
//   - The loading spinner + disabled wiring live in ONE place, so nobody
//     forgets to disable a submit button while the request is in flight.
//   - Icon sizing/spacing stays consistent automatically.
//   - `as` lets a router <Link> render with button styling but keep its
//     real semantics (an <a> for navigation, a <button> for actions).
//
// Accessible by default:
//   - type="button" unless you say otherwise, so a stray button inside a
//     <form> never submits it by accident.
//   - `iconOnly` requires an aria-label (we throw in development to catch it).
//   - while loading, aria-busy is set so screen readers know to wait.

const VARIANTS = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
  'danger-ghost': 'btn--danger-ghost',
  success: 'btn--success',
}

const SIZES = {
  sm: 'btn--sm',
  md: '',
  lg: 'btn--lg',
}

export default function Button({
  as: Component = 'button',
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  block = false,
  iconOnly = false,
  className = '',
  children,
  disabled = false,
  type,
  ...rest
}) {
  const extra = [
    VARIANTS[variant] || VARIANTS.secondary,
    SIZES[size] ?? '',
    block ? 'btn--block' : '',
    iconOnly ? 'btn--icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (import.meta.env.DEV && iconOnly && !rest['aria-label']) {
    console.warn('Button: iconOnly buttons need an aria-label so screen readers can announce them.')
  }

  const iconProps = { size: size === 'sm' ? 15 : 17, 'aria-hidden': true }

  return (
    <Component
      className={`btn ${extra}`}
      // Only a real <button> should get a type - links don't take one.
      {...(Component === 'button' ? { type: type || 'button', disabled: disabled || loading } : {})}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="spin" {...iconProps} /> : Icon ? <Icon {...iconProps} /> : null}
      {children}
      {IconRight && !loading ? <IconRight {...iconProps} /> : null}
    </Component>
  )
}
