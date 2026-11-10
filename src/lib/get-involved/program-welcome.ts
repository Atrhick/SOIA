/**
 * The Get Involved welcome email when the person came in through a program page's share link
 * (or the inviter has an approved program note). Pure and client-safe: the real email
 * (emails.ts) and the preview in the program editor both build from these same parts, so the
 * preview is exactly what people receive.
 *
 * Only the program paragraph (`note`) is written per program. The rest is fixed on purpose:
 * it carries the referral line, the NowTransformed grant statement and the booking button.
 */

export const WELCOME_NOTE_MIN = 40
export const WELCOME_NOTE_MAX = 700

/** Text segments so the email can bold names without the preview needing HTML. */
export type Seg = { text: string; bold?: boolean }
export interface WelcomeParts {
  subject: string
  paragraphs: Seg[][]
  cta: string
}

export const NT_PILLARS = 'Personal Development, Professional Development, Talent Development and Community Engagement'

export function programWelcomeParts(p: { firstName: string; inviterName: string | null; programName: string; note: string }): WelcomeParts {
  const inviterFirst = (p.inviterName ?? '').trim().split(/\s+/)[0] || null
  return {
    subject: inviterFirst ? `${inviterFirst} thought you'd like ${p.programName}` : `Your next step with ${p.programName}`,
    paragraphs: [
      p.inviterName
        ? [{ text: `Hi ${p.firstName}, ` }, { text: p.inviterName, bold: true }, { text: ` shared ${p.programName} with you because they believe you'd be a great addition to our community.` }]
        : [{ text: `Hi ${p.firstName}, thanks for your interest in ${p.programName}.` }],
      [{ text: p.note.trim() }],
      [
        { text: `${p.programName} is offered through ` },
        { text: 'NowTransformed', bold: true },
        { text: `, a grant-funded youth empowerment program built on four pillars: ${NT_PILLARS}. Because of that funding, you may qualify for a sponsored place at a discount.` },
      ],
      [{ text: 'Book a free 30-minute discovery call to find out whether you qualify, or to learn more about the youth program.' }],
    ],
    cta: 'Book my discovery call',
  }
}

/** The parent's version for 17 and under: the program paragraph is added to the consent email. */
export function programParentLine(programName: string, note: string): Seg[] {
  return [{ text: `About ${programName}: `, bold: true }, { text: note.trim() }]
}

/** Clean up a note (from a person or from AI): one paragraph, no markdown, no wrapping quotes. */
export function cleanWelcomeNote(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, '')
    .replace(/[*_#`>]+/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function checkWelcomeNote(note: string): string | null {
  if (note.length < WELCOME_NOTE_MIN) return `Please write at least ${WELCOME_NOTE_MIN} characters about what people get from the program.`
  if (note.length > WELCOME_NOTE_MAX) return `Please keep it under ${WELCOME_NOTE_MAX} characters (2–3 sentences).`
  if (/https?:\/\/|www\./i.test(note)) return 'Please leave links out. The email already has the booking button.'
  return null
}
