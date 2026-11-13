import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { appUrl } from '@/lib/get-involved/emails'
import { ensureInviteSlug, userDisplayName } from '@/lib/get-involved/server'
import { getOutreachSettings, getSignupOffer } from '@/lib/get-involved/offer'
import { invitePrograms } from '@/lib/get-involved/program-welcome-server'
import { followUpsDueCount } from '@/lib/get-involved/follow-ups'
import { getGeneralScripts, loadProgramPitches } from '@/lib/get-involved/scripts-server'
import { GENERAL_TIPS } from '@/lib/get-involved/scripts-defaults'
import { MAIN_LINK_PROGRAM } from '@/lib/get-involved/outreach-templates'
import { defaultFor, resolveScript, visibleScenarios, type ScenarioKey, type ScriptVariant } from '@/lib/get-involved/scripts'
import { OneADayNav } from '@/components/get-involved/share-kit/one-a-day-nav'
import { TaskHeader } from '@/components/ui/kit/task-header'
import { isMinorOn } from './helpers'
import { PlaybookClient, type PlaybookData, type PlaybookMessage } from './playbook-client'

/** "general" in the URL = the main link (any program). */
export const GENERAL = 'general'

export async function PlaybookPage({ role, programParam }: { role: 'COACH' | 'AMBASSADOR'; programParam?: string }) {
  const session = await auth()
  if (!session || session.user.role !== role) redirect('/login')
  const userId = session.user.id
  const now = new Date()

  const [programs, slug, name, me, due, general, settings, amb] = await Promise.all([
    invitePrograms(userId),
    ensureInviteSlug(userId),
    userDisplayName(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { inviteProgramId: true } }),
    followUpsDueCount(userId, now),
    getGeneralScripts(),
    getOutreachSettings(),
    role === 'AMBASSADOR' ? prisma.ambassador.findUnique({ where: { userId }, select: { dateOfBirth: true } }) : null,
  ])
  const minor = isMinorOn(amb?.dateOfBirth ?? null, now)

  // Which program to show: ?program=, else the main link's program, else the first one, else the general case.
  const chosen =
    programParam === GENERAL ? null
      : programs.find((p) => p.id === programParam) ?? programs.find((p) => p.id === me?.inviteProgramId) ?? programs[0] ?? null

  const pitch = chosen ? (await loadProgramPitches([chosen.id])).get(chosen.id) ?? null : null
  const offer = chosen ? await getSignupOffer(chosen.id, now) : null
  // invitePrograms() only returns the member's own live programs, so a chosen program is always theirs.
  const owns = !!chosen

  const rows = pitch?.rows ?? []
  const messages: PlaybookMessage[] = visibleScenarios({ owns, minor }).map((s) => ({
    key: s.key as ScenarioKey,
    group: s.group,
    label: s.label,
    hint: s.hint,
    variants: s.variants.flatMap((v) => {
      const r = resolveScript(rows, general, s.key as ScenarioKey, v as ScriptVariant)
      if (!r) return []
      const d = defaultFor(rows, general, s.key as ScenarioKey, v as ScriptVariant)
      return [{ variant: r.variant, subject: r.subject, body: r.body, source: r.source, defaultText: d }]
    }),
  })).filter((m) => m.variants.length > 0)

  const data: PlaybookData = {
    role,
    programs: [
      ...programs.map((p) => ({ id: p.id, name: p.name })),
      ...(programs.length ? [{ id: GENERAL, name: 'Any program (main link)' }] : []),
    ],
    current: chosen?.id ?? GENERAL,
    owns,
    program: chosen
      ? {
        id: chosen.id,
        name: pitch?.program ?? chosen.name,
        guide: pitch?.guide ?? null,
        guideSource: pitch?.guideSource ?? null,
        hasDefaultGuide: !!pitch?.defaultGuide,
        lineIdeas: pitch?.lineIdeas ?? null,
      }
      : null,
    tips: GENERAL_TIPS,
    values: {
      myName: name?.first ?? '',
      business: pitch?.business ?? MAIN_LINK_PROGRAM.program,
      program: pitch?.program ?? MAIN_LINK_PROGRAM.program,
      programLine: pitch?.programLine ?? MAIN_LINK_PROGRAM.description,
      sponsorship: !!offer && offer.seatsLeft > 0,
    },
    link: appUrl(chosen ? `/join/${slug}/${chosen.slug}` : `/join/${slug}`),
    mailingAddress: settings.mailingAddress || null,
    messages,
  }

  return (
    <div className="max-w-4xl space-y-6">
      <OneADayNav role={role} current="playbook" followUpsDue={due} />
      <TaskHeader title="Playbook" doThis="How to pitch your program, and a message for every situation." />
      <PlaybookClient data={data} />
    </div>
  )
}
