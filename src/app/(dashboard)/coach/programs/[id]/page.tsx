import { notFound, redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { FeatureDisabled } from '@/components/ui/feature-disabled'
import { getMyProgram } from '@/lib/actions/program-pages'
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

  const result = await getMyProgram(params.id)
  if ('error' in result) {
    notFound()
  }

  return <ProgramEditorClient program={result.program} />
}
