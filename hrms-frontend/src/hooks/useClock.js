import { useEffect, useState } from 'react'

// =============================================================================
// useClock - "now", refreshed once per second.
// =============================================================================
// Returns a Date that re-renders its consumer every second, so a live clock in
// the UI is just `const now = useClock()` and the consumer formats it however
// it likes (see formatTime / todayISO in utils/format.js).
//
// WHY setTimeout AND NOT setInterval: an interval drifts - it fires a second
// after the LAST tick, so any late tick is never made up - and browsers
// throttle background tabs, which leaves the display stale or skip a second on
// wake. Here each timeout is re-armed to the NEXT whole second instead, so the
// tick stays aligned to the real clock and corrects itself automatically.
//
// The consumer should be its own small component: only that component
// re-renders every second, never the tree around it.

export default function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timerId

    // Delay to the next boundary rather than a whole interval, so the clock is
    // never up to 999ms behind the moment the component mounts.
    const delayUntilNextTick = () => intervalMs - (Date.now() % intervalMs)

    const tick = () => {
      setNow(new Date())
      timerId = setTimeout(tick, delayUntilNextTick())
    }

    timerId = setTimeout(tick, delayUntilNextTick())

    return () => clearTimeout(timerId)
  }, [intervalMs])

  return now
}
