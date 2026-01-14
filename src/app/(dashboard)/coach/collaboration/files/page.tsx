import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { getSharedDocuments } from '@/lib/actions/collaboration'
import { FileText } from 'lucide-react'
import { FilesClient } from './files-client'

export default async function CoachFilesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('COLLABORATION', 'COACH', session.user.id)
  if (!featureEnabled) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Files</h2>
          <p className="text-gray-500 mt-2">This feature is not currently enabled.</p>
        </div>
      </div>
    )
  }

  const documentsResult = await getSharedDocuments()
  const documents = documentsResult.documents || []

  return (
    <FilesClient
      documents={documents}
      userId={session.user.id}
    />
  )
}
