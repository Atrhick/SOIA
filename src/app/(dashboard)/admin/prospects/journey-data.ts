/**
 * Server-side loader for the Get Involved prospects list. Used by the list page and the CSV
 * export route; both check ADMIN before calling it. Not a 'use server' file.
 */
import prisma from '@/lib/prisma'
import { ageRangeLabel, isPaidRole, journeyPosition, roleConfigFromRow, roleLabel, isGetInvolvedRole } from '@/lib/get-involved/core'
import { journeyFactsFor } from '@/lib/get-involved/journey'
import { userDisplayName } from '@/lib/get-involved/server'
import { JourneyRow, ListStage, lastActivity, listStageFor, stageBadgeClass, stageBadgeLabel } from './journey-list'

/** Most recent first. A Get Involved prospect is one with a journeyToken. */
export async function loadJourneyRows(now = new Date()): Promise<JourneyRow[]> {
  const prospects = await prisma.prospect.findMany({
    where: { journeyToken: { not: null } },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, city: true, ageRange: true, status: true,
      invitedById: true, journeyRole: true, roleConfigSnapshot: true, userId: true, noShowCount: true,
      createdAt: true, updatedAt: true, parentConsentRequestedAt: true, journeyRoleChosenAt: true,
      assessmentSentAt: true, assessmentSubmittedAt: true, orientationRemindAt: true, orientationWatchedAt: true,
      roleTermsAcceptedAt: true, joinedAt: true, notAFitAt: true,
      payment: { select: { status: true, paidAt: true } },
      discoveryCalls: { where: { status: { in: ['BOOKED', 'NO_SHOW'] } }, orderBy: { startsAt: 'desc' }, take: 3, select: { status: true, startsAt: true } },
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })

  const inviterIds = Array.from(new Set(prospects.map((p) => p.invitedById).filter((x): x is string => !!x)))
  const names = new Map<string, string>()
  await Promise.all(inviterIds.map(async (id) => { names.set(id, (await userDisplayName(id))?.full ?? 'Unknown') }))

  const rows = prospects.map((p): JourneyRow => {
    // The snapshot taken when the role was chosen holds the label and price that apply to this person.
    const cfg = isGetInvolvedRole(p.journeyRole)
      ? roleConfigFromRow(p.journeyRole, p.roleConfigSnapshot && typeof p.roleConfigSnapshot === 'object' && !Array.isArray(p.roleConfigSnapshot) ? (p.roleConfigSnapshot as Record<string, unknown>) : null)
      : null
    const stage: ListStage = listStageFor(p)
    const facts = journeyFactsFor(p, cfg)
    const pos = journeyPosition({ ...facts, paid: cfg ? isPaidRole(cfg) : false })
    const booked = p.discoveryCalls.filter((c) => c.status === 'BOOKED').sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]
    const missed = p.discoveryCalls.find((c) => c.status === 'NO_SHOW')
    const act = lastActivity({
      status: p.status, stage, createdAt: p.createdAt, updatedAt: p.updatedAt,
      parentConsentRequestedAt: p.parentConsentRequestedAt, journeyRoleChosenAt: p.journeyRoleChosenAt,
      assessmentSentAt: p.assessmentSentAt, assessmentSubmittedAt: p.assessmentSubmittedAt,
      orientationRemindAt: p.orientationRemindAt, orientationWatchedAt: p.orientationWatchedAt,
      roleTermsAcceptedAt: p.roleTermsAcceptedAt, paidAt: p.payment?.paidAt ?? null, joinedAt: p.joinedAt, notAFitAt: p.notAFitAt,
      bookedCallAt: booked?.startsAt ?? null, missedCallAt: missed?.startsAt ?? null, lastHistoryAt: p.statusHistory[0]?.createdAt ?? null,
    }, now)
    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      email: p.email,
      phone: p.phone,
      city: p.city,
      ageRange: p.ageRange,
      ageLabel: ageRangeLabel(p.ageRange),
      inviterId: p.invitedById,
      inviterName: p.invitedById ? names.get(p.invitedById) ?? null : null,
      role: p.journeyRole,
      roleLabel: cfg ? cfg.label : p.journeyRole ? roleLabel(p.journeyRole) : null,
      status: p.status,
      stage,
      stageLabel: stageBadgeLabel(stage, p.status),
      stageClass: stageBadgeClass(stage, p.status),
      nextStep: pos.nextStep,
      lastActivity: act.text,
      lastActivityAt: act.at.toISOString(),
      createdAt: p.createdAt.toISOString(),
    }
  })
  return rows.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
}

/** People whose login was created in the last 30 days (same rule as the leaderboard's "joined"). */
export async function joinedLast30Days(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 30 * 86400_000)
  return prisma.prospect.count({
    where: { journeyToken: { not: null }, statusHistory: { some: { toStatus: 'ACCOUNT_CREATED', createdAt: { gte: since } } } },
  })
}
