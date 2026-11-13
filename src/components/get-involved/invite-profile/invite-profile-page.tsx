/**
 * Server half of the invite profile page, shared by /coach/invite-profile and /ambassador/invite-profile.
 * One job: add a photo and one line on why you do this. Reached from Invite, so it keeps the One-A-Day tabs
 * (none selected) and a way back.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { ensureInviteSlug, userDisplayName } from '@/lib/get-involved/server'
import { invitePrograms } from '@/lib/get-involved/program-welcome-server'
import { getInviteProfile, getSignupOffer } from '@/lib/get-involved/offer'
import { followUpsDueCount } from '@/lib/get-involved/follow-ups'
import { OneADayNav } from '@/components/get-involved/share-kit/one-a-day-nav'
import { kit } from '@/components/ui/kit/styles'
import { InviteProfileClient, type InviteProfileProgram } from './invite-profile-client'

export async function InviteProfilePage({ role }: { role: 'COACH' | 'AMBASSADOR' }) {
  const session = await auth()
  if (!session || session.user.role !== role) redirect('/login')
  const userId = session.user.id
  const base = role === 'COACH' ? '/coach' : '/ambassador'

  const [profile, name, live, slug, due] = await Promise.all([
    getInviteProfile(userId),
    userDisplayName(userId),
    invitePrograms(userId),
    ensureInviteSlug(userId).catch(() => null),
    followUpsDueCount(userId).catch(() => 0),
  ])
  const programs: InviteProfileProgram[] = await Promise.all(live.map(async (p) => {
    const offer = await getSignupOffer(p.id)
    return { id: p.id, name: p.name, seatsLabel: offer ? `${offer.seatsLeft} of ${offer.seatsPerMonth} sponsored seats left this month` : null }
  }))

  // The photo URL is cached for 5 minutes publicly; a version param shows a fresh one here.
  const photoUrl = profile?.hasPhoto && slug ? `/api/invite-photo/${encodeURIComponent(slug)}?v=${Date.now()}` : null

  return (
    <div className="max-w-4xl space-y-4">
      <OneADayNav role={role} current={null} followUpsDue={due} />
      <Link href={`${base}/one-a-day`} className={`${kit.quiet} -ml-2`}><ArrowLeft className="h-5 w-5" aria-hidden />Back to Invite</Link>
      <InviteProfileClient
        role={role}
        name={name?.full ?? ''}
        slug={slug}
        photoUrl={photoUrl}
        why={profile?.why ?? ''}
        programId={profile?.programId ?? null}
        programs={programs}
      />
    </div>
  )
}
