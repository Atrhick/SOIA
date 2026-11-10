/** Pure helpers for the Hosts page: one honest status per host, and a meeting-link sanity check. */

export interface HostState { active: boolean; ageRanges: string[]; blocks: number; meetingUrl: string }

export type HostStatus = 'BOOKABLE' | 'NEEDS_TIMES' | 'NEEDS_AGES' | 'PAUSED'

/** Bookable only when prospects can actually see this host's times. */
export function hostStatus(h: HostState): HostStatus {
  if (!h.active) return 'PAUSED'
  if (h.blocks === 0) return 'NEEDS_TIMES'
  if (h.ageRanges.length === 0) return 'NEEDS_AGES'
  return 'BOOKABLE'
}

export const HOST_STATUS_LABEL: Record<HostStatus, string> = {
  BOOKABLE: 'Bookable',
  NEEDS_TIMES: 'Needs weekly times',
  NEEDS_AGES: 'Needs age ranges',
  PAUSED: 'Paused',
}

/**
 * A warning (not a block) when the link probably won't put the prospect in a meeting.
 * Returns null when the link looks fine or is empty.
 */
export function meetingLinkWarning(raw: string): string | null {
  const v = raw.trim()
  if (!v) return 'No meeting link yet. Prospects get the link in their confirmation email, so add one before calls are booked.'
  let u: URL
  try { u = new URL(v) } catch { return 'This doesn’t look like a web address.' }
  if (u.protocol !== 'https:') return 'The meeting link must start with https://'
  const host = u.hostname.toLowerCase()
  if (host === 'zoom.us' || host.endsWith('.zoom.us')) {
    const path = u.pathname.toLowerCase()
    if (/^\/(j|my|s|w)\/[^/]+/.test(path) || /^\/wc\/(join\/)?\d+/.test(path)) return null
    if (path.includes('chat')) return 'This is a Zoom chat link, not a meeting link. Use your meeting or personal room link (it looks like zoom.us/j/123… or zoom.us/my/name).'
    return 'This doesn’t look like a Zoom meeting link. Meeting links look like zoom.us/j/123… or zoom.us/my/name.'
  }
  return null
}
