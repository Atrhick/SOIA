import { notFound, redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { auth } from '@/lib/auth'
import { loginPath } from '@/lib/safe-callback'
import { coachPagePath } from '@/lib/program-info/paths'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { getMyProgram, getMyProgramLeads } from '@/lib/actions/program-pages'
import { ProgramEditorClient } from '@/app/(dashboard)/coach/programs/[id]/details/program-editor-client'
import { ProgramLeadsCard } from '@/components/programs/program-leads-card'
import { getWelcomePanel } from '@/lib/actions/program-welcome'
import { WelcomeEmailPanel } from '@/components/program-pages/welcome-email-panel'
import { ProgramPricesPanel } from '@/components/program-pages/program-prices-panel'
import { getMyProgramOffer } from '@/lib/actions/outreach-settings'
import { getProgramMessageInfo } from '@/lib/actions/program-message-info'
import { ProgramMessagePanel } from '@/components/program-pages/program-message-panel'
import { TakeOfflineCard } from '@/components/program-pages/take-offline-card'
import { isInProgramInfoFlow } from '@/lib/program-pages-core'

export default async function AmbassadorProgramEditorPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect(loginPath(coachPagePath('AMBASSADOR', params.id, '/details')))
  }

  const featureEnabled = await isFeatureEnabled('PROGRAM_PAGES', 'AMBASSADOR', session.user.id)
  if (!featureEnabled) {
    return <FeatureDisabled title="Program Pages" icon={Megaphone} />
  }

  const [result, leadsResult, welcome, offer, messageInfo] = await Promise.all([
    getMyProgram(params.id),
    getMyProgramLeads(params.id),
    getWelcomePanel(params.id),
    getMyProgramOffer(params.id),
    getProgramMessageInfo(params.id),
  ])
  if ('error' in result) {
    notFound()
  }
  // In the program info workflow, offline, the welcome email and the message line live on the new screens.
  const inFlow = await isInProgramInfoFlow(params.id)

  // Ambassadors have no CRM, so their signups are listed here, under the editor.
  const leads = 'error' in leadsResult ? [] : leadsResult.leads

  return (
    <div className="space-y-6 pb-28 sm:pb-0 min-w-0">
      <ProgramEditorClient
        program={result.program}
        readOnly={result.readOnly}
        standardQuestions={result.standardQuestions}
        basePath="/ambassador/programs"
        ownerNoun="ambassador"
      />
      {messageInfo && !inFlow && <ProgramMessagePanel info={messageInfo} />}
      {offer && <ProgramPricesPanel programId={params.id} offer={offer} />}
      {!('error' in welcome) && !inFlow && <WelcomeEmailPanel data={welcome} />}
      {leads.length > 0 ? (
        <ProgramLeadsCard leads={leads} ownerRole="AMBASSADOR" />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-base text-gray-600">
          <p className="font-medium text-gray-900 mb-1">Program Leads</p>
          No one has signed up yet. Once your page is live, people who sign up appear here.
        </div>
      )}
      {result.program.hasLiveVersion && !result.readOnly && !inFlow && <TakeOfflineCard programId={params.id} programName={result.program.name} />}
    </div>
  )
}
