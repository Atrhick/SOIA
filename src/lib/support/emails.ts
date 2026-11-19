/**
 * Support messages: the words of every notification (in-app title/message and the email). PURE.
 * Senders never read a team member's name: replies come from "the NowTRANSFORMED team".
 * Every value a person typed goes through esc() (via quote()).
 */
import { P, SMALL, esc, layout, type Mail } from '@/lib/get-involved/emails'
import { clip, quote } from '@/lib/program-info/emails'
import { SENDER_STATUS_LABEL, categoryLabel, type SupportStatus } from './core'

export const TITLE_MAX = 120
export const MESSAGE_MAX = 240

const para = (html: string) => `<p style="${P}">${html}</p>`
const hi = (first: string) => para(`Hi ${esc(first.trim() || 'there')},`)
const curly = (s: string) => `“${s}”`
const TEAM_OPTS = { audience: 'team' as const }

export interface Note { title: string; message: string }

// ---------- to the team ----------

export interface TeamFacts {
  senderName: string
  /** "Coach", "Ambassador", "Volunteer"... */
  senderRoleLabel: string
  category: string
  subject: string
  /** The text to quote: the message body, or the sender's reply. */
  text: string
  url: string
}

export function newMessageNote(f: TeamFacts): Note {
  return {
    title: clip(`New help message from ${f.senderName}`, TITLE_MAX),
    message: clip(`${categoryLabel(f.category)}: ${f.subject}`, MESSAGE_MAX),
  }
}
export function newMessageEmail(f: TeamFacts, first: string): Mail {
  return {
    subject: clip(`New help message: ${f.subject}`, 150),
    html: layout(
      hi(first) +
        para(`${esc(f.senderName)} (${esc(f.senderRoleLabel)}) sent the team a message. It isn't assigned to anyone yet.`) +
        para(`<strong>${esc(categoryLabel(f.category))}</strong> · ${esc(f.subject)}`) +
        quote(f.text),
      { label: 'Open the message', url: f.url }, '', TEAM_OPTS,
    ),
  }
}

export function assignedNote(f: TeamFacts, byName: string): Note {
  return {
    title: clip(`${byName} gave you a help message`, TITLE_MAX),
    message: clip(`From ${f.senderName}. ${categoryLabel(f.category)}: ${f.subject}`, MESSAGE_MAX),
  }
}
export function assignedEmail(f: TeamFacts, byName: string, first: string): Mail {
  return {
    subject: clip(`Assigned to you: ${f.subject}`, 150),
    html: layout(
      hi(first) +
        para(`${esc(byName)} asked you to look after this message from ${esc(f.senderName)} (${esc(f.senderRoleLabel)}).`) +
        para(`<strong>${esc(categoryLabel(f.category))}</strong> · ${esc(f.subject)}`) +
        quote(f.text) +
        `<p style="${SMALL}">Reply in the app. They see your reply as coming from the NowTRANSFORMED team.</p>`,
      { label: 'Open the message', url: f.url }, '', TEAM_OPTS,
    ),
  }
}

export function senderRepliedNote(f: TeamFacts): Note {
  return {
    title: clip(`${f.senderName} replied`, TITLE_MAX),
    message: clip(`${f.subject}: ${curly(clip(f.text, 160))}`, MESSAGE_MAX),
  }
}
export function senderRepliedEmail(f: TeamFacts, first: string, unassigned: boolean): Mail {
  return {
    subject: clip(`${f.senderName} replied: ${f.subject}`, 150),
    html: layout(
      hi(first) +
        para(`${esc(f.senderName)} replied to their message ${esc(curly(f.subject))}.${unassigned ? " It isn't assigned to anyone yet." : ''}`) +
        quote(f.text),
      { label: 'Open the message', url: f.url }, '', TEAM_OPTS,
    ),
  }
}

// ---------- to the sender ----------

export type SenderEvent = 'REPLY' | 'STATUS' | 'ON_IT'

export interface SenderFacts {
  subject: string
  status: SupportStatus
  /** The team's reply (REPLY only). */
  text?: string
  url: string
}

function statusLine(s: SupportStatus): string {
  if (s === 'WAITING_ON_SENDER') return 'The team is waiting on you: please reply when you can.'
  if (s === 'DONE') return 'The team marked it done. If you still need help, just reply to it in the app and it opens again.'
  if (s === 'ASSIGNED') return 'The team is working on it.'
  return ''
}

export function senderNote(e: SenderEvent, f: SenderFacts): Note {
  if (e === 'REPLY') return { title: clip('The NowTRANSFORMED team replied', TITLE_MAX), message: clip(`${f.subject}: ${curly(clip(f.text ?? '', 160))}`, MESSAGE_MAX) }
  if (e === 'ON_IT') return { title: clip('The team is on your message', TITLE_MAX), message: clip(f.subject, MESSAGE_MAX) }
  return { title: clip(`Your message: ${SENDER_STATUS_LABEL[f.status]}`, TITLE_MAX), message: clip(`${f.subject}. ${statusLine(f.status)}`, MESSAGE_MAX) }
}

export function senderEmail(e: SenderEvent, f: SenderFacts, first: string): Mail {
  const about = esc(curly(f.subject))
  let subject: string
  let body: string
  if (e === 'REPLY') {
    subject = `The team replied: ${f.subject}`
    body = para(`The NowTRANSFORMED team replied to your message ${about}.`) + quote(f.text) +
      (f.status === 'WAITING_ON_SENDER' || f.status === 'DONE' ? para(esc(statusLine(f.status))) : '')
  } else if (e === 'ON_IT') {
    subject = `We're on it: ${f.subject}`
    body = para(`Thanks for your message ${about}. Someone on the NowTRANSFORMED team is looking at it now and will reply in the app.`)
  } else {
    subject = `${SENDER_STATUS_LABEL[f.status]}: ${f.subject}`
    body = para(`An update on your message ${about}.`) + para(esc(statusLine(f.status)))
  }
  return {
    subject: clip(subject, 150),
    html: layout(hi(first) + body + `<p style="${SMALL}">To answer, open the message and reply there, so it stays with the rest of the conversation.</p>`, { label: 'Open your message', url: f.url }, '', TEAM_OPTS),
  }
}
