import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import useMediaQuery from '../../hooks/useMediaQuery'
import { pageTitleFor } from '../../config/navigation'
import { useAuth } from '../../context/AuthContext'

// =============================================================================
// AppLayout - the shell every authenticated page renders inside.
// =============================================================================
// Owns the three pieces of layout state, all of them persisted or derived:
//
//   collapsed    desktop icon rail vs full sidebar (remembered in localStorage)
//   mobileOpen   overlay drawer on <=1024px
//   isMobile     which of the two the nav toggle button should drive
//
// Uses <Outlet /> so App.jsx can declare every page as a normal nested route
// instead of passing children around.

const COLLAPSE_KEY = 'hrms_sidebar_collapsed'

export default function AppLayout() {
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width: 1024px)')
  const { user } = useAuth()
  const role = user?.roles?.[0]

  // Read the saved preference once, on first render.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const persistCollapsed = (next) => {
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSE_KEY, String(next))
    } catch {
      // Preference just won't persist - not worth failing over.
    }
  }

  const toggleNav = () => {
    if (isMobile) setMobileOpen((v) => !v)
    else persistCollapsed(!collapsed)
  }

  // Navigating closes the drawer, otherwise the new page would open behind it.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Keep the browser tab in sync with the page. Without this every tab reads
  // "HRMS", which makes a stack of open tabs impossible to tell apart - and
  // it is the first thing a screen-reader user hears on navigation. The role
  // is passed so an employee's tabs read "My Leave" rather than "Leave".
  useEffect(() => {
    document.title = `${pageTitleFor(location.pathname, role)} · HRMS`
  }, [location.pathname, role])

  // Focus/scroll hygiene while the drawer covers the page.
  useEffect(() => {
    if (!isMobile || !mobileOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isMobile, mobileOpen])

  return (
    <div
      className={[
        'app-shell',
        collapsed && !isMobile ? 'is-collapsed' : '',
        mobileOpen ? 'is-mobile-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* First tab stop in the app: jump straight to the page content. */}
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Sidebar onNavigate={() => setMobileOpen(false)} />

      {/* Click-away layer for the mobile drawer. */}
      <button
        type="button"
        className="sidebar-scrim"
        aria-label="Close navigation menu"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />

      <div className="app-main">
        <Topbar onToggleNav={toggleNav} navExpanded={isMobile ? mobileOpen : !collapsed} isMobile={isMobile} />

        <main className="content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
