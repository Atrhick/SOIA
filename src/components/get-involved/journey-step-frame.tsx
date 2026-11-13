/**
 * Page frame for the prospect's /journey/[token]/... steps: "Invited by" line, the progress rail
 * (left column on desktop, compact bar above the card on phone) and the white card.
 * No hooks, so it works in server and client components.
 */
import type { JourneyStage } from '@/lib/get-involved/core'
import { JourneyRail } from './journey-rail'

export const stepCard = 'min-w-0 bg-white border border-gray-200 rounded-2xl p-6 md:p-8'
export const primaryBtn = 'h-12 px-5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
export const secondaryBtn = 'h-12 px-5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

export function JourneyStepFrame({ stage, role, ageRange, roleLabel, invitedBy, children }: {
  stage: JourneyStage
  role: string | null
  ageRange: string | null
  roleLabel?: string | null
  invitedBy?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      {invitedBy && <p className="text-sm text-gray-600 md:text-right">Invited by <strong className="text-gray-900">{invitedBy}</strong></p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 md:items-start">
        <JourneyRail stage={stage} role={role} ageRange={ageRange} roleLabel={roleLabel} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}

/** A plain message card (closed journeys, nothing to do yet). */
export function JourneyMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className={`${stepCard} max-w-2xl mx-auto space-y-3`}>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-700">{body}</p>
    </div>
  )
}
