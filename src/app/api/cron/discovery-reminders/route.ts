/**
 * Get Involved scheduled emails. Meant to be hit every 15 minutes by Cloud Scheduler with the header
 * `x-cron-secret: $CRON_SECRET`. Safe to run often or twice at once: every email is claimed with a
 * conditional update before it is sent.
 * - Discovery-call reminders to the prospect (parent copied for 17 and under): 3 days before (E10, only
 *   for calls booked 3+ days ahead; in nudges.ts), the day before (E10 copy, from 24h down to 3h before;
 *   skipped for calls booked less than 3h out) and 1 hour before. Hosts get the day-before and 1-hour ones.
 * - Outreach (nudges.ts): the E9 welcome ~20 min after an adult's sign-up if no call was booked, nudges
 *   on day 2 and day 7, the "Maybe later" check-in.
 * - Deletes under-18 sign-ups whose parent never answered within 14 days.
 * - Journey reminders (assessment after 2 days; orientation at the time the prospect picked).
 * Opted-out prospects (emailOptOutAt) get none of the automatic emails EXCEPT the day-before and
 * 1-hour reminders for a call they booked themselves.
 */
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import * as mail from '@/lib/get-involved/emails'
import { LINK_VALID_DAYS } from '@/lib/get-involved/core'
import { journeyUrl, userDisplayName } from '@/lib/get-involved/server'
import { runJourneyReminders } from '@/lib/get-involved/journey-steps'
import { runOutreachEmails } from '@/lib/get-involved/nudges'
import { primeEmailFooter } from '@/lib/get-involved/emails/footer-settings'
import { dayBeforeReminderEmail } from '@/lib/get-involved/emails/reminders'

export const dynamic = 'force-dynamic'

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const given = req.headers.get('x-cron-secret') ?? ''
  if (!secret || secret.length < 16) return false
  const a = Buffer.from(secret), b = Buffer.from(given)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function run() {
  const now = Date.now()
  const H = 3600_000
  const due = await prisma.discoveryCall.findMany({
    where: {
      status: 'BOOKED',
      prospect: { status: 'DISCOVERY_BOOKED' },
      startsAt: { gt: new Date(now), lte: new Date(now + 24 * H) },
      OR: [{ reminder24hSentAt: null }, { reminder1hSentAt: null }],
    },
    include: { prospect: true },
    take: 200,
  })
  let sent = 0
  for (const c of due) {
    const left = c.startsAt.getTime() - now
    const soon = left <= 75 * 60_000
    // Skip the 24 h reminder for calls booked less than a few hours out.
    if (!soon && (c.reminder24hSentAt || left < 3 * H)) continue
    if (soon && c.reminder1hSentAt) continue
    const claim = await prisma.discoveryCall.updateMany({
      where: { id: c.id, status: 'BOOKED', ...(soon ? { reminder1hSentAt: null } : { reminder24hSentAt: null }) },
      data: soon ? { reminder1hSentAt: new Date(), reminder24hSentAt: c.reminder24hSentAt ?? new Date() } : { reminder24hSentAt: new Date() },
    })
    if (claim.count === 0) continue
    const p = c.prospect
    const host = c.hostId ? await userDisplayName(c.hostId) : null
    const base = { firstName: p.firstName, startsAt: c.startsAt, tz: c.timezone, hostName: host?.full ?? 'our team', meetingUrl: c.meetingUrl, manageUrl: journeyUrl(p.journeyToken!), soon, prospectId: p.id }
    // Deliberately NOT skipped for emailOptOutAt: an opted-out person who booked a call asked for that
    // call, so they still get the day-before and 1-hour reminders (but not the 3-day one or any nudge).
    const parent = p.ageRange === 'UNDER_18' && p.parentEmail ? { first: (p.parentName ?? '').split(' ')[0] || 'Hi' } : null
    const build = (par: { first: string } | null) => soon
      ? mail.reminderEmail({ ...base, parent: par })
      : dayBeforeReminderEmail({ ...base, endsAt: c.endsAt, hostFirst: host?.first ?? null, parent: par })
    await sendEmail({ to: p.email, ...build(null) })
    if (parent) await sendEmail({ to: p.parentEmail!, ...build(parent) })
    // TODO(SMS): day-before text ("NowTransformed: Hi <first>, your call with <host> is tomorrow at <time>.
    // Link in your email. Reply STOP to opt out.") goes here when smsEnabled() (offer.ts) && p.smsConsentAt
    // && p.phone && !soon, only between 8 AM and 8 PM in c.timezone. No SMS provider is connected yet.
    if (host) await sendEmail({ to: host.email, ...mail.reminderEmail({ ...base, firstName: host.first, hostName: `${p.firstName} ${p.lastName}`, prospectId: null, toHost: true }) })
    sent++
  }
  return sent
}

/** As promised in the consent email: delete a minor's details if no parent answered within 14 days. */
async function sweepUnansweredConsent() {
  const cutoff = new Date(Date.now() - LINK_VALID_DAYS * 86400_000)
  const r = await prisma.prospect.deleteMany({ where: { status: 'AWAITING_PARENT_CONSENT', parentConsentAt: null, parentConsentRequestedAt: { lt: cutoff } } })
  return r.count
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await primeEmailFooter()
    const sent = await run()
    const deleted = await sweepUnansweredConsent()
    const journey = await runJourneyReminders()
    const outreach = await runOutreachEmails()
    return NextResponse.json({ ok: true, sent, deleted, journey, outreach })
  } catch (e) {
    console.error('[CRON] discovery reminders failed', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export const GET = POST
