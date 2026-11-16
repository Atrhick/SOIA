/** Labels that only name the app (Zoom, Google Meet…) mean two ways into one session. */
const APP_LABEL = /^(zoom|google meet|meet|microsoft teams|teams|second link|link \d)$/i

/** True when the owner named both links and the names aren't just app names: two different sessions. */
export function twoSessions(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = a?.trim() ?? ''
  const y = b?.trim() ?? ''
  if (!x || !y || x.toLowerCase() === y.toLowerCase()) return false
  return !APP_LABEL.test(x) && !APP_LABEL.test(y)
}
