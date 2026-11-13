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

/** The company that runs the program, or null when it is blank or just repeats the program name. */
export function companyFor(programName: string, company?: string | null): string | null {
  const c = (company ?? '').trim()
  return c && c.toLowerCase() !== programName.trim().toLowerCase() ? c : null
}

export function programWelcomeParts(p: { firstName: string; inviterName: string | null; programName: string; companyName?: string | null; note: string }): WelcomeParts {
  const inviterFirst = (p.inviterName ?? '').trim().split(/\s+/)[0] || null
  const company = companyFor(p.programName, p.companyName)
  // "Health & Stress Management from USAWA", with both names in bold.
  const named: Seg[] = company ? [{ text: p.programName, bold: true }, { text: ' from ' }, { text: company, bold: true }] : [{ text: p.programName, bold: true }]
  return {
    subject: inviterFirst ? `${inviterFirst} thought you'd like ${p.programName}` : `Your next step with ${p.programName}`,
    paragraphs: [
      p.inviterName
        ? [{ text: `Hi ${p.firstName}, ` }, { text: p.inviterName, bold: true }, { text: ' shared ' }, ...named, { text: " with you because they believe you'd be a great addition to our community." }]
        : [{ text: `Hi ${p.firstName}, thanks for your interest in ` }, ...named, { text: '.' }],
      [{ text: p.note.trim() }],
      [
        { text: company ? `${company} offers ${p.programName} through ` : `${p.programName} is offered through ` },
        { text: 'NowTransformed', bold: true },
        { text: `, a grant-funded youth empowerment program built on four pillars: ${NT_PILLARS}. Because of that funding, you may qualify for a sponsored place at a discount.` },
      ],
      [{ text: 'Book a free 15-minute discovery call to find out whether you qualify, or to learn more about the youth program.' }],
    ],
    cta: 'Book my discovery call',
  }
}

/** The parent's version for 17 and under: the program paragraph is added to the consent email. */
export function programParentLine(programName: string, note: string, companyName?: string | null): Seg[] {
  const company = companyFor(programName, companyName)
  return [{ text: `About ${programName}${company ? ` from ${company}` : ''}: `, bold: true }, { text: note.trim() }]
}

/**
 * A fill-in example people can copy and change. The [brackets] are theirs to replace;
 * checkWelcomeNote refuses text that still has them, so a template is never emailed.
 */
export function exampleWelcomeNote(programName: string, companyName?: string | null): string {
  const company = companyFor(programName, companyName)
  return `${programName}${company ? ` from ${company}` : ''} helps [who it is for] [the main change they get]. Through [how it works, for example weekly coaching and interactive classes], you'll learn to [skill one], [skill two] and [skill three]. It's built for [the kind of person it suits], so you can [the result they care about most].`
}

/** A finished example, so people can see what a good paragraph reads like. */
export const SAMPLE_WELCOME_NOTE =
  "Bright Futures Mentoring helps teens aged 13 to 17 find direction and confidence. Through weekly group sessions and one-to-one check-ins, you'll set goals, practice speaking up and build habits that stick. It's built for young people who want more from school and life, so you can see real progress every month."

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
  if (/\[[^\]]*\]/.test(note)) return 'Please replace the parts in [brackets] with your own words.'
  return null
}

/**
 * Preview of the E9 welcome (emails/welcome.ts `welcomeCallEmail`), which is what is sent now
 * (by the cron, only when the person left the sign-up page without booking). Keep the two in step.
 */
export function welcomeCallParts(p: { firstName: string; inviterName: string | null; programName: string; companyName?: string | null; note: string }): WelcomeParts {
  const inviterFirst = (p.inviterName ?? '').trim().split(/\s+/)[0] || null
  const company = companyFor(p.programName, p.companyName)
  const named: Seg[] = company ? [{ text: p.programName, bold: true }, { text: ' from ' }, { text: company, bold: true }] : [{ text: p.programName, bold: true }]
  return {
    subject: `${p.firstName}, pick a time for your free call with NowTransformed`,
    paragraphs: [
      [{ text: `Hi ${p.firstName},` }],
      [{ text: 'Thanks for your interest in ' }, ...named, { text: `.${inviterFirst ? ` ${inviterFirst} shared it with you because they thought it could help.` : ''}` }],
      [{ text: p.note.trim() }],
      [{ text: 'The next step is a free 15-minute call. Times start as soon as tomorrow.' }],
    ],
    cta: 'Pick a call time',
  }
}
