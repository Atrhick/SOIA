/**
 * Daily summary email to every active admin: who signed up in the last 24 hours, who has been waiting
 * 2+ days without booking a call, and who asked us to reach out. Sent once per Central-time day, from
 * 8 AM, by the 15-minute reminders cron. Nothing to report = no email.
 * Also a "Program pages" block (the program info workflow): pages waiting on us, stalled pages and the
 * oldest wait, with a link to the team queue; left out when all are zero.
 * Server only (not 'use server'). The email builder is pure and tested in admin-digest.test.ts.
 */
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { BUSINESS_TZ, ageRangeLabel } from './core'
import { P, SMALL, appUrl, esc, layout } from './emails'
import { userDisplayName } from './server'
import { teamQueue } from '@/lib/program-info/server'
import { TEAM_QUEUE_PATH } from '@/lib/program-info/paths'

export const DIGEST_HOUR = 8
const WAITING_AFTER_DAYS = 2
const WAITING_UP_TO_DAYS = 30
const SHOW = 10
const DIGEST_ACTION = 'ADMIN_DAILY_DIGEST'

export interface DigestPerson { id: string; name: string; age: string; inviter: string | null }
export interface DigestData {
  newSignups: (DigestPerson & { booked: boolean })[]
  waiting: (DigestPerson & { days: number })[]
  waitingTotal: number
  reachOut: number
  callsNext24h: number
  /** Program info workflow. Optional so older callers and tests keep working. */
  programPages?: ProgramPagesDigest
}

export interface ProgramPagesDigest {
  /** Pages where the team acts next ("Our move"). */
  ourMove: number
  /** Pages stalled on the owner (day 10). */
  stalled: number
  /** Days the longest-waiting "Our move" page has waited (0 when none). */
  oldestWaitingDays: number
}

const hasProgramPages = (pp?: ProgramPagesDigest) => !!pp && (pp.ourMove > 0 || pp.stalled > 0)

/** The "Program pages" block, or '' when there is nothing to report. */
export function programPagesBlock(pp: ProgramPagesDigest | undefined): string {
  if (!pp || !hasProgramPages(pp)) return ''
  const row = (label: string, value: string) => `<li style="margin:0 0 6px">${esc(label)}: <strong>${esc(value)}</strong></li>`
  const items = [
    row('Our move (pages to write, fix or send)', String(pp.ourMove)),
    row('Stalled (10+ days waiting on the owner)', String(pp.stalled)),
    pp.ourMove > 0 ? row('Oldest one waiting on us', plural(pp.oldestWaitingDays, 'day', 'days')) : '',
  ].join('')
  return `<p style="color:#111827;font-size:16px;font-weight:700;margin:18px 0 8px">Program pages</p>
    <ul style="${P};padding-left:20px">${items}</ul>
    <p style="${P}"><a href="${esc(appUrl(TEAM_QUEUE_PATH))}" style="color:#0369a1;font-weight:600">Open program pages</a></p>`
}

/** Central-time calendar day key and hour. */
export function centralDayAndHour(now: Date): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The email, or null when there is nothing to act on. */
export function adminDigestEmail(d: DigestData, adminFirst: string): { subject: string; html: string } | null {
  if (d.newSignups.length === 0 && d.waitingTotal === 0 && d.reachOut === 0 && !hasProgramPages(d.programPages)) return null
  const link = (id: string, name: string) => `<a href="${esc(appUrl(`/admin/prospects/${id}`))}" style="color:#0369a1;font-weight:600">${esc(name)}</a>`
  const who = (p: DigestPerson) => `${link(p.id, p.name)} <span style="color:#6b7280">· ${esc(p.age)}${p.inviter ? ` · invited by ${esc(p.inviter)}` : ''}</span>`
  const list = (items: string[]) => `<ul style="${P};padding-left:20px">${items.map((i) => `<li style="margin:0 0 6px">${i}</li>`).join('')}</ul>`
  const h = (t: string) => `<p style="color:#111827;font-size:16px;font-weight:700;margin:18px 0 8px">${esc(t)}</p>`

  let body = `<p style="${P}">Hi ${esc(adminFirst)}, here's what needs a look today.</p>`
  if (d.newSignups.length) {
    body += h(`New sign-ups (last 24 hours): ${d.newSignups.length}`)
    body += list(d.newSignups.slice(0, SHOW).map((p) => `${who(p)}<br><span style="color:#6b7280;font-size:13px">${p.booked ? 'Call booked' : 'No call booked yet'}</span>`))
    if (d.newSignups.length > SHOW) body += `<p style="${SMALL}">And ${d.newSignups.length - SHOW} more.</p>`
  }
  if (d.waitingTotal) {
    body += h(`Waiting ${WAITING_AFTER_DAYS}+ days with no call booked: ${d.waitingTotal}`)
    body += `<p style="${P}">They filled in the form but haven't picked a time. A short message or call from you or their inviter often gets them booked.</p>`
    const shown = d.waiting.slice(0, SHOW)
    body += list(shown.map((p) => `${who(p)}<br><span style="color:#6b7280;font-size:13px">Signed up ${plural(p.days, 'day', 'days')} ago</span>`))
    if (d.waitingTotal > shown.length) body += `<p style="${SMALL}">And ${d.waitingTotal - shown.length} more on the Prospects page.</p>`
  }
  if (d.reachOut) {
    body += h(`Asked us to reach out: ${d.reachOut}`)
    body += `<p style="${P}">${plural(d.reachOut, 'person', 'people')} couldn't find a call time that works and asked for someone to contact them. Their details are in your notifications (the bell at the top of the back office).</p>`
  }
  body += programPagesBlock(d.programPages)
  if (d.callsNext24h) body += `<p style="${SMALL}">${plural(d.callsNext24h, 'discovery call is', 'discovery calls are')} booked in the next 24 hours.</p>`
  const prospects = d.newSignups.length > 0 || d.waitingTotal > 0 || d.reachOut > 0
  const pagesPart = d.programPages && d.programPages.ourMove > 0 ? plural(d.programPages.ourMove, 'program page needs us', 'program pages need us') : ''
  const subject = prospects
    ? `NowTransformed daily summary: ${d.newSignups.length} new, ${d.waitingTotal} waiting for a call${pagesPart ? `, ${pagesPart}` : ''}`
    : `NowTransformed daily summary: ${pagesPart || plural(d.programPages?.stalled ?? 0, 'program page stalled', 'program pages stalled')}`
  return {
    subject,
    html: layout(body, { label: 'Open Prospects', url: appUrl('/admin/prospects') }, `<p style="${SMALL}">You get this because you're an admin. It's sent once a day, only when there is something to look at.</p>`, { audience: 'team', signOff: 'Thanks,' }),
  }
}

async function inviterNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)))
  const names = await Promise.all(unique.map(async (id) => [id, (await userDisplayName(id))?.full ?? null] as const))
  return new Map(names.filter((n): n is readonly [string, string] => !!n[1]))
}

export async function loadDigestData(now: Date): Promise<DigestData> {
  const day = 86400_000
  const sel = { id: true, firstName: true, lastName: true, ageRange: true, invitedById: true, createdAt: true, status: true } as const
  const [fresh, waitingRows, waitingTotal, reachOut, callsNext24h] = await Promise.all([
    prisma.prospect.findMany({ where: { journeyToken: { not: null }, createdAt: { gte: new Date(now.getTime() - day) } }, orderBy: { createdAt: 'desc' }, take: 50, select: sel }),
    prisma.prospect.findMany({
      where: { journeyToken: { not: null }, status: 'FORM_SUBMITTED', createdAt: { lt: new Date(now.getTime() - WAITING_AFTER_DAYS * day), gte: new Date(now.getTime() - WAITING_UP_TO_DAYS * day) } },
      orderBy: { createdAt: 'asc' }, take: SHOW, select: sel,
    }),
    prisma.prospect.count({ where: { journeyToken: { not: null }, status: 'FORM_SUBMITTED', createdAt: { lt: new Date(now.getTime() - WAITING_AFTER_DAYS * day), gte: new Date(now.getTime() - WAITING_UP_TO_DAYS * day) } } }),
    prisma.discoverySlotRequest.count({ where: { kind: 'REACH_OUT', handledAt: null } }),
    prisma.discoveryCall.count({ where: { status: 'BOOKED', startsAt: { gt: now, lte: new Date(now.getTime() + day) } } }),
  ])
  const names = await inviterNames([...fresh, ...waitingRows].map((p) => p.invitedById))
  const person = (p: (typeof fresh)[number]): DigestPerson => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim(), age: ageRangeLabel(p.ageRange), inviter: p.invitedById ? names.get(p.invitedById) ?? null : null })
  return {
    newSignups: fresh.map((p) => ({ ...person(p), booked: p.status !== 'FORM_SUBMITTED' && p.status !== 'AWAITING_PARENT_CONSENT' })),
    waiting: waitingRows.map((p) => ({ ...person(p), days: Math.floor((now.getTime() - p.createdAt.getTime()) / day) })),
    waitingTotal,
    reachOut,
    callsNext24h,
    programPages: await loadProgramPagesDigest(now),
  }
}

/** Counts for the "Program pages" block. Never fails the digest. */
export async function loadProgramPagesDigest(now: Date): Promise<ProgramPagesDigest | undefined> {
  try {
    const q = await teamQueue(now)
    const ours = q.items.filter((i) => i.bucket === 'OUR_MOVE')
    return { ourMove: q.counts.OUR_MOVE, stalled: q.counts.STALLED, oldestWaitingDays: ours.reduce((m, i) => Math.max(m, i.waitingDays), 0) }
  } catch (e) {
    console.error('[CRON] program pages digest failed', e)
    return undefined
  }
}

/**
 * Once per Central day from DIGEST_HOUR. The day is claimed under an advisory lock (audit log row), so two
 * cron runs at once can't both send. Returns how many admins were emailed.
 */
export async function runAdminDigest(now = new Date()): Promise<number> {
  const { day, hour } = centralDayAndHour(now)
  if (hour < DIGEST_HOUR) return 0
  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4210977)`
    const done = await tx.auditLog.findFirst({ where: { action: DIGEST_ACTION, entityId: day }, select: { id: true } })
    if (done) return false
    await tx.auditLog.create({ data: { action: DIGEST_ACTION, entityType: 'System', entityId: day } })
    return true
  })
  if (!claimed) return 0
  const data = await loadDigestData(now)
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true, email: true } })
  let sent = 0
  for (const a of admins) {
    const first = (await userDisplayName(a.id))?.first ?? 'there'
    const m = adminDigestEmail(data, first)
    if (!m) break
    const r = await sendEmail({ to: a.email, ...m }).catch(() => ({ sent: false }))
    if (r.sent) sent++
    await new Promise((ok) => setTimeout(ok, 300))
  }
  return sent
}
