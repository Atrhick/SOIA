/**
 * Get Involved phase 2/3 email templates.
 *
 * Convention (so builders working in parallel never edit the same file):
 * - One NEW file per feature in this folder, e.g. `assessment.ts`, `orientation.ts`, `payment.ts`.
 *   Do not edit ../emails.ts (phase 1 + shared frame) or another feature's file.
 * - Each template is a pure function returning `Mail` ({ subject, html }); the caller sends it with
 *   sendEmail() from '@/lib/email', after the database write, never inside a transaction.
 * - Build the HTML with the shared pieces from '../emails': layout(), esc(), P, SMALL, parentNote(),
 *   callBox(), appUrl(). EVERY value that came from a person (names, notes, answers, role labels an
 *   admin typed, URLs) goes through esc(). layout() escapes the button label and URL itself.
 * - For 17 and under, send the same mail to Prospect.parentEmail as well (the mockups say "cc parent").
 * - Import templates from their own file (e.g. '@/lib/get-involved/emails/joined'); this index
 *   re-exports nothing so files never collide.
 */
export {}
