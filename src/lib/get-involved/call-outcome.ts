/**
 * What happens after a host chooses a role on the call record. Server only, not 'use server'.
 * Called by src/lib/actions/discovery-admin.ts after its transaction has committed.
 */
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { journeyLink, refreshJourneyToken } from './journey'
import { prospectRoleConfig } from './roles'
import { emailInviter, userDisplayName } from './server'
import { callAssessmentEmail, giveLinkEmail } from './emails/call-record'

/**
 * Email the assessment link (copying the parent for 17 and under), then set assessmentSentAt.
 * TODO(get-involved B3): replace the body with B3's sendAssessmentInvite(prospectId) from
 * src/lib/actions/journey-assessment.ts or emails/assessment.ts once that branch is merged, so there is
 * one E8 template. Never throws.
 */
export async function sendAssessmentInviteAfterCall(prospectId: string, hostUserId: string | null): Promise<void> {
  try {
    const p = await prisma.prospect.findUnique({ where: { id: prospectId } })
    if (!p || p.status !== 'ASSESSMENT_PENDING' || !p.journeyToken) return
    const cfg = await prospectRoleConfig(p)
    if (!cfg) return
    const host = hostUserId ? await userDisplayName(hostUserId) : null
    const minor = p.ageRange === 'UNDER_18'
    const m = callAssessmentEmail({ firstName: p.firstName, roleLabel: cfg.label, questions: cfg.questions, url: journeyLink(p.journeyToken, 'assessment'), hostName: host?.full ?? null, minor })
    await sendEmail({ to: p.email, ...m })
    if (minor && p.parentEmail) await sendEmail({ to: p.parentEmail, ...m })
    await prisma.prospect.update({ where: { id: p.id }, data: { assessmentSentAt: new Date() } })
  } catch (e) {
    console.error('[GET-INVOLVED] assessment invite failed', e)
  }
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
