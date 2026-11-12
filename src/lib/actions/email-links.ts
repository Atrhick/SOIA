'use server'

/**
 * One-tap email links (outreach round 1): the button on /email/[token] posts here. The token is signed
 * (src/lib/get-involved/email-links.ts) and never expires; each action re-checks the current state, so a
 * deleted prospect, a cancelled or past call, or a finished journey makes the link do nothing.
 */
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { ageRangeLabel } from '@/lib/get-involved/core'
import * as mail from '@/lib/get-involved/emails'
import { verifyEmailToken } from '@/lib/get-involved/email-links'
import { checkInDate } from '@/lib/get-involved/nudges'
import { callsPathFor, clientIp, emailInviter, notifyAdmins, rateLimited, userDisplayName } from '@/lib/get-involved/server'

type Result = { ok: true; message: string } | { error: string }

const GONE = 'This link no longer applies. If you need help, just reply to any of our emails.'

export async function runEmailLink(token: string): Promise<Result> {
  if (rateLimited(`emaillink:${await clientIp()}`, 20, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes and try again.' }
  const v = verifyEmailToken(typeof token === 'string' ? token : '')
  if (!v) return { error: 'This link is not valid.' }
  const now = new Date()
  try {
    switch (v.action) {
      case 'stop': {
        const p = await prisma.prospect.findUnique({ where: { id: v.id }, select: { id: true } })
        if (!p) return { error: GONE }
        await prisma.prospect.updateMany({ where: { id: p.id, emailOptOutAt: null }, data: { emailOptOutAt: now } })
        return { ok: true, message: "Done. We won't send you any more emails about this. If you have a call booked, you'll still get a reminder the day before and an hour before." }
      }

      case 'delete': {
        const p = await prisma.prospect.findUnique({
          where: { id: v.id },
          select: { id: true, firstName: true, lastName: true, email: true, ageRange: true, userId: true, payment: { select: { id: true } },
            discoveryCalls: { where: { status: 'BOOKED', startsAt: { gt: now } }, select: { startsAt: true, hostId: true } } },
        })
        if (!p) return { ok: true, message: 'Your details have been deleted.' }
        if (p.userId || p.payment) {
          // A login or a payment record must be handled by a person (accounts, receipts): opt out now and tell the admins.
          await prisma.prospect.updateMany({ where: { id: p.id, emailOptOutAt: null }, data: { emailOptOutAt: now } })
          await notifyAdmins('Asked to delete their details', `${p.firstName} ${p.lastName} (${p.email}) asked us to delete their details. They have a ${p.userId ? 'login' : 'payment record'}, so this needs a person. Emails are already stopped.`, p.id)
          return { ok: true, message: "We've stopped all emails. Because you have an account or a payment with us, our team will finish deleting your details and confirm by email." }
        }
        const r = await prisma.prospect.deleteMany({ where: { id: p.id, userId: null, payment: { is: null } } })
        if (r.count === 0) return { error: 'Something changed. Please reload the page and try again.' }
        // Their booked call went with them: tell the host it is off the calendar.
        for (const c of p.discoveryCalls) {
          const host = c.hostId ? await userDisplayName(c.hostId) : null
          if (host) await sendEmail({ to: host.email, ...mail.hostCallEmail({ kind: 'cancelled', hostName: host.first, prospectName: `${p.firstName} ${p.lastName}`, startsAt: c.startsAt, ageLabel: ageRangeLabel(p.ageRange), inviterName: null, phone: null, parent: null, callsUrl: mail.appUrl(callsPathFor(host.role)), tz: host.tz }) })
        }
        return { ok: true, message: "Your details have been deleted. We won't contact you again." }
      }

      case 'confirm': {
        const r = await prisma.discoveryCall.updateMany({ where: { id: v.id, status: 'BOOKED', startsAt: { gt: now } }, data: { attendanceConfirmedAt: now } })
        if (r.count === 0) return { error: 'This call has already happened, moved or been cancelled. Check your latest email for the current time.' }
        return { ok: true, message: 'Thanks for letting us know. See you then!' }
      }

      case 'later': {
        const r = await prisma.prospect.updateMany({
          where: { id: v.id, status: 'FORM_SUBMITTED', emailOptOutAt: null, checkInSentAt: null },
          data: { checkInAt: checkInDate(now) },
        })
        if (r.count === 0) return { error: GONE }
        return { ok: true, message: "No problem. We'll check in with you next month. Until then, no more reminders." }
      }

      case 'callme': {
        const p = await prisma.prospect.findUnique({ where: { id: v.id }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, ageRange: true, status: true, invitedById: true } })
        if (!p || !['FORM_SUBMITTED', 'DISCOVERY_BOOKED'].includes(p.status)) return { error: GONE }
        const open = await prisma.discoverySlotRequest.findFirst({ where: { prospectId: p.id, kind: 'REACH_OUT', handledAt: null }, select: { id: true } })
        if (!open) {
          await prisma.discoverySlotRequest.create({ data: { prospectId: p.id, kind: 'REACH_OUT' } })
          const name = `${p.firstName} ${p.lastName}`
          await notifyAdmins('Prospect asked us to call them', `${name} (${ageRangeLabel(p.ageRange)}) asked from an email for someone to call them instead of booking. Email ${p.email}${p.phone ? `, phone ${p.phone}` : ''}.`, p.id)
          await emailInviter(p.invitedById, name, 'asked us to call them. A quick message from you could help')
        }
        return { ok: true, message: 'Done. Someone from our team will reach out to you soon.' }
      }
    }
  } catch (e) {
    console.error('[EMAIL-LINK] action failed', e)
    return { error: 'Something went wrong. Please try again.' }
  }
  return { error: 'This link is not valid.' }
}
