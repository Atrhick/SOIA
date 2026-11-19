/**
 * Support messages: who hears about what. One call per event, AFTER the transaction:
 *
 *   await notifySupport('NEW_MESSAGE', { messageId, actorId })
 *
 * In-app AdminNotification rows (type SUPPORT; the prisma middleware also pushes them to phones, one push tag
 * per message) plus an email to each person. Never throws, never notifies the person who did the action.
 * Server only. NOT 'use server'.
 *
 * - NEW_MESSAGE: every active ADMIN and SUB_ADMIN.
 * - ASSIGNED: the assignee. With extra.wasNew, the sender also hears "the team is on it".
 * - TEAM_REPLY / STATUS: the sender (a team member's name is never shown to them).
 * - SENDER_REPLY: the assignee, or every active ADMIN when nobody has it.
 */
import prisma, { withPushTag } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { appUrl, type Mail } from '@/lib/get-involved/emails'
import { ASSOCIATE_LABELS, isAssociateRole } from '@/lib/roles'
import { senderMessagePath, teamMessagePath, type SupportStatus } from './core'
import {
  assignedEmail, assignedNote, newMessageEmail, newMessageNote, senderEmail, senderNote, senderRepliedEmail,
  senderRepliedNote, type Note, type SenderEvent, type TeamFacts,
} from './emails'

export type SupportEvent = 'NEW_MESSAGE' | 'ASSIGNED' | 'TEAM_REPLY' | 'STATUS' | 'SENDER_REPLY'

export interface SupportNotifyInput {
  messageId: string
  actorId: string
  extra?: {
    /** TEAM_REPLY / SENDER_REPLY: the reply text. */
    text?: string
    /** ASSIGNED: the message was New, so the sender hears the team picked it up. */
    wasNew?: boolean
  }
}

interface Person { id: string; email: string; first: string; role: string }

const personSelect = {
  id: true, email: true, role: true, status: true,
  coachProfile: { select: { firstName: true, lastName: true } },
  ambassadorProfile: { select: { firstName: true, lastName: true } },
  associateProfile: { select: { firstName: true, lastName: true } },
} as const

type PersonRow = {
  id: string; email: string; role: string; status: string
  coachProfile: { firstName: string; lastName: string } | null
  ambassadorProfile: { firstName: string; lastName: string } | null
  associateProfile: { firstName: string; lastName: string } | null
}

/** First and full name from whichever profile the login has, else the email's local part. */
export function namesOf(u: Pick<PersonRow, 'email' | 'coachProfile' | 'ambassadorProfile' | 'associateProfile'>, prefer?: string): { first: string; full: string } {
  const p = prefer === 'AMBASSADOR' ? u.ambassadorProfile ?? u.coachProfile ?? u.associateProfile : u.coachProfile ?? u.ambassadorProfile ?? u.associateProfile
  if (p) return { first: p.firstName, full: `${p.firstName} ${p.lastName}`.trim() }
  const local = u.email.split('@')[0]
  return { first: local, full: local }
}

export function roleLabel(role: string): string {
  if (isAssociateRole(role)) return ASSOCIATE_LABELS[role]
  if (role === 'AMBASSADOR') return 'Ambassador'
  if (role === 'COACH') return 'Coach'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

const toPerson = (u: PersonRow): Person => ({ id: u.id, email: u.email, first: namesOf(u).first, role: u.role })

async function teamPeople(roles: ('ADMIN' | 'SUB_ADMIN')[]): Promise<Person[]> {
  const rows = await prisma.user.findMany({ where: { role: { in: roles }, status: 'ACTIVE' }, select: personSelect })
  return rows.map(toPerson)
}

async function send(messageId: string, people: Person[], note: Note, url: (p: Person) => string, mail: (p: Person) => Mail) {
  if (!people.length) return
  await withPushTag(`support-${messageId}`, async () => {
    await prisma.adminNotification.createMany({
      data: people.map((p) => ({ userId: p.id, type: 'SUPPORT' as const, title: note.title, message: note.message, entityType: 'SupportMessage', entityId: messageId, actionUrl: url(p) })),
    })
  })
  await Promise.allSettled(people.map((p) => sendEmail({ to: p.email, ...mail(p) })))
}

/** Sends one event. Returns how many people it reached (for logs). */
export async function notifySupport(event: SupportEvent, input: SupportNotifyInput): Promise<number> {
  try {
    const m = await prisma.supportMessage.findUnique({
      where: { id: input.messageId },
      select: {
        id: true, subject: true, body: true, category: true, status: true, senderRole: true, assignedToId: true,
        sender: { select: personSelect },
        assignedTo: { select: personSelect },
      },
    })
    if (!m) return 0
    const notActor = (p: Person) => p.id !== input.actorId
    const senderNames = namesOf(m.sender, m.senderRole)
    const facts = (text: string, url: string): TeamFacts => ({
      senderName: senderNames.full, senderRoleLabel: roleLabel(m.senderRole), category: m.category, subject: m.subject, text, url,
    })
    const teamUrl = (p: Person) => teamMessagePath(p.role, m.id)
    const senderPath = senderMessagePath(m.senderRole, m.id)

    const toSender = async (e: SenderEvent) => {
      if (m.sender.status !== 'ACTIVE' || m.sender.id === input.actorId) return 0
      const sender: Person = { id: m.sender.id, email: m.sender.email, first: senderNames.first, role: m.senderRole }
      const f = { subject: m.subject, status: m.status as SupportStatus, text: input.extra?.text, url: appUrl(senderPath) }
      await send(m.id, [sender], senderNote(e, f), () => senderPath, (p) => senderEmail(e, f, p.first))
      return 1
    }

    if (event === 'NEW_MESSAGE') {
      const people = (await teamPeople(['ADMIN', 'SUB_ADMIN'])).filter(notActor)
      await send(m.id, people, newMessageNote(facts(m.body, '')), teamUrl, (p) => newMessageEmail(facts(m.body, appUrl(teamUrl(p))), p.first))
      return people.length
    }

    if (event === 'ASSIGNED') {
      let n = 0
      const a = m.assignedTo
      if (a && a.status === 'ACTIVE' && a.id !== input.actorId) {
        const actor = await prisma.user.findUnique({ where: { id: input.actorId }, select: personSelect })
        const byName = actor ? namesOf(actor).full : 'An admin'
        const p = toPerson(a)
        await send(m.id, [p], assignedNote(facts(m.body, ''), byName), teamUrl, (q) => assignedEmail(facts(m.body, appUrl(teamUrl(q))), byName, q.first))
        n++
      }
      if (input.extra?.wasNew) n += await toSender('ON_IT')
      return n
    }

    if (event === 'TEAM_REPLY') return toSender('REPLY')
    if (event === 'STATUS') return toSender('STATUS')

    // SENDER_REPLY
    const text = input.extra?.text ?? ''
    const people = (m.assignedTo && m.assignedTo.status === 'ACTIVE' ? [toPerson(m.assignedTo)] : await teamPeople(['ADMIN'])).filter(notActor)
    const unassigned = !m.assignedToId
    await send(m.id, people, senderRepliedNote(facts(text, '')), teamUrl, (p) => senderRepliedEmail(facts(text, appUrl(teamUrl(p))), p.first, unassigned))
    return people.length
  } catch (e) {
    console.error('[SUPPORT] notify failed', event, e)
    return 0
  }
}
