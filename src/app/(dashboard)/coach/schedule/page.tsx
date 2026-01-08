import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Calendar, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function CoachSchedulePage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('SCHEDULING', 'COACH', session.user.id)
  if (!featureEnabled) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Schedule</h2>
          <p className="text-gray-500 mt-2">This feature is not currently enabled.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-600">
            Manage your calendar and appointments
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Event
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>
            View and manage your scheduled events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No events scheduled. Create your first event.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
