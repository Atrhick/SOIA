/**
 * Program info workflow: the words of every notification (BUILD-SPEC "Notifications", copy from the
 * approved Notify mockup). PURE: NotifyContext in, text/HTML out. Sending is notify.ts (one event) and
 * reminders.ts (the batched day-3/day-7 reminder).
 *
 * Rules: greet by first name; one button that opens the exact screen; "your <Group> page" via the
 * pageName/yourPageName helpers (never "null page"); team emails name the owner, program and group and
 * quote the owner's own words, escaped. In-app title/message stay short (push cuts at 120/240).
 * Never "nonprofit", never money amounts, "grant" or "seat" in anything the owner reads.
 */
import { P, SMALL, appUrl, esc, layout, type Mail } from '@/lib/get-involved/emails'
import { TEAM_QUEUE_PATH, pageName, programsHome, yourPageName } from './paths'
import type { NotifyContext, ProgramPageNotifyEvent } from './notify'

export const TITLE_MAX = 120
export const MESSAGE_MAX = 240
/** Longest stretch of a person's words quoted in an email. */
const QUOTE_MAX = 2000

// ---------- small helpers ----------

/** One line, cut to n characters with an ellipsis. */
export function clip(text: string | null | undefined, n: number): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s
}

const trimmed = (v: string | null | undefined) => (typeof v === 'string' ? v.trim() : '')

const isOneGroup = (c: NotifyContext) => !c.group || c.group === c.programName

/** "Families page" / "Financial Empowerment page" (one group). */
const page = (c: NotifyContext) => pageName(isOneGroup(c) ? null : c.group, c.programName)
/** "your Families page" (A2: never "your null page"). */
const yourPage = (c: NotifyContext) => yourPageName({ audienceLabel: isOneGroup(c) ? null : c.group, programName: c.programName })
const YourPage = (c: NotifyContext) => { const s = yourPage(c); return s.charAt(0).toUpperCase() + s.slice(1) }

/** Team wording: "Financial Empowerment · Families", or just the program name on a one-group program. */
export function teamTag(c: Pick<NotifyContext, 'programName' | 'group'>): string {
  return !c.group || c.group === c.programName ? c.programName : `${c.programName} · ${c.group}`
}
/** "Financial Empowerment · Families (BrightPath Coaching)" for team email bodies. */
const teamTagLong = (c: NotifyContext) => {
  const co = trimmed(c.companyName)
  return co && co !== c.programName ? `${teamTag(c)} (${co})` : teamTag(c)
}

const para = (html: string) => `<p style="${P}">${html}</p>`
const hi = (first: string) => para(`Hi ${esc(trimmed(first) || 'there')},`)

/** A person's own words, escaped, line breaks kept. Empty text renders nothing. */
export function quote(text: string | null | undefined, label?: string): string {
  const t = trimmed(text)
  if (!t) return ''
  const body = esc(t.length > QUOTE_MAX ? `${t.slice(0, QUOTE_MAX - 1)}…` : t).replace(/\r?\n/g, '<br>')
  return `${label ? `<p style="${P};margin-bottom:6px;font-weight:600;color:#111827">${esc(label)}</p>` : ''}<blockquote style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #a78bfa;background:#f9fafb;border-radius:0 8px 8px 0;color:#111827;font-size:15px;line-height:1.55">${body}</blockquote>`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "2 sections to go, about 5 minutes" from the sections still missing. */
export function sectionsToGo(left: number | null | undefined): string {
  if (left === null || left === undefined) return 'Just a few minutes to finish'
  if (left <= 0) return "All your sections are done. Send them and we'll write the page"
  return `${plural(left, 'section', 'sections')} to go, about ${left <= 2 ? 5 : 10} minutes`
}

/** Words in a push/bell line, wrapped once in curly quotes (no nested straight quotes). */
const curly = (text: string) => `“${text}”`

const isOwnerEvent = (e: ProgramPageNotifyEvent) => e.startsWith('C')

/** Where the button goes (absolute). Owner events: the owner's screen; team events: the team screen (T8: the queue). */
export function linkFor(c: NotifyContext): string {
  if (isOwnerEvent(c.event)) return appUrl(c.ownerPath || programsHome(c.ownerRole))
  if (c.event === 'T8_ANOTHER_PROGRAM') return appUrl(TEAM_QUEUE_PATH)
  return appUrl(c.teamPath)
}

/** T6: "added Business owners; renamed X" -> ["Added Business owners.", "Renamed X."]. */
export function changeLines(summary: string | null | undefined): string[] {
  return trimmed(summary).split(/\s*[;\n]\s*/).map((s) => s.trim()).filter(Boolean)
    .map((s) => { const t = s.charAt(0).toUpperCase() + s.slice(1); return /[.!?]$/.test(t) ? t : `${t}.` })
}

// ---------- the templates ----------

interface Template {
  subject: (c: NotifyContext) => string
  /** In-app/push title; default = subject. */
  title?: (c: NotifyContext) => string
  /** In-app/push body. */
  message: (c: NotifyContext) => string
  /** Email body (after "Hi <first>,"). Raw HTML: escape everything a person typed. */
  body: (c: NotifyContext) => string
  /** Button label. */
  button: (c: NotifyContext) => string
}

const reasonText = (c: NotifyContext) => trimmed(c.extra.reason)
const QUESTION_LABEL = 'Our question'
const LAST_REMINDER = "This is the last reminder we'll send. If now isn't a good time, just reply and tell us."

/** C9 wording by stage (single page). */
function reminderParts(c: NotifyContext): { subject: string; message: string; body: string; button: string } {
  const last = c.extra.reminderDay === 7 ? para(LAST_REMINDER) : ''
  if (c.stage === 'READY_TO_CHECK') {
    return {
      subject: `${YourPage(c)} is ready for you to check`,
      message: 'About 5 minutes to read. Nothing goes live until you say so.',
      body: para(`${esc(YourPage(c))} is written and ready for you to check. It takes about 5 minutes to read.`)
        + para(`If you're happy with it, you can put it live with one tap. If something isn't right, tell us what to change. ${NOTHING_LIVE}`) + last,
      button: checkButton(c),
    }
  }
  if (c.stage === 'QUESTION_OPEN') {
    return {
      subject: `One question about ${yourPage(c)}`,
      message: 'The team needs one answer to finish your page. Tap to answer.',
      body: para(`We still need one answer from you to finish ${esc(yourPage(c))}.`)
        + quote(c.extra.question, QUESTION_LABEL)
        + para('It only takes a minute, and your other answers are saved.') + last,
      button: 'Answer the question',
    }
  }
  const left = c.extra.sectionsLeft
  return {
    subject: `Finish your answers for ${yourPage(c)}`,
    message: `${sectionsToGo(left)}. Tap to continue.`,
    body: para(`You've made a good start on ${esc(yourPage(c))}. ${esc(sectionsToGo(left))}.`)
      + para("Everything you've typed is saved. Send them when you're done and we'll write the page.") + last,
    button: left !== undefined && left !== null && left <= 0 ? 'Send my answers' : 'Continue my answers',
  }
}

/** T7: what the page has been waiting for, as a full sentence. */
function stalledSentence(c: NotifyContext): string {
  const tag = teamTag(c)
  if (c.stage === 'READY_TO_CHECK') return `${c.ownerName}'s ${tag} page has been ready for them to check for 10 days.`
  if (c.stage === 'QUESTION_OPEN') return `${c.ownerName} has not answered our question about the ${tag} page for 10 days.`
  return `${c.ownerName} started the answers for the ${tag} page but has not finished them in 10 days.`
}
const STALLED_ASK = 'Reminders went out. Please give them a call.'

const openTeamPage = (c: NotifyContext) => `Open the ${page(c)}`
/** Owner button: "Check my page", or "Check my Families page" when the program has groups (never the long program name). */
const checkButton = (c: NotifyContext) => (isOneGroup(c) ? 'Check my page' : `Check my ${c.group} page`)
const NOTHING_LIVE = 'Nothing goes live until you say so.'

const T: Record<ProgramPageNotifyEvent, Template> = {
  // ----- to the page owner (coach or ambassador) -----
  C1_QUESTION: {
    subject: (c) => `One question about ${yourPage(c)}`,
    message: () => 'The team needs one answer to finish your page. Tap to answer.',
    body: (c) => para(`We're writing ${esc(yourPage(c))} and need one answer from you to finish it.`)
      + quote(c.extra.question, QUESTION_LABEL)
      + para('It only takes a minute, and your other answers are saved.'),
    button: () => 'Answer the question',
  },
  C2_READY_FIRST: {
    subject: (c) => `${YourPage(c)} is ready to check`,
    message: () => `About 5 minutes to read. ${NOTHING_LIVE}`,
    body: (c) => para(`${esc(YourPage(c))} is written, using your own answers. It takes about 5 minutes to read.`)
      + para("We also wrote two short pieces to go with it: the welcome email people get when they sign up, and a line you can paste when you invite someone.")
      + para(`If you're happy with it, you can put it live with one tap. If something isn't right, tell us what to change. ${NOTHING_LIVE}`),
    button: checkButton,
  },
  C3_CHANGES_MADE: {
    subject: (c) => `We've made your changes to ${yourPage(c)}`,
    message: (c) => `${YourPage(c)} is ready to check again.`,
    body: (c) => para(`We've made the changes you asked for on ${esc(yourPage(c))}.`)
      + para(`Have another read. If it's right now, you can put it live with one tap. If something is still off, tell us. ${NOTHING_LIVE}`),
    button: checkButton,
  },
  C4_UPDATE_READY: {
    subject: (c) => `Your updated ${page(c)} is ready to check`,
    message: () => 'Your live page stays as it is until you say this version is right.',
    body: (c) => para(`We've written a new version of ${esc(yourPage(c))} from your changed answers.`)
      + para('Your live page stays exactly as it is until you say this version is right. If something is off, tell us what to change.'),
    button: () => 'Check the new version',
  },
  C5_LIVE: {
    subject: (c) => `${YourPage(c)} is live`,
    message: () => 'Tap to copy your link and start sharing it.',
    body: (c) => {
      const link = c.publicPath ? appUrl(c.publicPath) : ''
      return para(`${esc(YourPage(c))} is live. Thank you for checking it.`)
        + (link ? `<p style="${P};margin-bottom:6px;font-weight:600;color:#111827">Your link</p><p style="${P}"><a href="${esc(link)}" style="color:#0369a1;word-break:break-all">${esc(link)}</a></p>` : '')
        + para('Press "Copy my link" below, then paste it into a text, an email or a post. Everyone who signs up gets your welcome email and can book a free call.')
    },
    button: () => 'Copy my link',
  },
  C6_PUBLISHED_ON_BEHALF: {
    subject: (c) => `We put ${yourPage(c)} live`,
    message: (c) => clip(`Your page is live.${reasonText(c) ? ` Why: ${reasonText(c)}` : ''}`, MESSAGE_MAX),
    body: (c) => para(`We put ${esc(yourPage(c))} live for you.`)
      + quote(reasonText(c), 'Why')
      + para("Have a read when you can. If something needs changing, tell us and we'll fix it."),
    button: () => 'See my live page',
  },
  C7_OFFLINE: {
    subject: (c) => `${YourPage(c)} is offline`,
    message: (c) => clip(`We took it offline for now. While it's offline, your link takes people to your main sign-up page.${reasonText(c) ? ` Why: ${reasonText(c)}` : ''}`, MESSAGE_MAX),
    body: (c) => para(`We've taken ${esc(yourPage(c))} offline for now. While it's offline, your link takes people to your main sign-up page.`)
      + quote(reasonText(c), 'Why'),
    button: () => 'See my page status',
  },
  C7_BACK_ONLINE: {
    subject: (c) => `${YourPage(c)} is back online`,
    message: (c) => clip(`Your link works again.${reasonText(c) ? ` Note from the team: ${reasonText(c)}` : ''}`, MESSAGE_MAX),
    body: (c) => para(`${esc(YourPage(c))} is back online and your link works again. Keep sharing it.`)
      + quote(reasonText(c), 'Note from the team'),
    button: () => 'See my live page',
  },
  C8_TELL_US: {
    subject: (c) => `Tell us about ${yourPage(c)}`,
    message: () => 'Answer 5 short sections, about 10 minutes. We write the page for you.',
    body: (c) => para(isOneGroup(c)
      ? `${esc(YourPage(c))} is ready for your answers.`
      : `${esc(c.programName)} has a page for ${esc(c.group)}, and it's ready for your answers.`)
      + para('Answer 5 short sections in your own words, about 10 minutes. We do the writing, and you check the page before anything goes live.'),
    button: () => 'Start my answers',
  },
  C9_REMINDER: {
    subject: (c) => reminderParts(c).subject,
    message: (c) => reminderParts(c).message,
    body: (c) => reminderParts(c).body,
    button: (c) => reminderParts(c).button,
  },
  C10_ANSWERS_RECEIVED: {
    subject: (c) => `We have your answers for ${yourPage(c)}`,
    message: () => "We're writing your page now. We'll let you know when it's ready to check.",
    body: (c) => para(`Thank you. We have your answers for ${esc(yourPage(c))} and we're writing it now.`)
      + para("We'll let you know when it's ready to check. Nothing to do until then."),
    button: () => 'See what I sent',
  },
  C10_REQUEST_RECEIVED: {
    subject: () => 'We have your request for another program',
    message: () => "The team will be in touch about it. You don't need to do anything else.",
    body: () => para("Thank you. We have your request for another program. The team will be in touch about it, and you don't need to do anything else."),
    button: () => 'Open My programs',
  },

  // ----- to the team -----
  T1_ANSWERS_SENT: {
    subject: (c) => `${c.ownerName} ${c.extra.changed ? 'changed' : 'sent'} the ${teamTag(c)} answers`,
    message: (c) => clip(c.extra.changed ? `Changed answers. Ready to write.${trimmed(c.extra.note) ? ` Note: ${curly(trimmed(c.extra.note))}` : ''}` : 'New answers. Ready to write.', MESSAGE_MAX),
    body: (c) => para(c.extra.changed
      ? `<strong>${esc(c.ownerName)}</strong> changed the answers for <strong>${esc(teamTagLong(c))}</strong>. The page screen shows what changed, answer by answer. Ready to write.`
      : `<strong>${esc(c.ownerName)}</strong> sent the answers for <strong>${esc(teamTagLong(c))}</strong>. Ready to write.`)
      + quote(c.extra.note, `${firstWord(c.ownerName)}'s note`),
    button: openTeamPage,
  },
  T2_QUESTION_ANSWERED: {
    subject: (c) => `${c.ownerName} answered your question about ${teamTag(c)}`,
    message: (c) => clip(trimmed(c.extra.answerText) ? curly(trimmed(c.extra.answerText)) : 'The answer is on the page.', MESSAGE_MAX),
    body: (c) => para(`<strong>${esc(c.ownerName)}</strong> answered the question about <strong>${esc(teamTagLong(c))}</strong>.`)
      + quote(c.extra.question, 'You asked')
      + (trimmed(c.extra.answerText) ? quote(c.extra.answerText, `${firstWord(c.ownerName)} said`) : para('The answer is on the page.')),
    button: openTeamPage,
  },
  T3_CHANGES_ASKED: {
    subject: (c) => `${c.ownerName} asked for changes to the ${teamTag(c)} page`,
    message: (c) => clip(trimmed(c.extra.changeRequest) ? curly(trimmed(c.extra.changeRequest)) : 'See the request on the page.', MESSAGE_MAX),
    body: (c) => para(`<strong>${esc(c.ownerName)}</strong> read the <strong>${esc(teamTagLong(c))}</strong> page and asked for changes.`)
      + (trimmed(c.extra.changeRequest) ? quote(c.extra.changeRequest, `${firstWord(c.ownerName)} asked`) : para('The request is on the page.')),
    button: openTeamPage,
  },
  T4_APPROVED: {
    subject: (c) => `${c.ownerName} pressed "Looks good, put it live" on the ${teamTag(c)} page`,
    message: () => "It's live now.",
    body: (c) => para(`<strong>${esc(c.ownerName)}</strong> pressed "Looks good, put it live" on the <strong>${esc(teamTagLong(c))}</strong> page. It's live now.`),
    button: openTeamPage,
  },
  T5_OWNER_OFFLINE: {
    subject: (c) => `${c.ownerName} took the ${teamTag(c)} page offline`,
    message: (c) => clip(`While it's offline, its link takes people to their main sign-up page.${reasonText(c) ? ` Why: ${curly(reasonText(c))}` : ''}`, MESSAGE_MAX),
    body: (c) => para(`<strong>${esc(c.ownerName)}</strong> took the <strong>${esc(teamTagLong(c))}</strong> page offline. While it's offline, its link takes people to their main sign-up page.`)
      + quote(reasonText(c), `${firstWord(c.ownerName)}'s reason`),
    button: openTeamPage,
  },
  T5_OWNER_BACK_ONLINE: {
    subject: (c) => `${c.ownerName} put the ${teamTag(c)} page back online`,
    message: () => 'The page is live again.',
    body: (c) => para(`<strong>${esc(c.ownerName)}</strong> put the <strong>${esc(teamTagLong(c))}</strong> page back online.`),
    button: openTeamPage,
  },
  T6_NAMES_CHANGED: {
    subject: (c) => `${c.ownerName} changed names or groups for ${c.programName}`,
    message: (c) => clip(changeLines(c.extra.summary).join(' ') || 'See the program pages.', MESSAGE_MAX),
    body: (c) => para(`<strong>${esc(c.ownerName)}</strong> changed the names or groups for <strong>${esc(c.programName)}</strong>.`)
      + quote(changeLines(c.extra.summary).join('\n'), 'What changed'),
    button: openTeamPage,
  },
  T7_STALLED: {
    subject: (c) => `Stalled: ${teamTag(c)}`,
    message: (c) => clip(`${stalledSentence(c)} ${STALLED_ASK}`, MESSAGE_MAX),
    body: (c) => para(`${esc(stalledSentence(c))} ${STALLED_ASK}`),
    button: openTeamPage,
  },
  T8_ANOTHER_PROGRAM: {
    subject: (c) => `${c.ownerName} asked for another program`,
    message: (c) => clip(trimmed(c.extra.requestText) ? curly(trimmed(c.extra.requestText)) : 'No details given.', MESSAGE_MAX),
    body: (c) => para(`<strong>${esc(c.ownerName)}</strong> asked for another program.`)
      + (trimmed(c.extra.requestText) ? quote(c.extra.requestText, `${firstWord(c.ownerName)} wrote`) : para('No details given.')),
    button: () => 'Open program pages',
  },
}

function firstWord(name: string): string {
  return trimmed(name).split(/\s+/)[0] || 'Their'
}

// ---------- public API ----------

/** The shared frame, with the existing sign-off. Team emails drop the "just reply" line (replies reach no one useful). */
function frame(body: string, cta: { label: string; url: string }, after: string, team: boolean): string {
  const html = layout(body, cta, after, { audience: 'team' })
  return team ? html.replace(/<p[^>]*>Questions\? Just reply to this email\.<\/p>\s*/, '') : html
}

/** In-app (bell + push) title and message for one event. */
export function programPageText(c: NotifyContext): { title: string; message: string } {
  const t = T[c.event]
  return { title: clip((t.title ?? t.subject)(c), TITLE_MAX), message: clip(t.message(c), MESSAGE_MAX) }
}

/** The email for one event, to one person. */
export function programPageEmail(c: NotifyContext, recipientFirst: string): Mail {
  const t = T[c.event]
  const team = !isOwnerEvent(c.event)
  return {
    subject: clip(t.subject(c), 160),
    html: frame(
      hi(recipientFirst) + t.body(c),
      { label: t.button(c), url: linkFor(c) },
      team ? `<p style="${SMALL}">You get this because you're an admin on the program pages team.</p>` : '',
      team,
    ),
  }
}

// ---------- C9: the batched reminder ----------

/** One page in a reminder, with its context (event C9_REMINDER). */
export interface ReminderPage {
  c: NotifyContext
}

function reminderLine(c: NotifyContext): string {
  if (c.stage === 'READY_TO_CHECK') return 'ready for you to check'
  if (c.stage === 'QUESTION_OPEN') return 'one question from the team'
  const left = c.extra.sectionsLeft
  return left !== undefined && left !== null && left <= 0 ? 'all sections done, ready to send' : sectionsToGo(left)
}

/**
 * The reminder for one owner: the single-page C9 template, or for 2+ pages one email listing each page
 * with its own link ("2 of your pages need you"). Also returns the in-app row and where it links.
 */
export function reminderMessage(pages: ReminderPage[], recipientFirst: string): Mail & { title: string; message: string; actionPath: string } {
  if (pages.length === 0) throw new Error('reminderMessage needs at least one page')
  if (pages.length === 1) {
    const c = pages[0].c
    return { ...programPageEmail(c, recipientFirst), ...programPageText(c), actionPath: c.ownerPath }
  }
  const role = pages[0].c.ownerRole
  const n = pages.length
  const subject = `${n} of your pages need you`
  const anyLast = pages.some((p) => p.c.extra.reminderDay === 7)
  const anyAnswering = pages.some((p) => p.c.stage === 'ANSWERING')
  const severalPrograms = new Set(pages.map((p) => p.c.programName)).size > 1
  const label = (c: NotifyContext) => (severalPrograms ? teamTag(c) : isOneGroup(c) ? c.programName : c.group)
  const items = pages.map(({ c }) => `<li style="margin:0 0 8px"><a href="${esc(appUrl(c.ownerPath))}" style="color:#0369a1;font-weight:600">${esc(YourPage(c))}</a>${severalPrograms && !isOneGroup(c) ? `<span style="color:#6b7280"> (${esc(c.programName)})</span>` : ''}<span style="color:#6b7280"> · ${esc(reminderLine(c))}</span></li>`).join('')
  const html = frame(
    hi(recipientFirst)
      + para(`${n} of your pages are waiting on you:`)
      + `<ul style="${P};padding-left:20px">${items}</ul>`
      + para(`Each one takes a few minutes.${anyAnswering ? " Everything you've typed is saved." : ''} Nothing goes live until you say so.`)
      + (anyLast ? para(LAST_REMINDER) : ''),
    { label: 'Open My programs', url: appUrl(programsHome(role)) },
    '',
    false,
  )
  const message = clip(`${pages.map(({ c }) => `${label(c)}: ${reminderLine(c)}`).join('. ')}.`, MESSAGE_MAX)
  return { subject, html, title: subject, message, actionPath: programsHome(role) }
}
