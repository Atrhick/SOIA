// Pure rules that keep the older coach pipeline (src/lib/actions/prospects.ts) away from
// Get Involved prospects, and keep discovery-call hosts from being deleted with calls booked.
// Not 'use server': nothing here is a public endpoint.

/** Prisma `where` fragment for the older coach pipeline: prospects with no journey token. */
export const PIPELINE_ONLY = { journeyToken: null } as const

export const JOURNEY_PROSPECT_ERROR =
  'This person is on the Get Involved journey. Use the buttons on their Get Involved record instead.'

export interface JourneyMarkers {
  journeyToken?: string | null
  journeyRole?: string | null
  userId?: string | null
  payment?: { journeyRole?: string | null } | null
}

/**
 * A Get Involved prospect is one with a journeyToken (CLAUDE.md). journeyRole, a journey
 * login (userId) or a journey payment also mark one, in case the token was ever cleared.
 */
export function isJourneyProspect(p: JourneyMarkers | null | undefined): boolean {
  if (!p) return false
  return !!(p.journeyToken || p.journeyRole || p.userId || p.payment?.journeyRole)
}

/** Same wording as removeHost in discovery-admin.ts, so staff see one rule. */
export function upcomingHostCallsError(count: number): string | null {
  if (count <= 0) return null
  return `This host has ${count} upcoming call${count === 1 ? '' : 's'}. Turn them off instead (no new bookings), or cancel those calls first.`
}

/** Prisma `where` for a user's booked discovery calls that have not started yet. */
export function upcomingHostedCallsWhere(userId: string, now: Date) {
  return { hostId: userId, status: 'BOOKED' as const, startsAt: { gt: now } }
}
