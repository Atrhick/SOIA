import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAdminCalendar, getCalendarBookings, getAdminCalendarEvents } from '@/lib/actions/admin-calendars'
import { CalendarDetailClient } from './calendar-detail-client'

interface PageProps {
  params: { id: string }
  searchParams: { returnTo?: string; returnLabel?: string }
}

export default async function CalendarDetailPage({ params, searchParams }: PageProps) {
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

  // Validate returnTo is a safe internal path
  const returnTo = searchParams.returnTo?.startsWith('/admin/') ? searchParams.returnTo : undefined
  const returnLabel = returnTo ? (searchParams.returnLabel || 'Back') : undefined

  return (
    <CalendarDetailClient
      calendar={calendarResult.calendar}
      bookings={bookingsResult.bookings || []}
      events={eventsResult.events || []}
      returnTo={returnTo}
      returnLabel={returnLabel}
    />
  )
}
