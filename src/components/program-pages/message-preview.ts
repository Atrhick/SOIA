/**
 * "How your program appears in messages": limits and the preview sentence. Pure, shared by the editor
 * panel and its server action (program-message-info.ts). Mirrors the {business} / {program} /
 * {program line} fill-ins in scripts.ts: no business name = the program name.
 */
export const BUSINESS_NAME_MAX = 80
export const MESSAGE_LINE_MAX = 160
export const MESSAGE_LINE_EXAMPLE = "a 4-week online program that helps teens in foster care figure out who they are and what's next"

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()

/** "I run DreamIt LiveIt, and one of our programs is Vision Development: a 4-week online program ..." */
export function messagePreview(p: { businessName: string; programName: string; messageLine: string }): string {
  const program = tidy(p.programName) || 'your program'
  const business = tidy(p.businessName) || program
  const line = tidy(p.messageLine).replace(/[.\s]+$/, '')
  return `I run ${business}, and one of our programs is ${program}${line ? `: ${line}` : ''}.`
}
