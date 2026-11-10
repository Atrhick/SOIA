import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { canAnswerAssessment } from '@/lib/get-involved/core'
import { CLOSED_BODY, CLOSED_TITLE, loadJourneyPage } from '@/lib/get-involved/journey-page'
import { JourneyMessage, JourneyStepFrame } from '@/components/get-involved/journey-step-frame'
import { JourneyExpired } from '@/components/get-involved/journey-expired'
import { AssessmentClient } from './assessment-client'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Role assessment | NowTransformed', robots: { index: false } }

export default async function AssessmentPage({ params }: { params: { token: string } }) {
  const d = await loadJourneyPage(params.token)
  if (d.kind === 'expired') return <JourneyExpired />
  if (d.kind === 'closed') return <JourneyMessage title={CLOSED_TITLE} body={CLOSED_BODY} />
  const { p, cfg, pos } = d
  if (!cfg || !canAnswerAssessment(p.status)) {
    // Already answered, or not at this step yet: go to where they are now.
    if (d.currentPath && !d.currentPath.endsWith('/assessment')) redirect(d.currentPath)
    return <JourneyMessage title="Your next step is on its way" body="We'll email you as soon as your next step is ready." />
  }
  return (
    <JourneyStepFrame stage={pos.stage} role={p.journeyRole} ageRange={p.ageRange} roleLabel={cfg.label} invitedBy={d.invitedBy}>
      <AssessmentClient token={params.token} firstName={p.firstName} roleLabel={cfg.label} questions={cfg.questions}
        marker={{ role: p.journeyRole ?? '', chosenAt: p.journeyRoleChosenAt?.toISOString() ?? null }} />
    </JourneyStepFrame>
  )
}
