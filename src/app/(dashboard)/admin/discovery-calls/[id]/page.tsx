import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  GetInvolvedRoleValue, STAGE_LABELS, ageRangeLabel, canChooseRole, isGetInvolvedRole, journeyPosition, journeyStages, priceLabel, rolesForAge,
} from '@/lib/get-involved/core'
import { journeyStateFor } from '@/lib/get-involved/journey'
import { listRoleConfigs } from '@/lib/get-involved/roles'
import { userDisplayName } from '@/lib/get-involved/server'
import { CallRecordClient, CallRecordData } from './call-record-client'

export const dynamic = 'force-dynamic'

const dateOnly = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }).format(d)

export default async function CallRecordPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const call = await prisma.discoveryCall.findUnique({ where: { id: params.id }, include: { prospect: { include: { payment: { select: { status: true } } } } } })
  if (!call) notFound()
  const p = call.prospect
  const minor = p.ageRange === 'UNDER_18'

  const [configs, state, host, inviter] = await Promise.all([
    listRoleConfigs(),
    journeyStateFor(p),
    call.hostId ? userDisplayName(call.hostId) : null,
    p.invitedById ? userDisplayName(p.invitedById) : null,
  ])
  const pos = journeyPosition(state.facts)
  const role = isGetInvolvedRole(p.journeyRole) ? (p.journeyRole as GetInvolvedRoleValue) : null
  const stages = journeyStages(role, { minor, paid: state.facts.paid })
  const at = stages.indexOf(pos.stage)
  const steps = stages.map((s, i) => ({
    label: STAGE_LABELS[s],
    state: pos.stage === 'DONE' || (at >= 0 && i < at) ? 'done' as const : i === at ? 'current' as const : 'todo' as const,
  }))

  const data: CallRecordData = {
    call: {
      id: call.id,
      startsAt: call.startsAt.toISOString(),
      status: call.status,
      meetingUrl: call.meetingUrl,
      notes: call.notes,
      topicsCovered: call.topicsCovered,
      parentAttended: call.parentAttended,
      parentAttendeeName: call.parentAttendeeName,
      parentAttendeeRelationship: call.parentAttendeeRelationship,
      outcomeAt: call.outcomeAt?.toISOString() ?? null,
      cancelReason: call.cancelReason,
    },
    prospect: {
      id: p.id,
      firstName: p.firstName,
      name: `${p.firstName} ${p.lastName}`,
      age: ageRangeLabel(p.ageRange),
      minor,
      city: p.city,
      parentName: p.parentName,
      parentFirst: (p.parentName ?? '').trim().split(/\s+/)[0] || null,
      parentRelationship: p.parentRelationship,
      parentConsent: p.parentConsentAt ? dateOnly(p.parentConsentAt) : null,
      status: p.status,
      roleLabel: state.config?.label ?? null,
      canChooseRole: !p.journeyRole && p.status === 'DISCOVERY_COMPLETED' && canChooseRole(p.status, !!p.roleTermsAcceptedAt),
    },
    host: host?.full ?? null,
    inviter: inviter?.full ?? null,
    inviterFirst: inviter?.first ?? null,
    roles: rolesForAge(configs, p.ageRange).map((c) => ({ role: c.role, label: c.label, price: priceLabel(c) })),
    steps,
    nextStep: pos.nextStep,
    closed: pos.stage === 'CLOSED',
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-gray-600">
          <li><Link href="/admin/discovery-calls" className="font-semibold text-primary-700 hover:underline">Discovery Calls</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-semibold text-gray-900">{data.prospect.name}</li>
        </ol>
      </nav>
      <CallRecordClient data={data} now={new Date().toISOString()} />
    </div>
  )
}
