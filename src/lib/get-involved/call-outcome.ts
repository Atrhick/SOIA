/**
 * What happens after a host chooses a role on the call record. Server only, not 'use server'.
 * Called by src/lib/actions/discovery-admin.ts after its transaction has committed.
 */
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { journeyLink, refreshJourneyToken } from './journey'
import { prospectRoleConfig } from './roles'
import { emailInviter } from './server'
import { giveLinkEmail } from './emails/call-record'
import { sendAssessmentInvite } from './journey-steps'

/**
 * Email the assessment link (parent copied for 17 and under) and set assessmentSentAt, using the one
 * E8 template in journey-steps.ts. hostUserId is kept for the caller's signature. Never throws.
 */
export async function sendAssessmentInviteAfterCall(prospectId: string, _hostUserId: string | null): Promise<void> {
  const r = await sendAssessmentInvite(prospectId)
  if (!r.ok) console.error('[GET-INVOLVED] assessment invite after call not sent:', r.error)
}

/** Sponsor / donor: send the giving page (the role's handoffUrl, else /journey/[token]/give). Never throws. */
export async function sendGiveLinkAfterCall(prospectId: string): Promise<void> {
  try {
    const p = await prisma.prospect.findUnique({ where: { id: prospectId } })
    if (!p || p.status !== 'DONATION_HANDOFF') return
    const cfg = await prospectRoleConfig(p)
    const token = p.journeyToken ?? (await refreshJourneyToken(prisma, p.id))
    const m = giveLinkEmail({ firstName: p.firstName, roleLabel: cfg?.label ?? 'sponsor', url: cfg?.handoffUrl || journeyLink(token, 'give') })
    await sendEmail({ to: p.email, ...m })
  } catch (e) {
    console.error('[GET-INVOLVED] give link email failed', e)
  }
}

/** Short inviter update once the role is chosen. */
export async function tellInviterRoleChosen(p: { invitedById: string | null; firstName: string; lastName: string }, roleLabel: string, sponsor: boolean) {
  await emailInviter(p.invitedById, `${p.firstName} ${p.lastName}`, sponsor
    ? `had their discovery call and would like to give as a ${roleLabel}. We sent them the giving page`
    : `had their discovery call and chose ${roleLabel}. We sent them their 3 assessment questions`)
}
