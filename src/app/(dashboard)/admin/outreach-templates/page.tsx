import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { generalScriptRows } from '@/lib/get-involved/outreach-templates-server'
import { GENERAL_SCRIPTS } from '@/lib/get-involved/scripts-defaults'
import { TaskHeader } from '@/components/ui/kit/task-header'
import { TemplatesClient } from './templates-client'

export const dynamic = 'force-dynamic'

export default async function OutreachTemplatesPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') redirect('/login')
  const rows = await generalScriptRows()

  return (
    <div className="space-y-6">
      <TaskHeader title="Message templates"
        doThis="The general message for each situation. Members see it when their program has no message of its own." />
      <TemplatesClient rows={rows} builtIn={GENERAL_SCRIPTS} />
    </div>
  )
}
