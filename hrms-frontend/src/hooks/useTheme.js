import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// useTheme - light/dark switching.
// =============================================================================
// The entire dark theme is a token swap in index.css under [data-theme='dark'],
// so this hook only has to set that attribute on <html>. Every component
// inherits the new values automatically because they all read var(--token).
//
// The choice is stored in localStorage so it survives a refresh, and the
// inline script in index.html applies it before first paint (avoiding a
// white flash for dark-mode users).

const STORAGE_KEY = 'hrms_theme'

function readInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage can throw in private mode - fall through to the OS setting.
  }
  // No explicit choice yet: follow the operating system.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function useTheme() {
  const [theme, setTheme] = useState(readInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Not being able to persist is fine - the theme still applies.
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, setTheme, toggle, isDark: theme === 'dark' }
}
