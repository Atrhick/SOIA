import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ORIENTATION_LATER_MAX_DAYS, canDoOrientation } from '@/lib/get-involved/core'
import { CLOSED_BODY, CLOSED_TITLE, loadJourneyPage } from '@/lib/get-involved/journey-page'
import { recordingFor } from '@/lib/get-involved/orientation-rules'
import { JourneyMessage, JourneyStepFrame } from '@/components/get-involved/journey-step-frame'
import { JourneyExpired } from '@/components/get-involved/journey-expired'
import { OrientationClient } from './orientation-client'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Role orientation | NowTransformed', robots: { index: false } }

export default async function OrientationPage({ params, searchParams }: { params: { token: string }; searchParams: { later?: string } }) {
  const d = await loadJourneyPage(params.token)
  if (d.kind === 'expired') return <JourneyExpired />
  if (d.kind === 'closed') return <JourneyMessage title={CLOSED_TITLE} body={CLOSED_BODY} />
  const { p, cfg, pos } = d
  if (!cfg || !canDoOrientation(p.status)) {
    if (d.currentPath && !d.currentPath.endsWith('/orientation')) redirect(d.currentPath)
    return <JourneyMessage title="Your next step is on its way" body="We'll email you as soon as your next step is ready." />
  }
  const remindAt = p.status === 'ORIENTATION_SCHEDULED' && p.orientationRemindAt && p.orientationRemindAt > new Date() ? p.orientationRemindAt.toISOString() : null
  return (
    <JourneyStepFrame stage={pos.stage} role={p.journeyRole} ageRange={p.ageRange} roleLabel={cfg.label} invitedBy={d.invitedBy}>
      <OrientationClient
        token={params.token}
        roleLabel={cfg.label}
        minutes={cfg.orientationMinutes}
        recording={recordingFor(cfg.orientationUrl)}
        points={cfg.orientationPoints}
        checkQuestion={cfg.comprehensionCheck && cfg.comprehensionQuestion ? cfg.comprehensionQuestion : null}
        remindAt={remindAt}
        startLater={searchParams.later === '1'}
        maxDays={ORIENTATION_LATER_MAX_DAYS}
      />
    </JourneyStepFrame>
  )
}
