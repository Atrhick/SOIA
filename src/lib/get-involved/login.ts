/**
 * The end of the journey: create the login (User + profile) for a prospect. Server only, not 'use server'.
 * Shared by the Join page (free roles: terms + password + login in one step) and the payment
 * hand-off (paid roles: after payment completes). Callers check the token/auth first.
 */
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { sendWelcomeInvite } from '@/lib/actions/password-reset'
import { billingLabel, canCreateLogin, formatDollars, isPaidRole, roleHasLogin, userRoleFor } from './core'
import { appUrl } from './emails'
import { accountReadyEmail, inviterJoinedEmail } from './emails/joined'
import { notifyAdmins, setStatus, userDisplayName } from './server'
import { prospectRoleConfig } from './roles'

/** Where an inviter's My Team page is. */
export function teamPathFor(role: string): string {
  return role === 'AMBASSADOR' ? '/ambassador/my-team' : '/coach/my-team'
}

/** bcrypt cost used for journey passwords (same as the rest of the app). */
export const hashJourneyPassword = (plain: string) => bcrypt.hash(plain, 12)

export type CreateLoginResult =
  | { ok: true; userId: string; userRole: string; needsPasswordSetup: boolean }
  | { ok: false; error: string }

/**
 * Create the User and its profile, link Prospect.userId, set joinedAt and move to ACCOUNT_CREATED
 * (with a status-history row, which is what the leaderboard's "joined" counts).
 * Requires canCreateLogin(): terms accepted, and for paid roles status PAYMENT_COMPLETED; for free
 * roles status ORIENTATION_COMPLETED. Password: `passwordHash`, else Prospect.pendingPasswordHash,
 * else a random one (needsPasswordSetup = true: completeJourney then emails a set-password link).
 * Messages in `error` are safe to show the prospect.
 */
export async function createJourneyLogin(prospectId: string, opts: { passwordHash?: string | null; byUserId?: string | null } = {}): Promise<CreateLoginResult> {
  const p = await prisma.prospect.findUnique({
    where: { id: prospectId },
    include: {
      payment: true,
      invitedBy: { select: { id: true, coachProfile: { select: { id: true } }, ambassadorProfile: { select: { coachId: true } }, associateProfile: { select: { coachId: true } } } },
    },
  })
  if (!p) return { ok: false, error: 'We could not find your details.' }
  const cfg = await prospectRoleConfig(p)
  if (!cfg || !roleHasLogin(cfg.role)) return { ok: false, error: 'This role does not come with a login.' }
  const paid = isPaidRole(cfg)
  if (!p.roleTermsAcceptedAt || !canCreateLogin({ status: p.status, paid, userId: p.userId, journeyRole: p.journeyRole })) {
    return { ok: false, error: p.userId ? 'Your login already exists. Please sign in.' : 'This step is not ready yet.' }
  }
  const userRole = userRoleFor(cfg.role)!
  const existing = await prisma.user.findUnique({ where: { email: p.email }, select: { id: true } })
  if (existing) return { ok: false, error: 'An account with this email already exists. Please sign in, or reply to any of our emails and we will link it for you.' }

  const sponsorCoachId = p.invitedBy?.coachProfile?.id ?? p.invitedBy?.ambassadorProfile?.coachId ?? p.invitedBy?.associateProfile?.coachId ?? null
  if (userRole === 'AMBASSADOR' && !sponsorCoachId) return { ok: false, error: 'We need to match you with a coach first. Our team has been told and will email you shortly.' }

  const supplied = opts.passwordHash ?? p.pendingPasswordHash
  const passwordHash = supplied ?? (await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12))
  const minor = p.ageRange === 'UNDER_18'

  try {
    const userId = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction so two clicks can't create two logins.
      const fresh = await tx.prospect.findUnique({ where: { id: p.id }, select: { userId: true, status: true } })
      if (!fresh || fresh.userId || fresh.status !== p.status) throw new Error('STALE')
      const user = await tx.user.create({ data: { email: p.email, password: passwordHash, role: userRole, status: 'ACTIVE' } })
      let coachProfileId: string | null = null
      if (userRole === 'COACH') {
        const coach = await tx.coachProfile.create({
          data: { userId: user.id, firstName: p.firstName, lastName: p.lastName, phone: p.phone, coachStatus: 'ONBOARDING_INCOMPLETE', isResourceCenterOwner: cfg.role === 'RESOURCE_CENTER_OWNER' },
        })
        await tx.businessExcellenceCRM.create({ data: { coachId: coach.id } })
        await tx.websiteContentStatus.create({ data: { coachId: coach.id } })
        coachProfileId = coach.id
      } else if (userRole === 'AMBASSADOR') {
        const [parentFirst, ...parentRest] = (p.parentName ?? '').trim().split(/\s+/)
        await tx.ambassador.create({
          data: {
            userId: user.id, coachId: sponsorCoachId!, firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone, city: p.city,
            ...(minor ? { parentFirstName: parentFirst || null, parentLastName: parentRest.join(' ') || null, parentEmail: p.parentEmail, parentPhone: p.parentPhone, parentRelationship: p.parentRelationship, parentalConsentGiven: !!p.parentConsentAt, parentalConsentDate: p.parentConsentAt } : {}),
          },
        })
      } else {
        await tx.associateProfile.create({ data: { userId: user.id, type: userRole, firstName: p.firstName, lastName: p.lastName, phone: p.phone, coachId: sponsorCoachId } })
      }
      await tx.prospect.update({
        where: { id: p.id },
        data: { userId: user.id, joinedAt: new Date(), pendingPasswordHash: null, ...(coachProfileId && !p.coachProfileId ? { coachProfileId } : {}) },
      })
      await setStatus(tx, p.id, p.status, 'ACCOUNT_CREATED', opts.byUserId ?? null, `Login created (${cfg.label})`)
      return user.id
    })
    return { ok: true, userId, userRole, needsPasswordSetup: !supplied }
  } catch (e) {
    if (e instanceof Error && e.message === 'STALE') return { ok: false, error: 'Your login already exists. Please sign in.' }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false, error: 'An account with this email already exists. Please sign in.' }
    throw e
  }
}

/**
 * createJourneyLogin + the emails that follow: E11 "Your login is ready" (parent copied for 17 and
 * under), the inviter's "joined your team", an admin notification, and a set-password link when no
 * password was chosen. Use this rather than createJourneyLogin unless you send your own emails.
 */
export async function completeJourney(prospectId: string, opts: { passwordHash?: string | null; byUserId?: string | null } = {}): Promise<CreateLoginResult> {
  const r = await createJourneyLogin(prospectId, opts)
  if (!r.ok) {
    if (r.error.startsWith('We need to match you with a coach')) {
      await notifyAdmins('Ambassador needs a coach', 'A prospect finished the journey but their inviter has no coach to place them with. Please assign one.', prospectId).catch(() => {})
    }
    return r
  }
  try {
    const p = await prisma.prospect.findUnique({ where: { id: prospectId }, include: { payment: true } })
    if (!p) return r
    const cfg = await prospectRoleConfig(p)
    const label = cfg?.label ?? 'member'
    const pay = p.payment?.status === 'COMPLETED' ? p.payment : null
    const receipt = pay && cfg
      ? `${label} program, ${formatDollars(Math.round(Number(pay.amount) * 100))} (${billingLabel(cfg.billing)}) · ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(pay.paidAt ?? new Date())}`
      : null
    if (r.needsPasswordSetup) {
      await sendWelcomeInvite(r.userId, p.firstName, label)
    } else {
      const m = accountReadyEmail({ firstName: p.firstName, roleLabel: label, email: p.email, signInUrl: appUrl(r.userRole === 'AMBASSADOR' ? '/ambassador-login' : '/login'), receipt })
      await sendEmail({ to: p.email, ...m })
      if (p.ageRange === 'UNDER_18' && p.parentEmail) await sendEmail({ to: p.parentEmail, ...m })
    }
    if (p.invitedById) {
      const inviter = await prisma.user.findUnique({ where: { id: p.invitedById }, select: { role: true, status: true } })
      const name = await userDisplayName(p.invitedById)
      if (inviter?.status === 'ACTIVE' && name) {
        await sendEmail({ to: name.email, ...inviterJoinedEmail({ inviterFirst: name.first, prospectName: `${p.firstName} ${p.lastName}`, roleLabel: label, teamUrl: appUrl(teamPathFor(inviter.role)) }) })
      }
    }
    await notifyAdmins('New member joined', `${p.firstName} ${p.lastName} finished the Get Involved journey as ${label}.`, p.id)
  } catch (e) {
    console.error('[GET-INVOLVED] joined emails failed', e)
  }
  return r
}
