import { redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { getMyPrograms } from '@/lib/actions/program-pages'
import { ProgramsListClient } from '@/app/(dashboard)/coach/programs/programs-list-client'

export default async function AmbassadorProgramsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('PROGRAM_PAGES', 'AMBASSADOR', session.user.id)
  if (!featureEnabled) {
    return <FeatureDisabled title="Program Pages" icon={Megaphone} />
  }

  const result = await getMyPrograms()
  if ('error' in result) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {result.error}
      </div>
    )
  }

  return <ProgramsListClient programs={result.programs} basePath="/ambassador/programs" />
}
