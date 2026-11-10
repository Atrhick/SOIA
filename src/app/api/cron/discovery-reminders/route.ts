/**
 * Sends discovery-call reminders: about 24 hours and 1 hour before.
 * Meant to be hit every 15 minutes by Cloud Scheduler with the header
 * `x-cron-secret: $CRON_SECRET`. Safe to run often or twice at once: each
 * reminder is claimed with a conditional update before it is sent.
 * Also deletes under-18 sign-ups whose parent never answered within 14 days, and sends the
 * journey reminders (assessment after 2 days; orientation at the time the prospect picked).
 */
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import * as mail from '@/lib/get-involved/emails'
import { LINK_VALID_DAYS } from '@/lib/get-involved/core'
import { journeyUrl, userDisplayName } from '@/lib/get-involved/server'
import { runJourneyReminders } from '@/lib/get-involved/journey-steps'

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
    const base = { firstName: p.firstName, startsAt: c.startsAt, tz: c.timezone, hostName: host?.full ?? 'our team', meetingUrl: c.meetingUrl, manageUrl: journeyUrl(p.journeyToken!), soon }
    await sendEmail({ to: p.email, ...mail.reminderEmail(base) })
    if (p.ageRange === 'UNDER_18' && p.parentEmail) {
      await sendEmail({ to: p.parentEmail, ...mail.reminderEmail({ ...base, parent: { first: (p.parentName ?? '').split(' ')[0] || 'Hi' } }) })
    }
    if (host) await sendEmail({ to: host.email, ...mail.reminderEmail({ ...base, firstName: host.first, hostName: `${p.firstName} ${p.lastName}` }) })
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
    const sent = await run()
    const deleted = await sweepUnansweredConsent()
    const journey = await runJourneyReminders()
    return NextResponse.json({ ok: true, sent, deleted, journey })
  } catch (e) {
    console.error('[CRON] discovery reminders failed', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export const GET = POST
