/**
 * E13 "Someone joined your team" for the inviter, with their rank and team numbers.
 * See ./index.ts for the rules. Server only (the sender reads the database).
 */
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { Mail, P, SMALL, appUrl, esc, layout } from '../emails'
import { joinedByInviter, leaderboard, monthStart } from '../queries'
import { userDisplayName } from '../server'
import { prospectRoleConfig } from '../roles'

export function teamJoinedEmail(p: {
  inviterFirst: string
  prospectName: string
  prospectFirst: string
  roleLabel: string
  /** This month's overall leaderboard rank, or null if not ranked. */
  rank: number | null
  joinedThisMonth: number
  teamSize: number
  teamUrl: string
}): Mail {
  const rank = p.rank ? `You're now <strong>#${p.rank}</strong> on this month's leaderboard. ` : ''
  return {
    subject: `${p.prospectName} joined your team!`,
    html: layout(
      `<p style="${P}">${esc(p.inviterFirst)}, <strong>${esc(p.prospectName)}</strong> just joined NowTransformed as a <strong>${esc(p.roleLabel)}</strong>, and they're on your team.</p>
       <p style="${P}">${rank}Help ${esc(p.prospectFirst)} get started: share how you do your One-A-Day.</p>
       <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:12px 16px;margin:0 0 14px;color:#075985;font-size:14px">
         Joined this month: <strong>${p.joinedThisMonth}</strong> &nbsp;·&nbsp; Team size: <strong>${p.teamSize}</strong>
       </div>`,
      { label: `Say welcome to ${p.prospectFirst}`, url: p.teamUrl },
      `<p style="${SMALL}">Only people who finish the journey count as joined.</p>`,
    ),
  }
}

/**
 * Send E13 to whoever invited the prospect. Call it after the login exists (ACCOUNT_CREATED), outside
 * any transaction. Never throws. completeJourney() in login.ts sends it, so don't call it again there.
 */
export async function sendInviterJoined(prospectId: string): Promise<void> {
  try {
    const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { firstName: true, lastName: true, invitedById: true, journeyRole: true, roleConfigSnapshot: true } })
    if (!p?.invitedById) return
    const inviter = await prisma.user.findUnique({ where: { id: p.invitedById }, select: { role: true, status: true } })
    const name = await userDisplayName(p.invitedById)
    if (!inviter || inviter.status !== 'ACTIVE' || !name) return
    const cfg = await prospectRoleConfig(p)
    const since = monthStart()
    const [joined, board, teamSize] = await Promise.all([
      joinedByInviter(since),
      leaderboard({ since, role: 'ALL' }),
      prisma.prospect.count({ where: { invitedById: p.invitedById, status: 'ACCOUNT_CREATED', userId: { not: null } } }),
    ])
    const m = teamJoinedEmail({
      inviterFirst: name.first,
      prospectName: `${p.firstName} ${p.lastName}`,
      prospectFirst: p.firstName,
      roleLabel: cfg?.label ?? 'member',
      rank: board.find((r) => r.userId === p.invitedById)?.rank ?? null,
      joinedThisMonth: joined.get(p.invitedById) ?? 0,
      teamSize,
      teamUrl: appUrl(inviter.role === 'AMBASSADOR' ? '/ambassador/my-team' : '/coach/my-team'),
    })
    await sendEmail({ to: name.email, ...m })
  } catch (e) {
    console.error('[GET-INVOLVED] team joined email failed', e)
  }
}
