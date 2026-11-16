/**
 * Admin notifications to the team (Admin > Send a notification): the pure rules.
 * No database here, so everything is unit-tested in core.test.ts.
 */
import { esc, P, SMALL, appUrl, layout } from '@/lib/get-involved/emails'
import { inviterRoleOf } from '@/lib/get-involved/core'

export const TITLE_MAX = 80
export const BODY_MAX = 500
/** Push text is cut here (lock screens show about this much); the email carries the full message. */
export const PUSH_BODY_MAX = 180
/** Deliveries handled per "continue" call; the browser calls again until none are left. */
export const BATCH_SIZE = 40
/** The most people one message can go to (the whole team today is far below this). */
export const MAX_RECIPIENTS = 2000

export const AUDIENCE_GROUPS = [
  { key: 'COACH', label: 'Coaches', roles: ['COACH'] },
  { key: 'AMBASSADOR', label: 'Ambassadors', roles: ['AMBASSADOR'] },
  { key: 'ADMIN', label: 'Admins', roles: ['ADMIN', 'SUB_ADMIN'] },
  { key: 'ASSOCIATE', label: 'Associates (service providers, business affiliates, volunteers)', roles: ['SERVICE_PROVIDER', 'BUSINESS_AFFILIATE', 'VOLUNTEER'] },
] as const
export type AudienceGroup = (typeof AUDIENCE_GROUPS)[number]['key']
export const isAudienceGroup = (g: string): g is AudienceGroup => AUDIENCE_GROUPS.some((x) => x.key === g)

export type Audience = { groups: AudienceGroup[] } | { userIds: string[] }

/** The roles a set of groups covers. A person matches if their main role OR an extra role is one of these. */
export function rolesForGroups(groups: readonly string[]): string[] {
  return AUDIENCE_GROUPS.filter((g) => groups.includes(g.key)).flatMap((g) => [...g.roles])
}

export const LINK_CHOICES = [
  { key: 'home', label: 'Their home page' },
  { key: 'one-a-day', label: 'One-A-Day (coaches and ambassadors; everyone else gets their home page)' },
  { key: 'custom', label: 'A page I choose' },
] as const

/** A page inside this app: starts with one "/", no "//", no spaces or quotes. */
export function isAppPath(p: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/.test(p) && p.length <= 200
}

/** Accepts "/coach/learning" or a full link to this site, and returns the path; null if it isn't a page here. */
export function normalizeCustomLink(input: string, siteUrl = appUrl()): string | null {
  const t = input.trim()
  if (!t) return null
  if (t.startsWith('/')) return isAppPath(t) ? t : null
  try {
    const u = new URL(t)
    const site = new URL(siteUrl)
    const host = (h: string) => h.replace(/^www\./, '')
    if (host(u.host) !== host(site.host)) return null
    const path = `${u.pathname}${u.search}${u.hash}`
    return isAppPath(path) ? path : null
  } catch {
    return null
  }
}

/** Where tapping the notification (or the email button) takes this person. */
export function linkFor(link: string, user: { role: string; extraRoles?: readonly string[] | null }): string {
  if (link === 'home') return '/'
  if (link === 'one-a-day') {
    const r = inviterRoleOf(user)
    return r === 'COACH' ? '/coach/one-a-day' : r === 'AMBASSADOR' ? '/ambassador/one-a-day' : '/'
  }
  return isAppPath(link) ? link : '/'
}

export function buttonLabel(link: string): string {
  if (link === 'one-a-day') return 'Open One-A-Day'
  return 'Open NowTransformed'
}

/** One line for the lock screen: whitespace squeezed, cut at a word with "…". */
export function pushBody(body: string, max = PUSH_BODY_MAX): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  const at = cut.lastIndexOf(' ')
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:!?-]+$/, '')}…`
}

/** The fallback email: greeting, the message as written (paragraphs kept), one button. */
export function broadcastEmail(m: { title: string; body: string; link: string }, first: string, url: string): { subject: string; html: string } {
  const paras = m.body.trim().split(/\n\s*\n/).map((p) => `<p style="${P}">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('')
  const html = layout(
    `<p style="${P}">Hi ${esc(first)},</p>${paras}`,
    { label: buttonLabel(m.link), url: appUrl(url) },
    `<p style="${SMALL}">Tip: turn on notifications in the app (the menu under your name) to get messages like this on your phone.</p>`,
    { audience: 'team' },
  )
  return { subject: m.title.trim(), html }
}

export type DeliveryStatus = 'PENDING' | 'SENDING' | 'PUSH' | 'EMAIL' | 'NO_DEVICE' | 'FAILED'

/** What happens to one person: push if any device took it; otherwise email if allowed. */
export function deliveryPlan(devices: number, emailFallback: boolean): 'push' | 'email' | 'none' {
  if (devices > 0) return 'push'
  return emailFallback ? 'email' : 'none'
}

export interface BroadcastCounts { total: number; pending: number; push: number; email: number; noDevice: number; failed: number }

export function countsFrom(rows: { status: string; _count: number }[]): BroadcastCounts {
  const c: BroadcastCounts = { total: 0, pending: 0, push: 0, email: 0, noDevice: 0, failed: 0 }
  for (const r of rows) {
    c.total += r._count
    if (r.status === 'PENDING' || r.status === 'SENDING') c.pending += r._count
    else if (r.status === 'PUSH') c.push += r._count
    else if (r.status === 'EMAIL') c.email += r._count
    else if (r.status === 'NO_DEVICE') c.noDevice += r._count
    else if (r.status === 'FAILED') c.failed += r._count
  }
  return c
}
