import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { inviterDashboard } from '@/lib/get-involved/queries'
import { withJourneyStages } from '@/lib/get-involved/leaderboard-extra'
import { OneADayClient } from '@/components/get-involved/one-a-day-client'
import { loadShareKit } from './data'
import { OneADayNav } from './one-a-day-nav'
import { ShareKit } from './share-kit'

/** One-A-Day "Today's invite" (share kit) for coaches and ambassadors, with their links and people below. */
export async function OneADayPage({ role }: { role: 'COACH' | 'AMBASSADOR' }) {
  const session = await auth()
  if (!session || session.user.role !== role) redirect('/login')
  const base = role === 'COACH' ? '/coach' : '/ambassador'
  const [kit, dash] = await Promise.all([loadShareKit(session.user.id, role), inviterDashboard(session.user.id, role)])
  const withStages = await withJourneyStages(session.user.id, dash)
  // The leaderboard is no longer shown to members (only their group of 5 on My results).
  const { roleBoard: _r, overallBoard: _o, myRank: _m, ...data } = withStages

  return (
    <div className="space-y-6">
      <OneADayNav role={role} current="invite" followUpsDue={kit.followUpsDue} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today&apos;s invite</h1>
          <p className="text-gray-600 mt-1">One personal message a day. Pick who, pick how, add one line of your own.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-200 text-orange-900 font-bold text-sm px-3.5 py-2">
          {kit.streak > 0 ? `Day ${kit.streak} streak` : 'Start your streak today'} · {kit.freeMissesLeft} free {kit.freeMissesLeft === 1 ? 'miss' : 'misses'} left
        </span>
      </div>
      <ShareKit role={role} programs={kit.programs} defaultProgram={kit.defaultProgram} templates={kit.templates} />
      <section aria-labelledby="links-people" className="space-y-4 pt-2">
        <h2 id="links-people" className="text-lg font-bold text-gray-900">Your links and people</h2>
        <OneADayClient data={data} resultsHref={`${base}/one-a-day/results`} />
      </section>
    </div>
  )
}
