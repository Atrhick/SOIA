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
import { sendWelcomeInvite } from '@/lib/welcome-invite'
import { billingLabel, canCreateLogin, formatDollars, isPaidRole, roleHasLogin, userRoleFor } from './core'
import { appUrl } from './emails'
import { accountReadyEmail } from './emails/joined'
import { sendInviterJoined } from './emails/team'
import { emailEquals, notifyAdmins, transitionStatus } from './server'
import { prospectRoleConfig } from './roles'

/** Where an inviter's My Team page is. */
export function teamPathFor(role: string): string {
  return role === 'AMBASSADOR' ? '/ambassador/my-team' : '/coach/my-team'
}

/** bcrypt cost used for journey passwords (same as the rest of the app). */
export const hashJourneyPassword = (plain: string) => bcrypt.hash(plain, 12)

export type CreateLoginResult =
  | { ok: true; userId: string; userRole: string; needsPasswordSetup: boolean }
  | { ok: false; error: string; code?: 'NEEDS_COACH' }

export const NEEDS_COACH_ERROR = 'We need to match you with a coach first. Our team has been told and will email you as soon as your login is ready.'
const NEEDS_COACH_TITLE = 'Ambassador needs a coach'

type InviterCoach = { coachProfile: { id: string } | null; ambassadorProfile: { coachId: string } | null; associateProfile: { coachId: string | null } | null } | null

/** The coach an ambassador login is placed with: an admin's choice, else the inviter's coach. */
export function sponsorCoachId(invitedBy: InviterCoach, chosen?: string | null): string | null {
  return chosen ?? invitedBy?.coachProfile?.id ?? invitedBy?.ambassadorProfile?.coachId ?? invitedBy?.associateProfile?.coachId ?? null
}

/**
 * True when this prospect's login can't be made until an admin picks a coach (an ambassador role
 * whose inviter has no coach). The Join page uses it to say "we're matching you with a coach".
 */
export async function needsCoachMatch(prospectId: string): Promise<boolean> {
  const p = await prisma.prospect.findUnique({
    where: { id: prospectId },
    select: { userId: true, journeyRole: true, roleConfigSnapshot: true, invitedBy: { select: { coachProfile: { select: { id: true } }, ambassadorProfile: { select: { coachId: true } }, associateProfile: { select: { coachId: true } } } } },
  })
  if (!p || p.userId) return false
  const cfg = await prospectRoleConfig(p)
  if (!cfg || userRoleFor(cfg.role) !== 'AMBASSADOR') return false
  return !sponsorCoachId(p.invitedBy)
}

/**
 * Create the User and its profile, link Prospect.userId, set joinedAt and move to ACCOUNT_CREATED
 * (with a status-history row, which is what the leaderboard's "joined" counts).
 * Requires canCreateLogin(): terms accepted, and for paid roles status PAYMENT_COMPLETED; for free
 * roles status ORIENTATION_COMPLETED. Password: `passwordHash`, else Prospect.pendingPasswordHash,
 * else a random one (needsPasswordSetup = true: completeJourney then emails a set-password link).
 * Messages in `error` are safe to show the prospect.
 */
export async function createJourneyLogin(prospectId: string, opts: { passwordHash?: string | null; byUserId?: string | null; coachProfileId?: string | null } = {}): Promise<CreateLoginResult> {
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
  // Case-insensitive: older paths stored emails as typed, and the unique index is case-sensitive.
  const existing = await prisma.user.findFirst({ where: { email: emailEquals(p.email) }, select: { id: true } })
  if (existing) return { ok: false, error: 'An account with this email already exists. Please sign in, or reply to any of our emails and we will link it for you.' }

  // An admin-chosen coach (assignCoachAndCreateLogin) wins; otherwise the inviter's coach.
  const coachId = sponsorCoachId(p.invitedBy, opts.coachProfileId)
  if (userRole === 'AMBASSADOR' && !coachId) return { ok: false, error: NEEDS_COACH_ERROR, code: 'NEEDS_COACH' }

  const supplied = opts.passwordHash ?? p.pendingPasswordHash
  const passwordHash = supplied ?? (await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12))
  const minor = p.ageRange === 'UNDER_18'
  const email = p.email.trim().toLowerCase()

  try {
    const userId = await prisma.$transaction(async (tx) => {
      // Guarded move first (status unchanged and no login yet), so two clicks, or a Not a fit at the same
      // moment, can't both win. The whole transaction rolls back on STALE.
      const moved = await transitionStatus(tx, p.id, p.status, 'ACCOUNT_CREATED', opts.byUserId ?? null, `Login created (${cfg.label})`, { where: { userId: null } })
      if (!moved) throw new Error('STALE')
      const user = await tx.user.create({ data: { email, password: passwordHash, role: userRole, status: 'ACTIVE' } })
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
            userId: user.id, coachId: coachId!, firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone, city: p.city,
            ...(minor ? { parentFirstName: parentFirst || null, parentLastName: parentRest.join(' ') || null, parentEmail: p.parentEmail, parentPhone: p.parentPhone, parentRelationship: p.parentRelationship, parentalConsentGiven: !!p.parentConsentAt, parentalConsentDate: p.parentConsentAt } : {}),
          },
        })
      } else {
        await tx.associateProfile.create({ data: { userId: user.id, type: userRole, firstName: p.firstName, lastName: p.lastName, phone: p.phone, coachId } })
      }
      await tx.prospect.update({
        where: { id: p.id },
        data: { userId: user.id, joinedAt: new Date(), pendingPasswordHash: null, ...(coachProfileId && !p.coachProfileId ? { coachProfileId } : {}) },
      })
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
export async function completeJourney(prospectId: string, opts: { passwordHash?: string | null; byUserId?: string | null; coachProfileId?: string | null } = {}): Promise<CreateLoginResult> {
  const r = await createJourneyLogin(prospectId, opts)
  if (!r.ok) {
    if (r.code === 'NEEDS_COACH') {
      // Once per prospect while the notice is unread, not on every retry.
      try {
        const open = await prisma.adminNotification.findFirst({ where: { entityType: 'Prospect', entityId: prospectId, title: NEEDS_COACH_TITLE, isRead: false }, select: { id: true } })
        if (!open) await notifyAdmins(NEEDS_COACH_TITLE, 'A prospect finished the journey but their inviter has no coach to place them with. Open the record and choose "Place with this coach and create login".', prospectId)
      } catch (e) {
        console.error('[GET-INVOLVED] needs-coach notice failed', e)
      }
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
    // E13 with rank and team numbers (emails/team.ts); it checks the inviter itself.
    if (p.invitedById) await sendInviterJoined(prospectId)
    await notifyAdmins('New member joined', `${p.firstName} ${p.lastName} finished the Get Involved journey as ${label}.`, p.id)
  } catch (e) {
    console.error('[GET-INVOLVED] joined emails failed', e)
  }
  return r
}
