import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { navGroupsFor, pageTitleFor, sectionFor } from '../../config/navigation'
import useTheme from '../../hooks/useTheme'
import { initials } from '../../utils/format'
import Button from '../common/Button'

// =============================================================================
// Topbar - orientation and account controls.
// =============================================================================
// Left:  nav toggle (collapse the rail on desktop / open the drawer on mobile)
//        + where am I (breadcrumb)
// Right: theme switch + the signed-in user's menu
//
// Both controls do real work. No decorative search box or notification bell
// that leads nowhere - a control that looks functional but is not is worse
// than no control at all.

/** Group name that owns a given route, e.g. /employees -> "Workforce". */
function groupLabelFor(pathname, role) {
  const section = `/${sectionFor(pathname)}`
  // Use the SAME role-filtered groups the sidebar renders, so the breadcrumb
  // can never name a group the user does not have.
  const group = navGroupsFor(role).find((g) => g.items.some((item) => item.to === section))
  return group?.label
}

function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)

  // Close when clicking away or pressing Escape - standard menu behaviour.
  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus() // return focus, don't drop the user
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const displayName = user?.fullName || user?.username || 'Account'

  return (
    <div className="user-menu" ref={containerRef}>
      <button
        type="button"
        className="user-menu__trigger"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="avatar" style={{ width: 30, height: 30, fontSize: '0.7rem' }} aria-hidden="true">
          {initials(user)}
        </span>
        <span className="sr-only">Account menu for {displayName}</span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
        />
      </button>

      {open ? (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__head">
            <div className="row">
              <span className="avatar avatar--lg" aria-hidden="true">
                {initials(user)}
              </span>
              <div className="grow">
                <div className="user-menu__name">{displayName}</div>
                <div className="user-menu__email">{user?.email || user?.username}</div>
              </div>
            </div>
            {user?.roles?.length ? (
              <div className="row row-wrap" style={{ marginTop: 10 }}>
                {user.roles.map((role) => (
                  <span className="chip" key={role}>
                    <UserRound size={12} aria-hidden="true" />
                    {role}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            role="menuitem"
            className="menu-item menu-item--danger"
            onClick={() => {
              setOpen(false)
              logout()
            }}
          >
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function Topbar({ onToggleNav, navExpanded, isMobile }) {
  const location = useLocation()
  const { theme, toggle: toggleTheme } = useTheme()
  const { user } = useAuth()
  const role = user?.roles?.[0]

  const title = pageTitleFor(location.pathname, role)
  const group = groupLabelFor(location.pathname, role)

  const ToggleIcon = isMobile ? Menu : navExpanded ? PanelLeftClose : PanelLeftOpen
  const toggleLabel = isMobile
    ? navExpanded
      ? 'Close navigation menu'
      : 'Open navigation menu'
    : navExpanded
      ? 'Collapse sidebar'
      : 'Expand sidebar'

  return (
    <header className="topbar">
      <Button
        variant="ghost"
        iconOnly
        icon={ToggleIcon}
        aria-label={toggleLabel}
        aria-expanded={navExpanded}
        onClick={onToggleNav}
      />

      {/* Navigation trail. Purely descriptive, so the visible text is enough -
          the <nav> element already gives assistive tech the context. */}
      <nav className="topbar__crumbs grow" aria-label="Breadcrumb">
        {group ? (
          <>
            <span className="topbar__crumbs-root">{group}</span>
            <span className="topbar__crumbs-sep" aria-hidden="true">
              /
            </span>
          </>
        ) : null}
        <span className="topbar__crumbs-current">{title}</span>
      </nav>

      <div className="topbar__actions">
        <Button
          variant="ghost"
          iconOnly
          icon={theme === 'dark' ? Sun : Moon}
          // Label states the ACTION (what happens if you press it), not the
          // current state - that is what makes sense to announce.
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        />
        <UserMenu />
      </div>
    </header>
  )
}
