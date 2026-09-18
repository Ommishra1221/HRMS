// =============================================================================
// Card - the surface every page is built from.
// =============================================================================
// Card / CardHeader / CardBody / CardFooter are deliberately dumb wrappers:
// they only apply the layout + spacing classes from the design system, so
// pages describe STRUCTURE and index.css owns the VISUAL rules.

export default function Card({ children, className = '', as: Component = 'div', ...rest }) {
  return (
    <Component className={`card ${className}`} {...rest}>
      {children}
    </Component>
  )
}

/**
 * Card header: title on the left, optional actions on the right.
 * `icon` is rendered before the title to give each panel a visual identity.
 */
export function CardHeader({ title, subtitle, icon: Icon, actions, className = '' }) {
  return (
    <div className={`card__header ${className}`}>
      <div>
        <div className="card__title">
          {Icon ? <Icon size={17} aria-hidden="true" /> : null}
          {title}
        </div>
        {subtitle ? <p className="card__sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  )
}

export function CardBody({ children, flush = false, className = '', ...rest }) {
  return (
    <div className={`card__body ${flush ? 'card__body--flush' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '', ...rest }) {
  return (
    <div className={`card__footer ${className}`} {...rest}>
      {children}
    </div>
  )
}
