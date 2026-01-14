import { notFound } from 'next/navigation'
import { getPublicCalendarBySlug } from '@/lib/actions/admin-calendars'
import { BookingClient } from './booking-client'

interface PageProps {
  params: { slug: string }
  searchParams: { prospectId?: string }
}

export default async function PublicBookingPage({ params, searchParams }: PageProps) {
  const result = await getPublicCalendarBySlug(params.slug)

  if (result.error || !result.calendar) {
    notFound()
  }

  return (
    <BookingClient
      calendar={result.calendar}
      prospectId={searchParams.prospectId}
    />
  )
}
