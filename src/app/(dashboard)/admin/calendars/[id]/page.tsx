import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAdminCalendar, getCalendarBookings, getAdminCalendarEvents } from '@/lib/actions/admin-calendars'
import { CalendarDetailClient } from './calendar-detail-client'

interface PageProps {
  params: { id: string }
}

export default async function CalendarDetailPage({ params }: PageProps) {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const calendarResult = await getAdminCalendar(params.id)

  if (calendarResult.error || !calendarResult.calendar) {
    notFound()
  }

  // Get bookings and events for the current month
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [bookingsResult, eventsResult] = await Promise.all([
    getCalendarBookings(params.id, {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString(),
    }),
    getAdminCalendarEvents(params.id, {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString(),
    }),
  ])

  return (
    <CalendarDetailClient
      calendar={calendarResult.calendar}
      bookings={bookingsResult.bookings || []}
      events={eventsResult.events || []}
    />
  )
}
