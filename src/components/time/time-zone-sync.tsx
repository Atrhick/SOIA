'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Records the browser's IANA time zone in a cookie so server components can
 * work out where "today" and "this week" start for the person reading.
 *
 * The server has no other way to know: on Cloud Run it runs in UTC, which put
 * a coach in Nairobi three hours out and one in Honolulu on the wrong day.
 *
 * The comparison is against the cookie rather than the zone the server settled
 * on, so an unrecognised zone cannot put this into a refresh loop.
 */
export function TimeZoneSync() {
  const router = useRouter()

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!zone) return

    const stored = document.cookie.match(/(?:^|;\s*)tz=([^;]*)/)?.[1]
    if (stored && decodeURIComponent(stored) === zone) return

    document.cookie = `tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`
    router.refresh()
  }, [router])

  return null
}
