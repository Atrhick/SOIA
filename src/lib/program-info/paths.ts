/**
 * Program info workflow: every link. PURE and client-safe.
 * Page routes take the PAGE id (one CoachProgram row); "Names and groups" (setup) takes the ROOT id.
 */
export type OwnerRole = 'COACH' | 'AMBASSADOR'

export const programsHome = (role: OwnerRole) => (role === 'AMBASSADOR' ? '/ambassador/programs' : '/coach/programs')

/** `/coach/programs/<pageId><suffix>`; suffix '' = page hub, '/check', '/live', '/update', '/sent', '/question/<qid>', '/section/<id>', '/details'. */
export const coachPagePath = (role: OwnerRole, pageId: string, suffix = '') => `${programsHome(role)}/${encodeURIComponent(pageId)}${suffix}`

export const coachSetupPath = (role: OwnerRole, rootId: string) => coachPagePath(role, rootId, '/setup')
export const coachSectionPath = (role: OwnerRole, pageId: string, sectionId: string) => coachPagePath(role, pageId, `/section/${encodeURIComponent(sectionId)}`)
export const coachQuestionPath = (role: OwnerRole, pageId: string, questionId: string) => coachPagePath(role, pageId, `/question/${encodeURIComponent(questionId)}`)

export const TEAM_QUEUE_PATH = '/admin/program-pages'
export const teamPagePath = (pageId: string) => `${TEAM_QUEUE_PATH}/${encodeURIComponent(pageId)}`

/** The page alone, full width, no dashboard frame: what the scaled computer-width previews load in an iframe.
 *  No version = the live page. Owners and the team can open it. */
export const pageFramePath = (pageId: string, versionNumber?: number | null) =>
  `/page-preview/${encodeURIComponent(pageId)}${versionNumber ? `?version=${versionNumber}` : ''}`

/** The public link people share: /join/<owner invite slug>/<program slug>, else the old /p/<slug>. */
export function publicPagePath(programSlug: string, ownerInviteSlug: string | null | undefined): string {
  return ownerInviteSlug ? `/join/${encodeURIComponent(ownerInviteSlug)}/${encodeURIComponent(programSlug)}` : `/p/${encodeURIComponent(programSlug)}`
}

/** "Families page" / "Financial Empowerment page" when the program has one group. */
export function pageName(audienceLabel: string | null | undefined, programName: string): string {
  return `${(audienceLabel ?? '').trim() || programName} page`
}

/** "Families" or the program name: the <Group> in notification copy. */
export function groupName(audienceLabel: string | null | undefined, programName: string): string {
  return (audienceLabel ?? '').trim() || programName
}

/**
 * A2: the one helper for "your ... page" wording in screens and emails. Never "your null page":
 * a one-group program (audienceLabel null) reads "your <Program name> page".
 */
export function yourPageName(p: { audienceLabel: string | null | undefined; programName: string }): string {
  return `your ${pageName(p.audienceLabel, p.programName)}`
}
