import { useEffect, useState } from 'react'

// =============================================================================
// useMediaQuery - ask CSS a question from JavaScript.
// =============================================================================
// Most responsiveness belongs in CSS, where it costs nothing. This hook is for
// the handful of cases where JS must behave differently - here, deciding
// whether the nav toggle should COLLAPSE the sidebar (desktop) or OPEN the
// drawer (mobile). Those are different interactions on the same button, and
// CSS alone cannot switch the handler.

export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (event) => setMatches(event.matches)

    mql.addEventListener('change', onChange)
    setMatches(mql.matches) // re-sync in case we mounted mid-change

    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
