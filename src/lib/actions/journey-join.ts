'use server'

/**
 * Get Involved: the Join step (/journey/[token]/join). Accept the role's terms, choose a password,
 * then either create the login at once (free roles) or open a payment (paid roles). Plus the admin
 * "payment received" action that finishes a paid prospect's journey.
 *
 * Every export here is a public endpoint. Token actions validate the token, the link's 14 days and
 * the step predicate, are rate limited, Zod-validate input and never reveal whether an email exists.
 * The admin action requires ADMIN and is blocked while impersonating.
 */
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import {
  billingLabel, canAcceptTerms, canCreateLogin, formatDollars, isPaidRole, journeyPosition, laterJourneyOpen, priceLabel, roleHasLogin,
} from '@/lib/get-involved/core'
import * as mail from '@/lib/get-involved/emails'
import { paymentArrangedEmail } from '@/lib/get-involved/emails/account'
import { clientIp, emailInviter, rateLimited } from '@/lib/get-involved/server'
import { ensureLiveTerms, getLiveTerms, prospectRoleConfig } from '@/lib/get-involved/roles'
import { journeyFactsFor, journeyLink, journeyLinkUsable, journeyStageUrl, prospectForJourney, refreshJourneyToken } from '@/lib/get-involved/journey'
import { completeJourney, hashJourneyPassword } from '@/lib/get-involved/login'
import { markJourneyPaid, openJourneyPayment } from '@/lib/get-involved/payment'
import { getPaymentProvider, isOnlinePaymentEnabled } from '@/lib/payments'

export type JoinResult =
  | { ok: true; next: 'welcome' | 'payment' }
  | { ok: false; error: string; fieldErrors?: { accept?: string; password?: string } }

const GENERIC = 'This link is no longer valid. Please ask for a new one below.'

// Same rule as src/lib/actions/password-reset.ts
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

const tokenSchema = z.string().min(16).max(100)

const acceptSchema = z.object({
  accept: z.boolean(),
  password: z.string().max(200),
  termsVersion: z.number().int().min(0).max(100000),
})

function limited(token: string, ip: string) {
  return rateLimited(`join:${ip}`, 20, 15 * 60_000) || rateLimited(`join-t:${token}`, 8, 15 * 60_000)
}

/**
 * Accept the role's live terms and choose a password.
 * Free roles: the login is created straight away (completeJourney). Paid roles: the password is kept
 * as pendingPasswordHash, a PENDING payment is opened (MANUAL while no provider is connected) and
 * staff are told to arrange payment.
 */
export async function acceptTermsAndJoin(token: string, input: unknown): Promise<JoinResult> {
  const t = tokenSchema.safeParse(token)
  if (!t.success) return { ok: false, error: GENERIC }
  if (limited(t.data, await clientIp())) return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }
  const parsed = acceptSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Please check the form and try again.' }

  const p = await prospectForJourney(t.data)
  if (!p || !journeyLinkUsable(p)) return { ok: false, error: GENERIC }
  const cfg = await prospectRoleConfig(p)
  if (!cfg || !roleHasLogin(cfg.role)) return { ok: false, error: 'This step is not open for your role.' }
  if (!canAcceptTerms(p.status) || p.roleTermsAcceptedAt) {
    return { ok: false, error: p.roleTermsAcceptedAt ? 'You have already accepted the terms. Please reload the page.' : 'This step is not open yet. Please reload the page.' }
  }

  const fieldErrors: { accept?: string; password?: string } = {}
  if (!parsed.data.accept) fieldErrors.accept = `Please tick the box to accept the ${cfg.label} terms.`
  const pw = passwordSchema.safeParse(parsed.data.password)
  if (!pw.success) fieldErrors.password = pw.error.issues[0]?.message ?? 'Please choose a stronger password.'
  if (fieldErrors.accept || fieldErrors.password) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors }

  const live = await getLiveTerms(cfg.role)
  if (live.version !== parsed.data.termsVersion) {
    return { ok: false, error: 'The terms were updated while you were reading. Please reload the page and read the new version.' }
  }

  const paid = isPaidRole(cfg)
  const passwordHash = await hashJourneyPassword(pw.data!)
  const online = paid && isOnlinePaymentEnabled()

  let termsVersion = live.version
  const accepted = await prisma.$transaction(async (tx) => {
    const terms = await ensureLiveTerms(tx, cfg.role)
    termsVersion = terms.version
    // Conditional write: a double submit or a second tab can only accept once.
    const r = await tx.prospect.updateMany({
      where: { id: p.id, status: 'ORIENTATION_COMPLETED', roleTermsAcceptedAt: null, userId: null },
      data: { roleTermsAcceptedAt: new Date(), acceptedTermsId: terms.id, ...(paid ? { pendingPasswordHash: passwordHash } : {}) },
    })
    if (r.count !== 1) return false
    if (paid) {
      await openJourneyPayment(tx, p.id, cfg, online ? 'STRIPE' : 'MANUAL', null)
      await refreshJourneyToken(tx, p.id)
    }
    return true
  })
  if (!accepted) return { ok: false, error: 'You have already accepted the terms. Please reload the page.' }

  if (!paid) {
    const r = await completeJourney(p.id, { passwordHash })
    if (!r.ok) return { ok: false, error: r.error }
    await afterLoginExtras(p.id)
    return { ok: true, next: 'welcome' }
  }

  // Paid role.
  const amountLabel = `${formatDollars(cfg.priceCents)} (${billingLabel(cfg.billing)})`
  if (online) await startCheckout(p.id, p.email, cfg.label, cfg.priceCents, cfg.billing, t.data)
  else {
    await notifyPaymentToCollect(p.id, `${p.firstName} ${p.lastName}`, cfg.label, priceLabel(cfg))
    try {
      await sendEmail({ to: p.email, ...paymentArrangedEmail({ firstName: p.firstName, roleLabel: cfg.label, amountLabel, termsVersion, statusUrl: journeyLink(t.data, 'join') }) })
    } catch (e) {
      console.error('[JOURNEY-JOIN] payment email failed', e)
    }
  }
  await emailInviter(p.invitedById, `${p.firstName} ${p.lastName}`, `accepted the ${cfg.label} terms and is about to finish joining`)
  revalidatePath('/admin/journey-payments')
  return { ok: true, next: 'payment' }
}

/**
 * Terms already accepted and the login still missing (payment recorded but the automatic login
 * failed, or a free role whose login could not be made the first time): choose a password and try again.
 */
export async function createMyLogin(token: string, input: unknown): Promise<JoinResult> {
  const t = tokenSchema.safeParse(token)
  if (!t.success) return { ok: false, error: GENERIC }
  if (limited(t.data, await clientIp())) return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }
  const parsed = z.object({ password: z.string().max(200) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Please check the form and try again.' }

  const p = await prospectForJourney(t.data)
  if (!p || !journeyLinkUsable(p)) return { ok: false, error: GENERIC }
  const cfg = await prospectRoleConfig(p)
  if (!cfg) return { ok: false, error: 'This step is not open for your role.' }
  if (!p.roleTermsAcceptedAt || !canCreateLogin({ status: p.status, paid: isPaidRole(cfg), userId: p.userId, journeyRole: p.journeyRole })) {
    return { ok: false, error: p.userId ? 'Your login already exists. Please sign in.' : 'This step is not open yet. Please reload the page.' }
  }
  const pw = passwordSchema.safeParse(parsed.data.password)
  if (!pw.success) return { ok: false, error: 'Please fix the highlighted field.', fieldErrors: { password: pw.error.issues[0]?.message ?? 'Please choose a stronger password.' } }

  const r = await completeJourney(p.id, { passwordHash: await hashJourneyPassword(pw.data) })
  if (!r.ok) return { ok: false, error: r.error }
  await afterLoginExtras(p.id)
  return { ok: true, next: 'welcome' }
}

// ---------- admin ----------

const markPaidSchema = z.object({
  prospectId: z.string().min(1).max(100),
  reference: z.string().trim().max(200),
})

/**
 * Staff recorded the payment (cash, cheque, bank transfer, card taken by phone). Moves
 * PAYMENT_PENDING -> PAYMENT_COMPLETED and creates the login (markJourneyPaid -> completeJourney),
 * which emails the prospect "Your login is ready" with a receipt line. Safe to click twice.
 */
export async function markJourneyPaymentReceived(input: unknown): Promise<{ success: true; message: string } | { error: string }> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { error: 'Unauthorized' }
  if (session.user.isImpersonating) return { error: 'Switch back to your admin account first.' }
  const parsed = markPaidSchema.safeParse(input)
  if (!parsed.success) return { error: 'Please check the reference and try again.' }
  const { prospectId, reference } = parsed.data

  const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { id: true, journeyToken: true, status: true, firstName: true, lastName: true, payment: { select: { status: true, journeyRole: true } } } })
  if (!p || !p.journeyToken || !p.payment?.journeyRole) return { error: 'This is not a Get Involved payment.' }
  if (p.payment.status === 'COMPLETED') return { error: 'This payment is already recorded.' }
  if (p.status !== 'PAYMENT_PENDING') return { error: 'This prospect is not waiting for payment.' }

  const r = await markJourneyPaid(p.id, { method: 'MANUAL', reference: reference || `Recorded by staff`, byUserId: session.user.id })
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: 'JOURNEY_PAYMENT_RECEIVED', entityType: 'Prospect', entityId: p.id, details: JSON.stringify({ reference, loginCreated: r.ok }) },
  }).catch(() => {})
  revalidatePath('/admin/journey-payments')
  revalidatePath(`/admin/prospects/${p.id}`)
  if (!r.ok) {
    // markJourneyPaid only fails before anything changes if the payment was not pending.
    const now = await prisma.prospect.findUnique({ where: { id: p.id }, select: { status: true } })
    if (now?.status === 'PAYMENT_COMPLETED') return { success: true, message: `Payment recorded, but the login could not be created: ${r.error} ${p.firstName} can finish from their Join link.` }
    return { error: r.error }
  }
  await afterLoginExtras(p.id)
  return { success: true, message: `Payment recorded. ${p.firstName}'s login is ready and they have been emailed.` }
}

// ---------- helpers (not exported, so not endpoints) ----------

async function notifyPaymentToCollect(prospectId: string, name: string, roleLabel: string, price: string) {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } })
    if (!admins.length) return
    await prisma.adminNotification.createMany({
      data: admins.map((a) => ({
        userId: a.id, type: 'PROSPECT_STATUS_CHANGED' as const, title: 'Payment to collect',
        message: `${name} accepted the ${roleLabel} terms (${price}). Please contact them about payment, then mark it received.`,
        entityType: 'Prospect', entityId: prospectId, actionUrl: '/admin/journey-payments',
      })),
    })
  } catch (e) {
    console.error('[JOURNEY-JOIN] admin notification failed', e)
  }
}

/** Online payment (only when a provider is connected; never today). Stores the checkout on the payment row. */
async function startCheckout(prospectId: string, email: string, label: string, amountCents: number, billing: Parameters<typeof billingLabel>[0], token: string) {
  const provider = getPaymentProvider()
  if (!provider) return
  try {
    const s = await provider.createCheckout({
      prospectId, email, description: `${label} program`, amountCents, currency: 'USD', billing,
      successUrl: journeyLink(token, 'join'), cancelUrl: journeyLink(token, 'join'),
    })
    await prisma.prospectPayment.update({ where: { prospectId }, data: { checkoutUrl: s.url, stripeSessionId: s.sessionId } })
  } catch (e) {
    console.error('[JOURNEY-JOIN] checkout failed', e)
  }
}

/**
 * After a login is created: ambassador onboarding tasks (as ambassador-auth.ts does), and for 17 and
 * under, a PARENT login linked to the ambassador (Ambassador.parentUserId), as the existing parental
 * consent flow does. Never throws; nothing here blocks the prospect.
 */
async function afterLoginExtras(prospectId: string) {
  try {
    const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { userId: true, ageRange: true, parentEmail: true } })
    if (!p?.userId) return
    const amb = await prisma.ambassador.findUnique({ where: { userId: p.userId }, select: { id: true, parentUserId: true } })
    if (!amb) return
    const tasks = await prisma.ambassadorOnboardingTask.findMany({ where: { isActive: true }, select: { id: true } })
    if (tasks.length) {
      await prisma.ambassadorOnboardingProgress.createMany({ data: tasks.map((t) => ({ ambassadorId: amb.id, taskId: t.id, status: 'NOT_STARTED' as const })), skipDuplicates: true })
    }
    const parentEmail = p.parentEmail?.trim().toLowerCase()
    if (p.ageRange !== 'UNDER_18' || !parentEmail || amb.parentUserId) return
    const existing = await prisma.user.findUnique({ where: { email: parentEmail }, select: { id: true, role: true, parentOfAmbassador: { select: { id: true } } } })
    if (existing) {
      if (existing.role === 'PARENT' && !existing.parentOfAmbassador) await prisma.ambassador.update({ where: { id: amb.id }, data: { parentUserId: existing.id } })
      return
    }
    // Random password the parent never sees (same as ambassador-auth.ts); they can use "Forgot password".
    const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12)
    await prisma.$transaction(async (tx) => {
      const parent = await tx.user.create({ data: { email: parentEmail, password: hash, role: 'PARENT', status: 'ACTIVE' } })
      await tx.ambassador.update({ where: { id: amb.id }, data: { parentUserId: parent.id } })
    })
  } catch (e) {
    console.error('[JOURNEY-JOIN] after-login extras failed', e)
  }
}
