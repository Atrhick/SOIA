'use client'

import { useEffect, useState } from 'react'

/**
 * The current time, ticking every second. It starts at the server's `asOf` so
 * the first render matches the server's HTML, then switches to the real clock.
 */
export function useNow(asOf: string) {
  const [now, setNow] = useState(() => Date.parse(asOf))
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}
