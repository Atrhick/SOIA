import { notFound, redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { getMyProgram, getMyProgramLeads } from '@/lib/actions/program-pages'
import { ProgramEditorClient } from '@/app/(dashboard)/coach/programs/[id]/program-editor-client'
import { ProgramLeadsCard } from '@/components/programs/program-leads-card'
import { getWelcomePanel } from '@/lib/actions/program-welcome'
import { WelcomeEmailPanel } from '@/components/program-pages/welcome-email-panel'

export default async function AmbassadorProgramEditorPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('PROGRAM_PAGES', 'AMBASSADOR', session.user.id)
  if (!featureEnabled) {
    return <FeatureDisabled title="Program Pages" icon={Megaphone} />
  }

  const [result, leadsResult, welcome] = await Promise.all([
    getMyProgram(params.id),
    getMyProgramLeads(params.id),
    getWelcomePanel(params.id),
  ])
  if ('error' in result) {
    notFound()
  }

  // Ambassadors have no CRM, so their signups are listed here, under the editor.
  const leads = 'error' in leadsResult ? [] : leadsResult.leads

  return (
    <div className="space-y-6">
      <ProgramEditorClient
        program={result.program}
        readOnly={result.readOnly}
        standardQuestions={result.standardQuestions}
        basePath="/ambassador/programs"
        ownerNoun="ambassador"
      />
      {!('error' in welcome) && <WelcomeEmailPanel data={welcome} />}
      {leads.length > 0 ? (
        <ProgramLeadsCard leads={leads} ownerRole="AMBASSADOR" />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          <p className="font-medium text-gray-900 mb-1">Program Leads</p>
          No one has signed up yet. Once your page is live, people who sign up appear here.
        </div>
      )}
    </div>
  )
}
