/**
 * Helpers shared by the program page actions (src/lib/actions/program-pages.ts) and the program info
 * workflow (src/lib/actions/program-info.ts). Server only. NOT 'use server': nothing here is an endpoint,
 * and a 'use server' file may only export async actions, which is why these live here.
 * Moved out of program-pages.ts unchanged.
 */
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { programsBasePath, type ProgramOwnerIdentity } from '@/lib/program-owner'

// Fields copied into publishedSnapshot on approval. The public page reads
// only this snapshot, never the live columns.
export const SNAPSHOT_FIELDS = [
  'name',
  'organization',
  'targetMarket',
  'internshipOffering',
  'servicesDescription',
  'weeklyEngagement1',
  'weeklyEngagement2',
  'monthlyGrowthGoal',
  'monthlyImpactGoal',
  'pageTitle',
  'headline',
  'coachBio',
  'showCoachBio',
  'programDescription',
  'eventDatesText',
  'zoomUrl',
  'zoomLabel',
  'secondMeetingUrl',
  'secondMeetingLabel',
  'zoomInstructions',
  'qualificationIntro',
  'extraQuestions',
  'showMeetingDetails',
  'coachVideoUrl',
  'ntVideoUrl',
  'ntVideoIntro',
] as const

export type ProgramRecord = Record<string, unknown>

export function buildSnapshot(program: ProgramRecord) {
  const snapshot: ProgramRecord = {}
  for (const field of SNAPSHOT_FIELDS) snapshot[field] = program[field] ?? null
  snapshot.snapshotAt = new Date().toISOString()
  return snapshot
}

// Guards return an `ok` discriminant rather than relying on `'error' in x`
// narrowing - a union whose members differ only by an optional property does
// not narrow reliably and leaks into every caller's return type.

/**
 * An impersonating admin may look but not touch: they can read a coach's pages
 * to see exactly what the coach sees, but must not author or publish content in
 * the coach's name, because coach-side actions write no audit trail.
 *
 * Reads pass `allowImpersonation: true`; every write leaves it off.
 *
 * Exception, the program info workflow (`allowSupport: true`): an admin viewing as the owner can help them
 * fill in and send their answers. Those writes are recorded under the ADMIN's id (`actorId`), never the
 * owner's. Approving a page and taking it offline stay the owner's own actions.
 *
 * A program owner is a COACH (matched on their CoachProfile id) or an
 * AMBASSADOR (matched on their Ambassador id), with Program Pages enabled for
 * them by role default or a per-user grant from /admin/users.
 */
export async function requireProgramUser({ allowImpersonation = false, allowSupport = false } = {}) {
  const session = await auth()
  const role = session?.user.role
  if (!session || (role !== 'COACH' && role !== 'AMBASSADOR')) {
    return { ok: false as const, error: 'Unauthorized' }
  }
  if (session.user.isImpersonating && !allowImpersonation && !allowSupport) {
    return { ok: false as const, error: 'Not available while impersonating another user' }
  }
  const enabled = await isFeatureEnabled('PROGRAM_PAGES', role, session.user.id)
  if (!enabled) {
    return { ok: false as const, error: 'This feature is not enabled for your account' }
  }

  let owner: ProgramOwnerIdentity
  if (role === 'COACH') {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!coachProfile) return { ok: false as const, error: 'Coach profile not found' }
    owner = { role: 'COACH', coachId: coachProfile.id }
  } else {
    const ambassador = await prisma.ambassador.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!ambassador) return { ok: false as const, error: 'Ambassador profile not found' }
    owner = { role: 'AMBASSADOR', ambassadorId: ambassador.id }
  }

  return {
    ok: true as const,
    session,
    owner,
    readOnly: Boolean(session.user.isImpersonating),
    /** Who did it: the admin when viewing as the owner, else the owner. */
    actorId: (session.user.isImpersonating && session.user.originalAdminId) || session.user.id,
  }
}

/** Refresh the owner's list and editor after a change to one program. */
export function revalidateOwnerPages(programId: string) {
  for (const base of [programsBasePath('COACH'), programsBasePath('AMBASSADOR')]) {
    revalidatePath(base)
    revalidatePath(`${base}/${programId}`)
  }
}

export async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { ok: false as const, error: 'Unauthorized' }
  }
  if (session.user.isImpersonating) {
    return { ok: false as const, error: 'Not available while impersonating another user' }
  }
  return { ok: true as const, session }
}

export async function audit(userId: string, action: string, entityId: string, details: unknown) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType: 'CoachProgram',
        entityId,
        details: JSON.stringify(details),
      },
    })
  } catch (error) {
    console.error('Audit log failed:', error)
  }
}

/**
 * A13: a program in the program info workflow goes live only through "Looks good" (or the team's publish
 * on behalf). In the workflow = a group page, a program whose root saved Names and groups, or a program
 * with any written version.
 */
export async function isInProgramInfoFlow(programId: string): Promise<boolean> {
  const p = await prisma.coachProgram.findUnique({
    where: { id: programId },
    select: { parentProgramId: true, groupsConfirmedAt: true, _count: { select: { pageVersions: true } } },
  })
  return Boolean(p && (p.parentProgramId || p.groupsConfirmedAt || p._count.pageVersions > 0))
}

export const IN_FLOW_MESSAGE = 'This page now goes live from Program pages, after the owner checks it.'

/** Owners: offline/online for a page in the workflow is on the page's Live screen. */
export const IN_FLOW_OFFLINE_MESSAGE = 'This page is now taken offline from its Live screen: open the page from Program pages and choose "Take it offline".'

/** Owners: the welcome email and message line of a page in the workflow change only through the page's answers. */
export const IN_FLOW_TEXT_MESSAGE = 'This now changes with your page: open it from Program pages and ask for a change there.'

/** Admins: the same text goes through the page's draft in Admin > Program pages. */
export const IN_FLOW_TEXT_ADMIN_MESSAGE = 'Edit it in the page queue draft.'

/** Admins: offline/online and changes for a page in the workflow go through Admin > Program pages. */
export const IN_FLOW_ADMIN_MESSAGE = 'This page is handled in Admin > Program pages now: take it offline or ask for changes from there.'
