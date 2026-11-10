/**
 * Page frame for the Join, Give and Welcome steps: progress rail on the left at md and up, above the
 * card on phones. No hooks, so it works in server components.
 */
import { JourneyRail } from '@/components/get-involved/journey-rail'
import type { JourneyStage } from '@/lib/get-involved/core'

export const journeyCard = 'bg-white border border-gray-200 rounded-2xl p-6 md:p-8 space-y-5 min-w-0'
export const journeyBtn = 'h-12 px-5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

export function JoinShell({ rail, children }: {
  rail: { stage: JourneyStage; role: string | null; ageRange: string | null; roleLabel: string | null } | null
  children: React.ReactNode
}) {
  if (!rail) return <div className="max-w-2xl mx-auto">{children}</div>
  return (
    <div className="grid gap-4 md:gap-6 md:grid-cols-[240px_minmax(0,1fr)] items-start">
      <JourneyRail stage={rail.stage} role={rail.role} ageRange={rail.ageRange} roleLabel={rail.roleLabel} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
