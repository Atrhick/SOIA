'use server'

/**
 * One-A-Day v2 "Email them for me": a coach or ambassador enters people they know and we email each one
 * an invitation from them. Rules in src/lib/get-involved/outreach-invites.ts (20 people a day, one
 * invitation per address per 30 days whoever sends it, Stop/opt-out and existing people skipped
 * silently). Every SENT invitation is also logged as an OutreachShare (EMAIL, FIRST) so it counts for
 * the day and shows up in Follow-ups.
 */
import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { appUrl } from '@/lib/get-involved/emails'
import { primeEmailFooter } from '@/lib/get-involved/emails/footer-settings'
import { inviteEmail } from '@/lib/get-involved/emails/invite'
import { getInviteProfile, getRegularPrices, getSignupOffer } from '@/lib/get-involved/offer'
import { invitePrograms } from '@/lib/get-involved/program-welcome-server'
import { ensureInviteSlug, rateLimited, userDisplayName } from '@/lib/get-involved/server'
import { getGeneralScripts, loadProgramPitches } from '@/lib/get-involved/scripts-server'
import { hasBlank, resolveScript } from '@/lib/get-involved/scripts'
import { disclosureLine, MAIN_LINK_PROGRAM } from '@/lib/get-involved/outreach-templates'
import {
  INVITE_REPEAT_DAYS, INVITES_PER_DAY, MAX_PER_SEND, buildInviteText, decideInvites, decisionText, normaliseEmail, pickInviteScript, summaryText,
  type InviteDecision,
} from '@/lib/get-involved/outreach-invites'
import { invitesUsedToday } from '@/components/get-involved/share-kit/data'

export interface InviteResult {
  email: string
  firstName: string
  ok: boolean
  text: string
  /** For a mistyped address: the corrected one, so the page can offer "Use it". */
  suggestion?: string
}

type Response = { ok: true; results: InviteResult[]; summary: { ok: boolean; text: string }; usedToday: number } | { ok: false; error: string }

const schema = z.object({
  programId: z.string().trim().min(1).max(40).nullable(),
  people: z.array(z.object({
    firstName: z.string().max(60),
    email: z.string().max(254),
    parent: z.boolean().optional(),
  })).min(1, 'Add at least one person.').max(MAX_PER_SEND, `You can send to up to ${MAX_PER_SEND} people at a time.`),
  personalLine: z.string().trim().max(300).optional().default('').refine((s) => !hasBlank(s), 'Change the part in [brackets] to your own words.'),
  iKnowThem: z.literal(true, { message: 'Tick the box to confirm these are people you know.' }),
})

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function sendInvites(input: unknown): Promise<Response> {
  const session = await auth()
  if (!session || (session.user.role !== 'COACH' && session.user.role !== 'AMBASSADOR')) return { ok: false, error: 'Unauthorized' }
  if (session.user.isImpersonating) return { ok: false, error: 'Switch back to your own account to send invitations.' }
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  const userId = session.user.id
  const role = session.user.role
  // Burst guard on top of the daily limit (double taps, scripts).
  if (rateLimited(`gi-invite:${userId}`, 10, 10 * 60_000)) return { ok: false, error: 'Too many sends in a few minutes. Please wait a little and try again.' }

  const { programId, personalLine } = parsed.data
  const now = new Date()

  try {
    const [programs, slug, me, profile] = await Promise.all([invitePrograms(userId), ensureInviteSlug(userId), userDisplayName(userId), getInviteProfile(userId)])
    const program = programId ? programs.find((p) => p.id === programId) : null
    if (programId && !program) return { ok: false, error: 'That program is not one you can share.' }
    const pitch = program ? (await loadProgramPitches([program.id])).get(program.id) : undefined
    const offer = program ? await getSignupOffer(program.id, now).catch(() => null) : null
    const rows = pitch?.rows ?? []
    const general = await getGeneralScripts()
    const scriptFor = (parent: boolean) => pickInviteScript((k) => {
      const [scenario, variant] = k.split(':') as ['KNOW' | 'PARENT', 'EMAIL' | 'SHORT']
      return resolveScript(rows, general, scenario, variant)
    }, parent)
    const baseValues = {
      personalLine,
      myName: me?.first ?? '',
      business: pitch?.business ?? (program ? program.company || program.name : 'NowTransformed'),
      program: pitch?.program ?? program?.name ?? MAIN_LINK_PROGRAM.program,
      programLine: pitch?.programLine ?? MAIN_LINK_PROGRAM.description,
      link: '',
      sponsorship: !!offer && offer.seatsLeft > 0,
      regularPrice: program ? (await getRegularPrices([program.id])).get(program.id) ?? '' : '',
      // Members only share their own programs here; no program = the main link ("I'm part of NowTransformed...").
      owns: !!program,
      mainLink: !program,
    }
    const disclosure = disclosureLine(role, !!program)
    const joinBase = appUrl(program ? `/join/${slug}/${program.slug}` : `/join/${slug}`)

    // Decide and claim inside one transaction, under advisory locks on this member and on every address,
    // so two sends at once can't pass the limit or email the same person twice.
    const people = parsed.data.people
    const emails = Array.from(new Set(people.map((p) => normaliseEmail(p.email)).filter(Boolean))).sort()
    const since = new Date(now.getTime() - INVITE_REPEAT_DAYS * 86400_000)

    const claimed = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gi-invite-user:${userId}`}))`
      for (const e of emails) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gi-invite-to:${e}`}))`
      const since24 = new Date(now.getTime() - 86400_000)
      const [sent24, added24, recentRows, stoppedRows, prospectRows] = await Promise.all([
        tx.outreachInvite.count({ where: { userId, status: 'SENT', sentAt: { gte: since24 } } }),
        tx.prospect.count({ where: { invitedById: userId, inviteSource: 'INVITER_ADDED', createdAt: { gte: since24 } } }),
        tx.outreachInvite.findMany({ where: { email: { in: emails }, status: 'SENT', sentAt: { gte: since } }, select: { email: true } }),
        tx.emailSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } }),
        emails.length
          ? tx.prospect.findMany({ where: { OR: emails.map((e) => ({ email: { equals: e, mode: 'insensitive' as const } })) }, select: { email: true, invitedById: true, emailOptOutAt: true } })
          : Promise.resolve([]),
      ])
      const stopped = new Set(stoppedRows.map((r) => r.email))
      const onList = new Map<string, boolean>()
      for (const p of prospectRows) {
        const e = normaliseEmail(p.email)
        if (p.emailOptOutAt) stopped.add(e)
        onList.set(e, onList.get(e) === true || p.invitedById === userId)
      }
      const decisions = decideInvites(people, { usedToday: sent24 + added24, recent: new Set(recentRows.map((r) => r.email)), stopped, onList })
      const out: { d: InviteDecision; id: string | null; token: string | null; parent: boolean }[] = []
      for (let i = 0; i < decisions.length; i++) {
        const d = decisions[i]
        // Nothing to record for typos or the daily limit (keeps the table from growing on repeat tries).
        if (d.action === 'FIX' || (d.action === 'SKIP' && d.reason === 'LIMIT')) { out.push({ d, id: null, token: null, parent: false }); continue }
        const token = crypto.randomBytes(18).toString('base64url')
        const row = await tx.outreachInvite.create({
          data: {
            userId, programId: program?.id ?? null, firstName: d.firstName, email: d.email, personalLine: personalLine || null, token,
            status: d.action === 'SEND' ? 'SENT' : 'SKIPPED', skipReason: d.action === 'SKIP' ? d.reason : null, sentAt: now,
          },
          select: { id: true },
        })
        out.push({ d, id: row.id, token, parent: !!people[i].parent })
      }
      return { out, used: sent24 + added24 }
    }, { timeout: 20_000 })

    // Send after the claim, one at a time with a short gap (the provider allows only a few per second).
    await primeEmailFooter()
    const finals: InviteDecision[] = []
    const results: InviteResult[] = []
    let sentCount = 0
    for (const c of claimed.out) {
      let d = c.d
      if (d.action === 'SEND' && c.id && c.token) {
        const script = scriptFor(c.parent)
        let delivered = false
        if (script) {
          const text = buildInviteText({ script, values: { ...baseValues, firstName: d.firstName }, disclosure, senderFullName: me?.full ?? me?.first ?? '' })
          const joinUrl = `${joinBase}?via=${c.parent ? 'parent' : 'email'}&inv=${encodeURIComponent(c.token)}`
          const mail = inviteEmail({ text, joinUrl, inviteId: c.id, senderFirst: me?.first ?? '', photoUrl: profile?.photoUrl ? appUrl(profile.photoUrl) : null })
          if (sentCount > 0) await pause(350)
          // Shows as "Maria via NowTransformed"; replies go straight to the member.
          const r = await sendEmail({ to: d.email, ...mail, fromName: `${me?.first || "A friend"} via NowTransformed`, replyTo: me?.email || session.user.email || undefined })
          // Without an API key outside production the email is only logged; count it as sent so it can be tested.
          delivered = r.sent || (r.error === 'RESEND_API_KEY not configured' && process.env.NODE_ENV !== 'production')
        }
        if (delivered) {
          sentCount++
          // The email is already out: a failed log must not turn into "nothing was sent".
          await prisma.outreachShare.create({ data: { userId, kind: 'FIRST', channel: c.parent ? 'PARENT' : 'EMAIL', firstName: d.firstName, programId: program?.id ?? null, sentAt: now } })
            .catch((e) => console.error('[OUTREACH] share log failed after send', e))
        } else {
          await prisma.outreachInvite.updateMany({ where: { id: c.id, status: 'SENT' }, data: { status: 'FAILED' } }).catch((e) => console.error('[OUTREACH] mark failed', e))
          results.push({ email: d.email, firstName: d.firstName, ok: false, text: `${d.firstName}: that didn't send. Please try again in a few minutes.` })
          d = { ...d, action: 'FIX', problem: 'BAD_EMAIL' }
          finals.push(d)
          continue
        }
      }
      finals.push(d)
      const t = decisionText(d, INVITES_PER_DAY)
      results.push({ email: d.email, firstName: d.firstName, ok: t.ok, text: t.text, suggestion: d.action === 'FIX' && d.problem === 'TYPO' ? d.suggestion : undefined })
    }

    const base = role === 'COACH' ? '/coach/one-a-day' : '/ambassador/one-a-day'
    revalidatePath(base)
    revalidatePath(`${base}/follow-ups`)
    revalidatePath(`${base}/results`)
    return { ok: true, results, summary: summaryText(finals), usedToday: claimed.used + sentCount }
  } catch (e) {
    console.error('[OUTREACH] sendInvites failed', e)
    return { ok: false, error: "Something went wrong, so nothing was sent. Please try again." }
  }
}
