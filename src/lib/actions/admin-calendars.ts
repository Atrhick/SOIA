'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { CalendarType, CalendarVisibility, BookingStatus } from '@prisma/client'

// ============================================
// ADMIN CALENDAR MANAGEMENT
// ============================================

export async function getAllAdminCalendars() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const calendars = await prisma.adminCalendar.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            slots: true,
            bookings: true,
            events: true,
          },
        },
      },
    })

    return {
      calendars: calendars.map((cal) => ({
        ...cal,
        createdAt: cal.createdAt.toISOString(),
        updatedAt: cal.updatedAt.toISOString(),
      })),
    }
  } catch (error) {
    console.error('Error fetching calendars:', error)
    return { error: 'Failed to fetch calendars' }
  }
}

export async function createAdminCalendar(data: {
  name: string
  description?: string
  type: CalendarType
  visibility: CalendarVisibility
  color?: string
  slotDurationMinutes?: number
  bufferMinutes?: number
  maxBookingsPerSlot?: number
  requiresApproval?: boolean
  isPublicBookable?: boolean
  publicSlug?: string
}) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Check for unique slug if provided
    if (data.publicSlug) {
      const existing = await prisma.adminCalendar.findUnique({
        where: { publicSlug: data.publicSlug },
      })
      if (existing) {
        return { error: 'This URL slug is already in use' }
      }
    }

    const calendar = await prisma.adminCalendar.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        visibility: data.visibility,
        color: data.color || '#3B82F6',
        slotDurationMinutes: data.slotDurationMinutes || 60,
        bufferMinutes: data.bufferMinutes || 0,
        maxBookingsPerSlot: data.maxBookingsPerSlot || 1,
        requiresApproval: data.requiresApproval || false,
        isPublicBookable: data.isPublicBookable || false,
        publicSlug: data.publicSlug,
        createdBy: session.user.id,
      },
    })

    revalidatePath('/admin/calendars')
    return { calendar }
  } catch (error) {
    console.error('Error creating calendar:', error)
    return { error: 'Failed to create calendar' }
  }
}

export async function updateAdminCalendar(
  calendarId: string,
  data: {
    name?: string
    description?: string
    type?: CalendarType
    visibility?: CalendarVisibility
    color?: string
    slotDurationMinutes?: number
    bufferMinutes?: number
    maxBookingsPerSlot?: number
    requiresApproval?: boolean
    isPublicBookable?: boolean
    publicSlug?: string
    isActive?: boolean
  }
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Check for unique slug if being changed
    if (data.publicSlug) {
      const existing = await prisma.adminCalendar.findFirst({
        where: {
          publicSlug: data.publicSlug,
          NOT: { id: calendarId },
        },
      })
      if (existing) {
        return { error: 'This URL slug is already in use' }
      }
    }

    const calendar = await prisma.adminCalendar.update({
      where: { id: calendarId },
      data,
    })

    revalidatePath('/admin/calendars')
    revalidatePath(`/admin/calendars/${calendarId}`)
    return { calendar }
  } catch (error) {
    console.error('Error updating calendar:', error)
    return { error: 'Failed to update calendar' }
  }
}

export async function deleteAdminCalendar(calendarId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.adminCalendar.delete({
      where: { id: calendarId },
    })

    revalidatePath('/admin/calendars')
    return { success: true }
  } catch (error) {
    console.error('Error deleting calendar:', error)
    return { error: 'Failed to delete calendar' }
  }
}

export async function getAdminCalendar(calendarId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const calendar = await prisma.adminCalendar.findUnique({
      where: { id: calendarId },
      include: {
        slots: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
        access: true,
        _count: {
          select: {
            bookings: true,
            events: true,
          },
        },
      },
    })

    if (!calendar) {
      return { error: 'Calendar not found' }
    }

    return {
      calendar: {
        ...calendar,
        createdAt: calendar.createdAt.toISOString(),
        updatedAt: calendar.updatedAt.toISOString(),
        slots: calendar.slots.map((slot) => ({
          ...slot,
          specificDate: slot.specificDate?.toISOString() || null,
          createdAt: slot.createdAt.toISOString(),
          updatedAt: slot.updatedAt.toISOString(),
        })),
      },
    }
  } catch (error) {
    console.error('Error fetching calendar:', error)
    return { error: 'Failed to fetch calendar' }
  }
}

// ============================================
// CALENDAR SLOTS
// ============================================

export async function addCalendarSlot(data: {
  calendarId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  timezone?: string
  maxBookings?: number
  isRecurring?: boolean
  specificDate?: string
}) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const slot = await prisma.calendarSlot.create({
      data: {
        calendarId: data.calendarId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        timezone: data.timezone || 'America/Los_Angeles',
        maxBookings: data.maxBookings || 1,
        isRecurring: data.isRecurring !== false,
        specificDate: data.specificDate ? new Date(data.specificDate) : null,
      },
    })

    revalidatePath(`/admin/calendars/${data.calendarId}`)
    return { slot }
  } catch (error) {
    console.error('Error adding slot:', error)
    return { error: 'Failed to add slot' }
  }
}

export async function updateCalendarSlot(
  slotId: string,
  data: {
    dayOfWeek?: number
    startTime?: string
    endTime?: string
    timezone?: string
    maxBookings?: number
    isRecurring?: boolean
    specificDate?: string | null
    isActive?: boolean
  }
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const slot = await prisma.calendarSlot.update({
      where: { id: slotId },
      data: {
        ...data,
        specificDate: data.specificDate ? new Date(data.specificDate) : data.specificDate === null ? null : undefined,
      },
    })

    revalidatePath(`/admin/calendars/${slot.calendarId}`)
    return { slot }
  } catch (error) {
    console.error('Error updating slot:', error)
    return { error: 'Failed to update slot' }
  }
}

export async function deleteCalendarSlot(slotId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const slot = await prisma.calendarSlot.delete({
      where: { id: slotId },
    })

    revalidatePath(`/admin/calendars/${slot.calendarId}`)
    return { success: true }
  } catch (error) {
    console.error('Error deleting slot:', error)
    return { error: 'Failed to delete slot' }
  }
}

// ============================================
// CALENDAR EVENTS (Admin created events)
// ============================================

export async function addCalendarEvent(data: {
  calendarId: string
  title: string
  description?: string
  startTime: string
  endTime: string
  isAllDay?: boolean
  location?: string
  isOnline?: boolean
  meetingLink?: string
}) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const event = await prisma.calendarEvent.create({
      data: {
        adminCalendarId: data.calendarId,
        creatorId: session.user.id,
        title: data.title,
        description: data.description,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        isAllDay: data.isAllDay || false,
        location: data.location,
        isOnline: data.isOnline || false,
        meetingLink: data.meetingLink,
      },
    })

    revalidatePath(`/admin/calendars/${data.calendarId}`)
    return { event }
  } catch (error) {
    console.error('Error adding event:', error)
    return { error: 'Failed to add event' }
  }
}

export async function updateCalendarEvent(
  eventId: string,
  data: {
    title?: string
    description?: string
    startTime?: string
    endTime?: string
    isAllDay?: boolean
    location?: string
    isOnline?: boolean
    meetingLink?: string
  }
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const event = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        title: data.title,
        description: data.description,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        isAllDay: data.isAllDay,
        location: data.location,
        isOnline: data.isOnline,
        meetingLink: data.meetingLink,
      },
    })

    if (event.adminCalendarId) {
      revalidatePath(`/admin/calendars/${event.adminCalendarId}`)
    }
    return { event }
  } catch (error) {
    console.error('Error updating event:', error)
    return { error: 'Failed to update event' }
  }
}

export async function deleteCalendarEvent(eventId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const event = await prisma.calendarEvent.delete({
      where: { id: eventId },
    })

    if (event.adminCalendarId) {
      revalidatePath(`/admin/calendars/${event.adminCalendarId}`)
    }
    return { success: true }
  } catch (error) {
    console.error('Error deleting event:', error)
    return { error: 'Failed to delete event' }
  }
}

// ============================================
// BOOKINGS
// ============================================

export async function getCalendarBookings(calendarId: string, dateRange?: { start: string; end: string }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const where: Record<string, unknown> = { calendarId }

    if (dateRange) {
      where.bookingDate = {
        gte: new Date(dateRange.start),
        lte: new Date(dateRange.end),
      }
    }

    const bookings = await prisma.calendarBooking.findMany({
      where,
      include: {
        prospect: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        slot: true,
      },
      orderBy: { bookingDate: 'asc' },
    })

    return {
      bookings: bookings.map((b) => ({
        ...b,
        bookingDate: b.bookingDate.toISOString(),
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        confirmedAt: b.confirmedAt?.toISOString() || null,
        cancelledAt: b.cancelledAt?.toISOString() || null,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        slot: b.slot ? {
          ...b.slot,
          specificDate: b.slot.specificDate?.toISOString() || null,
          createdAt: b.slot.createdAt.toISOString(),
          updatedAt: b.slot.updatedAt.toISOString(),
        } : null,
      })),
    }
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return { error: 'Failed to fetch bookings' }
  }
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  notes?: string
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const updateData: Record<string, unknown> = { status }

    if (status === 'CONFIRMED') {
      updateData.confirmedBy = session.user.id
      updateData.confirmedAt = new Date()
    } else if (status === 'CANCELLED') {
      updateData.cancelledBy = session.user.id
      updateData.cancelledAt = new Date()
      if (notes) updateData.cancellationReason = notes
    }

    const booking = await prisma.calendarBooking.update({
      where: { id: bookingId },
      data: updateData,
      include: { calendar: true },
    })

    revalidatePath(`/admin/calendars/${booking.calendarId}`)
    return { booking }
  } catch (error) {
    console.error('Error updating booking status:', error)
    return { error: 'Failed to update booking status' }
  }
}

// ============================================
// PUBLIC CALENDAR ACCESS (for prospects)
// ============================================

export async function getPublicCalendarBySlug(slug: string) {
  try {
    const calendar = await prisma.adminCalendar.findUnique({
      where: { publicSlug: slug },
      include: {
        slots: {
          where: { isActive: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    })

    if (!calendar || !calendar.isPublicBookable || !calendar.isActive) {
      return { error: 'Calendar not found' }
    }

    return {
      calendar: {
        id: calendar.id,
        name: calendar.name,
        description: calendar.description,
        type: calendar.type,
        color: calendar.color,
        slotDurationMinutes: calendar.slotDurationMinutes,
        slots: calendar.slots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timezone: slot.timezone,
          maxBookings: slot.maxBookings,
          isRecurring: slot.isRecurring,
          specificDate: slot.specificDate?.toISOString() || null,
        })),
      },
    }
  } catch (error) {
    console.error('Error fetching public calendar:', error)
    return { error: 'Failed to fetch calendar' }
  }
}

export async function getAvailableDatesForMonth(calendarId: string, year: number, month: number) {
  console.log('[getAvailableDatesForMonth] Called with:', { calendarId, year, month })

  try {
    const calendar = await prisma.adminCalendar.findUnique({
      where: { id: calendarId },
      include: {
        slots: {
          where: { isActive: true },
        },
      },
    })

    console.log('[getAvailableDatesForMonth] Calendar found:', !!calendar, 'Slots:', calendar?.slots?.length)

    if (!calendar || !calendar.isPublicBookable) {
      console.log('[getAvailableDatesForMonth] Calendar not found or not public')
      return { error: 'Calendar not found' }
    }

    // Get the first and last day of the month
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all existing bookings for this month
    const existingBookings = await prisma.calendarBooking.findMany({
      where: {
        calendarId,
        bookingDate: {
          gte: firstDay,
          lte: lastDay,
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: {
        slotId: true,
        bookingDate: true,
      },
    })

    // Group bookings by date and slot - use local date string for consistency
    const bookingsByDateSlot = new Map<string, number>()
    existingBookings.forEach((b) => {
      // Use local date formatting to be consistent with the loop below
      const dateStr = `${b.bookingDate.getFullYear()}-${String(b.bookingDate.getMonth() + 1).padStart(2, '0')}-${String(b.bookingDate.getDate()).padStart(2, '0')}`
      const key = `${dateStr}-${b.slotId}`
      bookingsByDateSlot.set(key, (bookingsByDateSlot.get(key) || 0) + 1)
    })

    // Calculate available dates
    const availableDates: string[] = []

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      // Skip dates in the past
      if (d < today) continue

      const dayOfWeek = d.getDay()
      // Use local date formatting to be consistent with how we store dates
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      // Check if any slot for this day of week has availability
      const slotsForDay = calendar.slots.filter((s) => s.dayOfWeek === dayOfWeek)

      for (const slot of slotsForDay) {
        const key = `${dateStr}-${slot.id}`
        const currentBookings = bookingsByDateSlot.get(key) || 0
        if (currentBookings < slot.maxBookings) {
          availableDates.push(dateStr)
          break // At least one slot is available, so this date is available
        }
      }
    }

    console.log('[getAvailableDatesForMonth] Found available dates:', availableDates.length, availableDates.slice(0, 5))
    return { availableDates }
  } catch (error) {
    console.error('Error fetching available dates:', error)
    return { error: 'Failed to fetch available dates' }
  }
}

export async function getAvailableSlots(calendarId: string, date: string) {
  try {
    const targetDate = new Date(date)
    const dayOfWeek = targetDate.getDay()

    const calendar = await prisma.adminCalendar.findUnique({
      where: { id: calendarId },
      include: {
        slots: {
          where: {
            isActive: true,
            OR: [
              { isRecurring: true, dayOfWeek },
              { isRecurring: false, specificDate: targetDate },
            ],
          },
        },
      },
    })

    if (!calendar) {
      return { error: 'Calendar not found' }
    }

    // Get existing bookings for this date
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    const existingBookings = await prisma.calendarBooking.findMany({
      where: {
        calendarId,
        bookingDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    })

    // Calculate available slots
    const availableSlots = calendar.slots.map((slot) => {
      const slotBookings = existingBookings.filter((b) => b.slotId === slot.id)
      const remainingCapacity = slot.maxBookings - slotBookings.length

      return {
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        timezone: slot.timezone,
        available: remainingCapacity > 0,
        remainingCapacity,
      }
    })

    return { slots: availableSlots, date }
  } catch (error) {
    console.error('Error fetching available slots:', error)
    return { error: 'Failed to fetch available slots' }
  }
}

export async function createPublicBooking(data: {
  calendarId: string
  slotId: string
  date: string
  bookerName: string
  bookerEmail: string
  bookerPhone?: string
  prospectId?: string
  notes?: string
}) {
  try {
    // Get the slot details
    const slot = await prisma.calendarSlot.findUnique({
      where: { id: data.slotId },
      include: { calendar: true },
    })

    if (!slot || slot.calendarId !== data.calendarId) {
      return { error: 'Invalid slot' }
    }

    // Parse the time and create booking datetime
    const bookingDate = new Date(data.date)
    const [startHour, startMinute] = slot.startTime.split(':').map(Number)
    const [endHour, endMinute] = slot.endTime.split(':').map(Number)

    const startTime = new Date(bookingDate)
    startTime.setHours(startHour, startMinute, 0, 0)

    const endTime = new Date(bookingDate)
    endTime.setHours(endHour, endMinute, 0, 0)

    // Check availability
    const existingBookings = await prisma.calendarBooking.count({
      where: {
        slotId: data.slotId,
        bookingDate,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    })

    if (existingBookings >= slot.maxBookings) {
      return { error: 'This slot is no longer available' }
    }

    // Create booking
    const booking = await prisma.calendarBooking.create({
      data: {
        calendarId: data.calendarId,
        slotId: data.slotId,
        bookingDate,
        startTime,
        endTime,
        timezone: slot.timezone,
        bookerName: data.bookerName,
        bookerEmail: data.bookerEmail,
        bookerPhone: data.bookerPhone,
        prospectId: data.prospectId,
        notes: data.notes,
        status: slot.calendar.requiresApproval ? 'PENDING' : 'CONFIRMED',
        confirmedAt: slot.calendar.requiresApproval ? null : new Date(),
      },
    })

    // If this is a prospect booking orientation, update prospect status
    if (data.prospectId) {
      await prisma.prospect.update({
        where: { id: data.prospectId },
        data: {
          orientationScheduledAt: startTime,
          status: 'ORIENTATION_SCHEDULED',
        },
      })

      // Add status history
      await prisma.prospectStatusHistory.create({
        data: {
          prospectId: data.prospectId,
          fromStatus: 'ASSESSMENT_COMPLETED',
          toStatus: 'ORIENTATION_SCHEDULED',
          notes: `Orientation scheduled for ${startTime.toISOString()}`,
        },
      })

      // Create admin notification
      await prisma.adminNotification.create({
        data: {
          userId: slot.calendar.createdBy,
          type: 'PROSPECT_STATUS_CHANGED',
          title: 'New Orientation Booking',
          message: `${data.bookerName} has scheduled an orientation for ${startTime.toLocaleDateString()}`,
          entityType: 'Prospect',
          entityId: data.prospectId,
          actionUrl: `/admin/prospects/${data.prospectId}`,
        },
      })
    }

    return {
      booking: {
        id: booking.id,
        status: booking.status,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error creating booking:', error)
    return { error: 'Failed to create booking' }
  }
}

// ============================================
// GET CALENDAR EVENTS (Admin)
// ============================================

export async function getAdminCalendarEvents(calendarId: string, dateRange?: { start: string; end: string }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const where: Record<string, unknown> = { adminCalendarId: calendarId }

    if (dateRange) {
      where.startTime = {
        gte: new Date(dateRange.start),
        lte: new Date(dateRange.end),
      }
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { startTime: 'asc' },
    })

    return {
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime.toISOString(),
        isAllDay: e.isAllDay,
        location: e.location,
        isOnline: e.isOnline,
        meetingLink: e.meetingLink,
        createdAt: e.createdAt.toISOString(),
      })),
    }
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return { error: 'Failed to fetch events' }
  }
}

// ============================================
// GET CALENDARS FOR USERS (Coach/Ambassador view)
// ============================================

export async function getCalendarsForUser() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const role = session.user.role

    // Build visibility filter based on role
    const visibilityFilter: CalendarVisibility[] = ['GLOBAL']
    if (role === 'COACH') {
      visibilityFilter.push('COACHES_ONLY')
    } else if (role === 'AMBASSADOR') {
      visibilityFilter.push('AMBASSADORS_ONLY')
    }

    const calendars = await prisma.adminCalendar.findMany({
      where: {
        isActive: true,
        OR: [
          { visibility: { in: visibilityFilter } },
          {
            visibility: 'CUSTOM',
            access: {
              some: {
                userId: session.user.id,
                canView: true,
              },
            },
          },
        ],
      },
      include: {
        events: {
          where: {
            startTime: {
              gte: new Date(),
            },
          },
          orderBy: { startTime: 'asc' },
          take: 10,
        },
      },
      orderBy: { name: 'asc' },
    })

    return {
      calendars: calendars.map((cal) => ({
        id: cal.id,
        name: cal.name,
        description: cal.description,
        type: cal.type,
        color: cal.color,
        upcomingEvents: cal.events.map((e) => ({
          id: e.id,
          title: e.title,
          startTime: e.startTime.toISOString(),
          endTime: e.endTime.toISOString(),
          isAllDay: e.isAllDay,
          location: e.location,
        })),
      })),
    }
  } catch (error) {
    console.error('Error fetching calendars for user:', error)
    return { error: 'Failed to fetch calendars' }
  }
}

export async function getCalendarEventsForUser(calendarId: string, dateRange: { start: string; end: string }) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    // First verify user has access to this calendar
    const calendar = await prisma.adminCalendar.findFirst({
      where: {
        id: calendarId,
        isActive: true,
        OR: [
          { visibility: 'GLOBAL' },
          { visibility: session.user.role === 'COACH' ? 'COACHES_ONLY' : 'AMBASSADORS_ONLY' },
          {
            visibility: 'CUSTOM',
            access: {
              some: {
                userId: session.user.id,
                canView: true,
              },
            },
          },
        ],
      },
    })

    if (!calendar) {
      return { error: 'Calendar not found or access denied' }
    }

    const events = await prisma.calendarEvent.findMany({
      where: {
        adminCalendarId: calendarId,
        startTime: {
          gte: new Date(dateRange.start),
          lte: new Date(dateRange.end),
        },
      },
      orderBy: { startTime: 'asc' },
    })

    return {
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime.toISOString(),
        isAllDay: e.isAllDay,
        location: e.location,
        isOnline: e.isOnline,
        meetingLink: e.meetingLink,
      })),
    }
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return { error: 'Failed to fetch events' }
  }
}

// ============================================
// SETUP DEFAULT ORIENTATION CALENDAR
// ============================================

export async function getOrCreateOrientationCalendar() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Check if orientation calendar exists
    let calendar = await prisma.adminCalendar.findFirst({
      where: {
        publicSlug: 'orientation',
      },
    })

    if (!calendar) {
      // Create the orientation calendar
      calendar = await prisma.adminCalendar.create({
        data: {
          name: 'Coach Orientation',
          description: 'Schedule your orientation call to learn more about becoming a SOIA Coach.',
          type: 'BOOKING',
          visibility: 'PUBLIC',
          color: '#10B981', // Green
          slotDurationMinutes: 60,
          bufferMinutes: 0,
          maxBookingsPerSlot: 1,
          requiresApproval: false,
          isPublicBookable: true,
          publicSlug: 'orientation',
          createdBy: session.user.id,
        },
      })

      // Add default slots: Mondays and Thursdays at 7am PST
      await prisma.calendarSlot.createMany({
        data: [
          {
            calendarId: calendar.id,
            dayOfWeek: 1, // Monday
            startTime: '07:00',
            endTime: '08:00',
            timezone: 'America/Los_Angeles',
            maxBookings: 1,
            isRecurring: true,
          },
          {
            calendarId: calendar.id,
            dayOfWeek: 4, // Thursday
            startTime: '07:00',
            endTime: '08:00',
            timezone: 'America/Los_Angeles',
            maxBookings: 1,
            isRecurring: true,
          },
        ],
      })
    }

    revalidatePath('/admin/calendars')
    return {
      calendar: {
        id: calendar.id,
        name: calendar.name,
        publicSlug: calendar.publicSlug,
      },
    }
  } catch (error) {
    console.error('Error creating orientation calendar:', error)
    return { error: 'Failed to create orientation calendar' }
  }
}

// ============================================
// GET AVAILABLE ORIENTATION SLOTS FOR ADMIN
// ============================================

export async function getOrientationCalendarForAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const calendar = await prisma.adminCalendar.findFirst({
      where: { publicSlug: 'orientation' },
      include: {
        slots: {
          where: { isActive: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    })

    if (!calendar) {
      return { error: 'Orientation calendar not found. Please set it up first.' }
    }

    return {
      calendar: {
        id: calendar.id,
        name: calendar.name,
        meetingLink: calendar.meetingLink,
        slots: calendar.slots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timezone: slot.timezone,
          maxBookings: slot.maxBookings,
        })),
      },
    }
  } catch (error) {
    console.error('Error fetching orientation calendar:', error)
    return { error: 'Failed to fetch orientation calendar' }
  }
}

export async function getAvailableOrientationSlots(daysAhead: number = 30) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const calendar = await prisma.adminCalendar.findFirst({
      where: { publicSlug: 'orientation' },
      include: {
        slots: {
          where: { isActive: true },
        },
      },
    })

    if (!calendar) {
      return { error: 'Orientation calendar not found' }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + daysAhead)

    // Get existing bookings for this period
    const existingBookings = await prisma.calendarBooking.findMany({
      where: {
        calendarId: calendar.id,
        bookingDate: {
          gte: today,
          lte: endDate,
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: {
        slotId: true,
        bookingDate: true,
      },
    })

    // Group bookings by date and slot
    const bookingsByDateSlot = new Map<string, number>()
    existingBookings.forEach((b) => {
      const dateStr = `${b.bookingDate.getFullYear()}-${String(b.bookingDate.getMonth() + 1).padStart(2, '0')}-${String(b.bookingDate.getDate()).padStart(2, '0')}`
      const key = `${dateStr}-${b.slotId}`
      bookingsByDateSlot.set(key, (bookingsByDateSlot.get(key) || 0) + 1)
    })

    // Build list of available slots
    const availableSlots: {
      date: string
      dayOfWeek: number
      slotId: string
      startTime: string
      endTime: string
      timezone: string
    }[] = []

    for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay()
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const slotsForDay = calendar.slots.filter((s) => s.dayOfWeek === dayOfWeek)

      for (const slot of slotsForDay) {
        const key = `${dateStr}-${slot.id}`
        const currentBookings = bookingsByDateSlot.get(key) || 0
        if (currentBookings < slot.maxBookings) {
          availableSlots.push({
            date: dateStr,
            dayOfWeek,
            slotId: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            timezone: slot.timezone,
          })
        }
      }
    }

    return {
      slots: availableSlots,
      meetingLink: calendar.meetingLink,
    }
  } catch (error) {
    console.error('Error fetching available orientation slots:', error)
    return { error: 'Failed to fetch available slots' }
  }
}

export async function scheduleOrientationFromCalendar(
  prospectId: string,
  slotId: string,
  date: string
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Get the slot details
    const slot = await prisma.calendarSlot.findUnique({
      where: { id: slotId },
      include: { calendar: true },
    })

    if (!slot) {
      return { error: 'Slot not found' }
    }

    // Get prospect
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
    })

    if (!prospect) {
      return { error: 'Prospect not found' }
    }

    // Create booking datetime
    const bookingDate = new Date(date)
    const [startHour, startMinute] = slot.startTime.split(':').map(Number)
    const [endHour, endMinute] = slot.endTime.split(':').map(Number)

    const startTime = new Date(bookingDate)
    startTime.setHours(startHour, startMinute, 0, 0)

    const endTime = new Date(bookingDate)
    endTime.setHours(endHour, endMinute, 0, 0)

    // Check availability
    const existingBookings = await prisma.calendarBooking.count({
      where: {
        slotId,
        bookingDate,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    })

    if (existingBookings >= slot.maxBookings) {
      return { error: 'This slot is no longer available' }
    }

    // Create booking
    const booking = await prisma.calendarBooking.create({
      data: {
        calendarId: slot.calendarId,
        slotId,
        bookingDate,
        startTime,
        endTime,
        timezone: slot.timezone,
        bookerName: `${prospect.firstName} ${prospect.lastName}`,
        bookerEmail: prospect.email,
        bookerPhone: prospect.phone,
        prospectId,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedBy: session.user.id,
      },
    })

    // Update prospect status
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        orientationScheduledAt: startTime,
        status: 'ORIENTATION_SCHEDULED',
      },
    })

    // Add status history
    await prisma.prospectStatusHistory.create({
      data: {
        prospectId,
        fromStatus: prospect.status,
        toStatus: 'ORIENTATION_SCHEDULED',
        changedBy: session.user.id,
        notes: `Orientation scheduled for ${startTime.toLocaleString()}`,
      },
    })

    revalidatePath(`/admin/prospects/${prospectId}`)
    revalidatePath('/admin/prospects')

    return {
      booking: {
        id: booking.id,
        date: bookingDate.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      meetingLink: slot.calendar.meetingLink,
    }
  } catch (error) {
    console.error('Error scheduling orientation:', error)
    return { error: 'Failed to schedule orientation' }
  }
}

export async function updateCalendarMeetingLink(calendarId: string, meetingLink: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.adminCalendar.update({
      where: { id: calendarId },
      data: { meetingLink },
    })

    revalidatePath(`/admin/calendars/${calendarId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating meeting link:', error)
    return { error: 'Failed to update meeting link' }
  }
}
