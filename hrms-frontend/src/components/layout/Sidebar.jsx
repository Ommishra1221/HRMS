import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { navGroupsFor } from '../../config/navigation'
import { useAuth } from '../../context/AuthContext'
import { initials } from '../../utils/format'

// =============================================================================
// Sidebar - primary navigation.
// =============================================================================
// Structure: brand lockup -> grouped nav (scrolls) -> identity + logout (pinned).
// The footer is pinned because "who am I / how do I leave" should never
// require scrolling, on any screen size.
//
// The nav definition lives in config/navigation.js, so the sidebar and the
// topbar breadcrumb can never drift apart.
//
// On <=1024px CSS turns this into an overlay drawer (see index.css); this
// component does not need to know which mode it is in - only `onNavigate`
// closes the drawer after a tap.

function NavItems({ onNavigate }) {
  // ROLE-AWARE NAV: the signed-in user's role (an account holds exactly one)
  // filters the shared nav config. ADMIN sees everything including Users;
  // HR gets the operational modules; EMPLOYEE gets the self-service group.
  // UX only - the backend still refuses anything the role may not do.
  const { user } = useAuth()
  const role = user?.roles?.[0]
  const groups = navGroupsFor(role)

  return (
    <>
      {groups.map((group) => (
        <div className="nav-group" key={group.label}>
          {/* Visible group label; when the rail is collapsed CSS hides it. */}
          <div className="nav-group__label">{group.label}</div>

          {group.items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={onNavigate}
              // Duplicate routes exist (/employees and /employees/new): `end`
              // would make only the exact path active, so we keep the default
              // prefix matching that NavLink applies to `/employees/*`.
              title={label}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav-item__label">{label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </>
  )
}

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth()

  const displayName = user?.fullName || user?.username || 'Signed in'
  const roleLabel = user?.roles?.length ? user.roles.join(' · ') : 'User'

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">
          HR
        </span>
        <span className="sidebar__brand-text">
          <span className="sidebar__brand-name">HRMS</span>
          <span className="sidebar__brand-sub">People Ops</span>
        </span>
      </div>

      <nav className="sidebar__nav">
        <NavItems onNavigate={onNavigate} />
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user">
          <span className="avatar" aria-hidden="true">
            {initials(user)}
          </span>
          <span className="sidebar__user-text">
            <span className="sidebar__user-name">{displayName}</span>
            <span className="sidebar__user-role">{roleLabel}</span>
          </span>
        </div>

        {/* The label span is hidden when the rail collapses - the icon plus the
            title attribute keep the control understandable in both states. */}
        <button type="button" className="btn btn-logout" onClick={logout} title="Log out">
          <LogOut size={17} aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  )
}
