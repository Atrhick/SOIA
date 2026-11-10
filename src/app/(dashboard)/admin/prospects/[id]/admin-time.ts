// Admin screens show times in Central Time with a zone label (as /admin/discovery-calls does),
// never in the prospect's own zone, so one call never shows two different times.
export const ADMIN_TZ = 'America/Chicago'

/** "Mon, Nov 9, 7:39 PM CST" */
export function adminCallWhen(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: ADMIN_TZ, timeZoneName: 'short',
  }).format(d)
}

/** "7:39 PM CST" */
export function adminClock(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ADMIN_TZ, timeZoneName: 'short' }).format(d)
}
