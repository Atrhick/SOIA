'use server'

/**
 * Public action for the "No open times" state of /discovery/[token] (board PNoSlots):
 * "Email me when times open up" and "Ask someone to reach out to me". Token-checked and rate limited.
 */
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { AgeRangeValue, ageRangeLabel, journeyOpen } from '@/lib/get-involved/core'
import { clientIp, emailInviter, journeyUsable, notifyAdmins, prospectByJourneyToken, rateLimited } from '@/lib/get-involved/server'
import { openSlotsWithBlocks } from '@/lib/get-involved/discovery-slots'

type Result = { success: true; message: string } | { error: string }

const schema = z.object({ token: z.string().min(16).max(200), kind: z.enum(['NOTIFY', 'REACH_OUT']) })

export async function requestSlotHelp(token: string, kind: 'NOTIFY' | 'REACH_OUT'): Promise<Result> {
  if (rateLimited(`slothelp:${await clientIp()}`, 10, 10 * 60_000)) return { error: 'Too many attempts. Please wait a few minutes.' }
  const parsed = schema.safeParse({ token, kind })
  if (!parsed.success) return { error: 'Please reload the page and try again.' }
  if (rateLimited(`slothelp:t:${parsed.data.token}`, 4, 60 * 60_000)) return { error: 'We already have your request. We will be in touch.' }
  const p = await prospectByJourneyToken(parsed.data.token)
  const now = new Date()
  if (!p || !journeyUsable(p, now)) return { error: 'This link has expired. Request a new one below.' }
  if (!journeyOpen(p.status) || p.discoveryCalls.length > 0) return { error: 'You already have a call booked. Reload the page to see it.' }
  if (p.ageRange === 'UNDER_18' && !p.parentConsentAt) return { error: 'We need your parent or guardian to give consent first.' }

  const { slots } = await openSlotsWithBlocks(p.ageRange as AgeRangeValue | null, now)
  if (slots.length > 0) return { error: 'Good news: times just opened. Reload the page to pick one.' }

  const k = parsed.data.kind
  const open = await prisma.discoverySlotRequest.findFirst({ where: { prospectId: p.id, kind: k, handledAt: null }, select: { id: true } })
  if (!open) await prisma.discoverySlotRequest.create({ data: { prospectId: p.id, kind: k } })
  const name = `${p.firstName} ${p.lastName}`
  if (!open) {
    if (k === 'REACH_OUT') {
      await notifyAdmins('Prospect asked us to reach out', `${name} (${ageRangeLabel(p.ageRange)}) found no open call times and asked for someone to reach out. Email ${p.email}${p.phone ? `, phone ${p.phone}` : ''}.`, p.id)
      await emailInviter(p.invitedById, name, 'found no open call times and asked us to reach out. A quick message from you could help')
    } else {
      await notifyAdmins('Prospect waiting for call times', `${name} (${ageRangeLabel(p.ageRange)}) asked to be emailed when discovery call times open.`, p.id)
    }
  }
  return {
    success: true,
    message: k === 'NOTIFY'
      ? "Done. We'll email you as soon as new times open."
      : "Done. Someone from our team will reach out to you soon.",
  }
}
