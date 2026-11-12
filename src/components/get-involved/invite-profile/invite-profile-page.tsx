/**
 * Server half of the invite profile page, shared by /coach/invite-profile and /ambassador/invite-profile.
 */
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ensureInviteSlug, userDisplayName } from '@/lib/get-involved/server'
import { invitePrograms } from '@/lib/get-involved/program-welcome-server'
import { getInviteProfile, getSignupOffer } from '@/lib/get-involved/offer'
import { InviteProfileClient, type InviteProfileProgram } from './invite-profile-client'

export async function InviteProfilePage({ role }: { role: 'COACH' | 'AMBASSADOR' }) {
  const session = await auth()
  if (!session || session.user.role !== role) redirect('/login')
  const userId = session.user.id

  const [profile, name, live, slug] = await Promise.all([
    getInviteProfile(userId),
    userDisplayName(userId),
    invitePrograms(userId),
    ensureInviteSlug(userId).catch(() => null),
  ])
  const programs: InviteProfileProgram[] = await Promise.all(live.map(async (p) => {
    const offer = await getSignupOffer(p.id)
    return { id: p.id, name: p.name, seatsLabel: offer ? `sponsored seats: ${offer.seatsLeft} of ${offer.seatsPerMonth} left` : null }
  }))

  // The photo URL is cached for 5 minutes publicly; a version param shows a fresh one here.
  const photoUrl = profile?.hasPhoto && slug ? `/api/invite-photo/${encodeURIComponent(slug)}?v=${Date.now()}` : null

  return (
    <InviteProfileClient
      role={role}
      name={name?.full ?? ''}
      slug={slug}
      photoUrl={photoUrl}
      why={profile?.why ?? ''}
      programId={profile?.programId ?? null}
      programs={programs}
    />
  )
}
