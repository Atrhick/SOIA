import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { FolderKanban, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function CoachProjectsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('PROJECT_MANAGEMENT', 'COACH', session.user.id)
  if (!featureEnabled) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <FolderKanban className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          <p className="text-gray-500 mt-2">This feature is not currently enabled.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">
            Manage your projects and tasks
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Projects</CardTitle>
          <CardDescription>
            Create and manage projects with tasks and milestones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FolderKanban className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No projects yet. Create your first project to get started.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
