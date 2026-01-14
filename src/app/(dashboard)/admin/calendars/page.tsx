import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllAdminCalendars } from '@/lib/actions/admin-calendars'
import { CalendarsClient } from './calendars-client'

export default async function AdminCalendarsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const result = await getAllAdminCalendars()

  if (result.error) {
    return (
      <div className="p-6">
        <p className="text-red-600">Error loading calendars: {result.error}</p>
      </div>
    )
  }

  return <CalendarsClient calendars={result.calendars || []} />
}
