import { notFound } from 'next/navigation'
import { getPublicCalendarBySlug } from '@/lib/actions/admin-calendars'
import { BookingClient } from './booking-client'
import prisma from '@/lib/prisma'

interface PageProps {
  params: { slug: string }
  searchParams: { prospectId?: string }
}

export default async function PublicBookingPage({ params, searchParams }: PageProps) {
  const result = await getPublicCalendarBySlug(params.slug)

  if (result.error || !result.calendar) {
    notFound()
  }

  // If prospectId is provided, fetch prospect data
  let prospect = null
  if (searchParams.prospectId) {
    const prospectData = await prisma.prospect.findUnique({
      where: { id: searchParams.prospectId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    })
    if (prospectData) {
      prospect = prospectData
    }
  }

  return (
    <BookingClient calendar={result.calendar} prospect={prospect} />
  )
}
