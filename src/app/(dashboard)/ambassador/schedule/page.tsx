import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

export default async function AmbassadorSchedulePage() {
  const session = await auth()

  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  const featureEnabled = await isFeatureEnabled('SCHEDULING', 'AMBASSADOR', session.user.id)
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        <p className="text-gray-600">
          View upcoming events and appointments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
          <CardDescription>
            Events and classes you&apos;re invited to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No upcoming events</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
