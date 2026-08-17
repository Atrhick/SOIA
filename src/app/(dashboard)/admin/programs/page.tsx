import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllPrograms } from '@/lib/actions/program-pages'
import { ProgramsAdminClient } from './programs-admin-client'

export default async function AdminProgramsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const result = await getAllPrograms()

  if ('error' in result) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {result.error}
      </div>
    )
  }

  return <ProgramsAdminClient programs={result.programs} coaches={result.coaches} />
}
