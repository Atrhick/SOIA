import { notFound } from 'next/navigation'
import { getPublicCalendarBySlug } from '@/lib/actions/admin-calendars'
import { getProspectByOrientationToken } from '@/lib/actions/prospects'
import { OrientationBookingClient } from './orientation-booking-client'

interface PageProps {
  params: { token: string }
}

export default async function OrientationBookingPage({ params }: PageProps) {
  // Validate the token and get prospect info
  const prospectResult = await getProspectByOrientationToken(params.token)

  if (prospectResult.error || !prospectResult.prospect) {
    // Show error page instead of 404
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {prospectResult.error || 'Invalid Link'}
          </h1>
          <p className="text-gray-600">
            This link may have expired or already been used. Please contact us if you need assistance.
          </p>
        </div>
      </div>
    )
  }

  // Get the orientation calendar
  const calendarResult = await getPublicCalendarBySlug('orientation')

  if (calendarResult.error || !calendarResult.calendar) {
    notFound()
  }

  return (
    <OrientationBookingClient
      calendar={calendarResult.calendar}
      prospect={prospectResult.prospect}
      token={params.token}
    />
  )
}
