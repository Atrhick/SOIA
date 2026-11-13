import { notFound, redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { getMyProgram } from '@/lib/actions/program-pages'
import { getWelcomePanel } from '@/lib/actions/program-welcome'
import { WelcomeEmailPanel } from '@/components/program-pages/welcome-email-panel'
import { ProgramPricesPanel } from '@/components/program-pages/program-prices-panel'
import { getMyProgramOffer } from '@/lib/actions/outreach-settings'
import { getProgramMessageInfo } from '@/lib/actions/program-message-info'
import { ProgramMessagePanel } from '@/components/program-pages/program-message-panel'
import { TakeOfflineCard } from '@/components/program-pages/take-offline-card'
import { ProgramEditorClient } from './program-editor-client'

export default async function CoachProgramEditorPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('PROGRAM_PAGES', 'COACH', session.user.id)
  if (!featureEnabled) {
    return <FeatureDisabled title="Program Pages" icon={Megaphone} />
  }

  const [result, welcome, offer, messageInfo] = await Promise.all([getMyProgram(params.id), getWelcomePanel(params.id), getMyProgramOffer(params.id), getProgramMessageInfo(params.id)])
  if ('error' in result) {
    notFound()
  }

  return (
    <div className="space-y-6 pb-28 sm:pb-0 min-w-0">
      <ProgramEditorClient
        program={result.program}
        readOnly={result.readOnly}
        standardQuestions={result.standardQuestions}
      />
      {messageInfo && <ProgramMessagePanel info={messageInfo} />}
      {offer && <ProgramPricesPanel programId={params.id} offer={offer} />}
      {!('error' in welcome) && <WelcomeEmailPanel data={welcome} />}
      {result.program.hasLiveVersion && !result.readOnly && <TakeOfflineCard programId={params.id} programName={result.program.name} />}
    </div>
  )
}
