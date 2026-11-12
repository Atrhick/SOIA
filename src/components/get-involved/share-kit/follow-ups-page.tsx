import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { appUrl } from '@/lib/get-involved/emails'
import { BUSINESS_TZ } from '@/lib/get-involved/core'
import { ensureInviteSlug } from '@/lib/get-involved/server'
import { invitePrograms } from '@/lib/get-involved/program-welcome-server'
import { loadFollowUps } from '@/lib/get-involved/follow-ups'
import { getOutreachTemplates } from '@/lib/get-involved/outreach-templates-server'
import { MAIN_LINK_PROGRAM, isShareChannel, renderTemplate, shareLinkFor, type ShareChannel } from '@/lib/get-involved/outreach-templates'
import { OneADayNav } from './one-a-day-nav'
import { FollowUpsClient, type FollowUpRow } from './follow-ups-client'

const SENT_VERB: Record<ShareChannel, string> = { TEXT: 'Texted', WHATSAPP: 'WhatsApp', EMAIL: 'Emailed', DM: 'DM', POST: 'Posted', PARENT: 'Texted the parent' }
const weekday = (d: Date) => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: BUSINESS_TZ }).format(d)
const short = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TZ }).format(d)

export async function FollowUpsPage({ role }: { role: 'COACH' | 'AMBASSADOR' }) {
  const session = await auth()
  if (!session || session.user.role !== role) redirect('/login')
  const userId = session.user.id
  const base = role === 'COACH' ? '/coach' : '/ambassador'
  const [items, slug, programs, templates] = await Promise.all([loadFollowUps(userId), ensureInviteSlug(userId), invitePrograms(userId), getOutreachTemplates(role)])
  const otherIds = Array.from(new Set(items.map((i) => i.programId).filter((id): id is string => !!id && !programs.some((p) => p.id === id))))
  const others = otherIds.length ? await prisma.coachProgram.findMany({ where: { id: { in: otherIds } }, select: { id: true, name: true } }) : []

  const programFor = (id: string | null) => {
    const own = programs.find((p) => p.id === id)
    if (own) return { name: own.name, url: appUrl(`/join/${slug}/${own.slug}`) }
    const other = others.find((p) => p.id === id)
    return { name: other?.name ?? MAIN_LINK_PROGRAM.program, url: appUrl(`/join/${slug}`) }
  }

  const rows: FollowUpRow[] = items.map((i) => {
    const channel: ShareChannel = isShareChannel(i.channel) ? i.channel : 'TEXT'
    const p = programFor(i.programId)
    const values = { firstName: i.name, personalLine: '', program: p.name, description: '', link: shareLinkFor(p.url, channel), seatsLeft: null }
    if (i.type === 'FORM') {
      return {
        id: i.prospectId, type: 'FORM', name: i.name, channel, day: i.day,
        detail: `${i.parent ? 'Parent · ' : ''}Form on ${weekday(i.createdAt)} · our emails sent too`,
        message: renderTemplate(templates.FORM_NO_CALL.body, 'FORM_NO_CALL', values),
        afterYes: null, programId: i.programId,
      }
    }
    return {
      id: i.shareId, type: i.type, name: i.name, channel, day: i.day,
      detail: i.type === 'NUDGE'
        ? `${SENT_VERB[channel]} ${weekday(i.sentAt)} · no reply yet`
        : `${SENT_VERB[channel]} on ${short(i.sentAt)}${i.nudgedAt ? ` · nudged ${short(i.nudgedAt)}` : ''} · no reply`,
      message: renderTemplate(i.type === 'NUDGE' ? templates.NUDGE.body : templates.CLOSE.body, i.type, values),
      afterYes: renderTemplate(templates.AFTER_YES.body, 'AFTER_YES', values),
      programId: i.programId,
    }
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <OneADayNav role={role} current="follow-ups" followUpsDue={rows.length} />
      <div>
        <p className="text-sm text-gray-600"><Link href={`${base}/one-a-day`} className="text-primary-700 underline">One-A-Day</Link> / Follow-ups due</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Follow-ups due today ({rows.length})</h1>
        <p className="text-gray-600 mt-1">One short nudge after 3–4 days, one friendly close after 10–14 days, then stop. Most extra replies come from the first nudge.</p>
      </div>
      <FollowUpsClient rows={rows} />
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-gray-700 leading-relaxed">
        <strong>Rules built in:</strong> &quot;Replied yes&quot; opens the &quot;After a yes&quot; message with the link. &quot;Said no&quot;, or a request to stop, removes the person for good.
        Send texts between 8 AM and 8 PM in their time zone. Under 18: only the parent is listed.
      </div>
    </div>
  )
}
