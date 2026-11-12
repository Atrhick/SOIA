import type { Metadata } from 'next'
import prisma from '@/lib/prisma'
import { userDisplayName } from '@/lib/get-involved/server'
import { linkStillValid } from '@/lib/get-involved/core'
import { getInviteProfile, getSignupOffer } from '@/lib/get-involved/offer'
import { programDisplay, userOwnsProgram } from '@/lib/get-involved/program-welcome-server'
import { ConsentClient } from './consent-client'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Parent consent | NowTransformed', robots: { index: false } }

export default async function ConsentPage({ params }: { params: { token: string } }) {
  const p = await prisma.prospect.findUnique({
    where: { parentConsentToken: params.token },
    select: { firstName: true, parentName: true, status: true, parentConsentAt: true, parentConsentRequestedAt: true, journeyToken: true, invitedById: true, programId: true, parentRelationship: true },
  })
  // Not yet given: only valid while the young person is still waiting for consent (not closed by staff).
  if (!p || (!p.parentConsentAt && (p.status !== 'AWAITING_PARENT_CONSENT' || !linkStillValid(p.parentConsentRequestedAt, new Date())))) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">This consent link is no longer valid</h1>
        <p className="mt-3 text-gray-600">It may have been used to decline, or the request expired. Reply to our email if you need help.</p>
      </div>
    )
  }
  const [inviter, profile, program, offer, owns] = await Promise.all([
    p.invitedById ? userDisplayName(p.invitedById) : null,
    p.invitedById ? getInviteProfile(p.invitedById).catch(() => null) : null,
    p.programId ? programDisplay(p.programId).catch(() => null) : null,
    p.programId ? getSignupOffer(p.programId).catch(() => null) : null,
    p.invitedById && p.programId ? userOwnsProgram(p.invitedById, p.programId).catch(() => false) : false,
  ])
  const inviterName = inviter?.full ?? null
  const role = inviter?.role === 'COACH' ? 'coach' : inviter?.role === 'AMBASSADOR' ? 'ambassador' : 'member'
  return (
    <ConsentClient
      token={params.token}
      childFirst={p.firstName}
      parentName={p.parentName ?? ''}
      relationship={p.parentRelationship === 'Legal guardian' ? 'Legal guardian' : 'Parent'}
      inviter={inviterName ? {
        name: inviterName,
        photoUrl: profile?.photoUrl ?? null,
        initials: inviterName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => (w?.[0] || '?').toUpperCase()).join('') || '?',
        // "the NowTransformed coach who runs this program" only when the inviter owns the program.
        line: program && owns ? `the NowTransformed ${role} who runs this program` : `a NowTransformed ${role}`,
      } : null}
      programName={program?.label ?? null}
      offer={offer && offer.sponsoredPrice ? { sponsoredPrice: offer.sponsoredPrice, fullPrice: offer.fullPrice } : null}
      alreadyGiven={!!p.parentConsentAt}
      bookPath={p.journeyToken ? `/discovery/${p.journeyToken}` : null}
    />
  )
}
