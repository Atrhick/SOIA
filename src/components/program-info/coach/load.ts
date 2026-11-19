/**
 * Program info workflow, owner screens: the server-side gate every route uses. Server only.
 * Sign-in + role (the route's role), the Program Pages feature, and ownership (getMyPageDetail checks the
 * signed-in coach/ambassador owns the page's ROOT program; reads are allowed while impersonating, read-only).
 */
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { loginPath } from '@/lib/safe-callback'
import { prisma } from '@/lib/prisma'
import { rolesOf } from '@/lib/roles'
import { teamPagePath } from '@/lib/program-info/paths'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { getMyPageDetail, getMyProgramPages } from '@/lib/actions/program-info'
import type { OwnerRole } from '@/lib/program-info/paths'

export type Gate = { kind: 'ok'; userId: string } | { kind: 'disabled' }

/** The program id in an owner path ("/coach/programs/<id>/setup" -> "<id>"), or null. */
export function programIdOfOwnerPath(here: string): string | null {
  return /^\/(?:coach|ambassador)\/programs\/([^/?#]+)/.exec(here)?.[1] ?? null
}

/**
 * Signed in with this role, else:
 * - not signed in: the sign-in page, coming back here after;
 * - an admin whose login has no such view (e.g. a coach's page link opened from a team email): the team's
 *   page for that program, not the sign-in page (which sent them straight back here, an endless loop);
 * - anyone else signed in: the sign-in page, which sees they're signed in and offers to switch view.
 */
export async function ownerGate(role: OwnerRole, here: string): Promise<Gate> {
  const session = await auth()
  if (!session) redirect(loginPath(here))
  if (session.user.role !== role) {
    if (session.user.role === 'ADMIN' && !session.user.isImpersonating) {
      const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, extraRoles: true } })
      const id = programIdOfOwnerPath(here)
      if (!me || !rolesOf(me).includes(role)) redirect(id ? teamPagePath(id) : '/admin/program-pages')
    }
    redirect(loginPath(here))
  }
  const enabled = await isFeatureEnabled('PROGRAM_PAGES', role, session.user.id)
  if (!enabled) return { kind: 'disabled' }
  return { kind: 'ok', userId: session.user.id }
}

/** One page for its owner, or a 404 (not found / not theirs / wrong role view). */
export async function loadOwnerPage(role: OwnerRole, id: string) {
  const r = await getMyPageDetail(id)
  if (!r.ok || r.ownerRole !== role) notFound()
  return { detail: r.detail, readOnly: r.readOnly }
}

/** Every program and page the owner has (My programs, and "your other pages" lists). */
export async function loadOwnerPrograms(role: OwnerRole) {
  const r = await getMyProgramPages()
  if (!r.ok || r.ownerRole !== role) return { groups: [], readOnly: false, error: r.ok ? null : r.error }
  return { groups: r.groups, readOnly: r.readOnly, error: null as string | null }
}
