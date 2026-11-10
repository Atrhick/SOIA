/**
 * Loader shared by the prospect's /journey/[token]/assessment and /orientation pages. Server only.
 * Unknown, malformed and expired tokens all come back as 'expired' so a page never reveals which.
 */
import { JourneyPosition, RoleConfig, journeyPosition, stagePath } from './core'
import { JourneyProspect, journeyFactsFor, journeyLinkUsable, prospectForJourney } from './journey'
import { prospectRoleConfig } from './roles'
import { userDisplayName } from './server'

export type JourneyPageData =
  | { kind: 'expired' }
  | { kind: 'closed' }
  | { kind: 'ready'; p: JourneyProspect; cfg: RoleConfig | null; pos: JourneyPosition; currentPath: string | null; invitedBy: string | null }

export async function loadJourneyPage(token: string): Promise<JourneyPageData> {
  const p = await prospectForJourney(token)
  if (!p || !journeyLinkUsable(p)) return { kind: 'expired' }
  const cfg = await prospectRoleConfig(p)
  const pos = journeyPosition(journeyFactsFor(p, cfg))
  if (pos.stage === 'CLOSED') return { kind: 'closed' }
  const inviter = p.invitedById ? await userDisplayName(p.invitedById) : null
  return { kind: 'ready', p, cfg, pos, currentPath: stagePath(pos.stage, token), invitedBy: inviter?.full ?? null }
}

export const CLOSED_TITLE = 'Please get in touch'
export const CLOSED_BODY = 'This journey is closed for now. If you think that is a mistake, please reply to any of our emails or reach out to the person who invited you.'
