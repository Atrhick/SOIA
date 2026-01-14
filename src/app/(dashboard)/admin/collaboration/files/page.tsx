import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSharedDocuments } from '@/lib/actions/collaboration'
import { FilesAdminClient } from './files-admin-client'

export default async function AdminFilesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const documentsResult = await getSharedDocuments()
  const documents = documentsResult.documents || []

  return (
    <FilesAdminClient
      documents={documents}
      userId={session.user.id}
    />
  )
}
