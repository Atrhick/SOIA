'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Video,
  Trash2,
  X,
  Loader2,
  CalendarDays,
  List,
  Grid3X3,
  Settings,
  Check,
  XCircle,
  User,
  Mail,
  Phone,
} from 'lucide-react'
import {
  addCalendarSlot,
  deleteCalendarSlot,
  addCalendarEvent,
  deleteCalendarEvent,
  updateBookingStatus,
  updateCalendarMeetingLink,
} from '@/lib/actions/admin-calendars'
import { CalendarType, BookingStatus } from '@prisma/client'

interface CalendarSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  timezone: string
  maxBookings: number
  isRecurring: boolean
  specificDate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CalendarData {
  id: string
  name: string
  description: string | null
  type: CalendarType
  visibility: string
  color: string
  slotDurationMinutes: number | null
  isPublicBookable: boolean
  publicSlug: string | null
  meetingLink: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  slots: CalendarSlot[]
  _count: {
    bookings: number
    events: number
  }
}

interface BookingData {
  id: string
  bookingDate: string
  startTime: string
  endTime: string
  bookerName: string
  bookerEmail: string
  bookerPhone: string | null
  status: BookingStatus
  notes: string | null
  prospect: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
  } | null
}

interface EventData {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  isAllDay: boolean
  location: string | null
  isOnline: boolean
  meetingLink: string | null
  createdAt: string
}

interface Props {
  calendar: CalendarData
  bookings: BookingData[]
  events: EventData[]
}

type ViewMode = 'month' | 'week' | 'day' | 'list'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const statusColors: Record<BookingStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  NO_SHOW: 'bg-gray-100 text-gray-800',
}

export function CalendarDetailClient({ calendar, bookings: initialBookings, events: initialEvents }: Props) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [bookings, setBookings] = useState(initialBookings)
  const [events, setEvents] = useState(initialEvents)
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null)

  // Modals
  const [showAddSlotModal, setShowAddSlotModal] = useState(false)
  const [showAddEventModal, setShowAddEventModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Slot form
  const [newSlot, setNewSlot] = useState({
    dayOfWeek: 1,
    startTime: '07:00',
    endTime: '08:00',
    maxBookings: 1,
  })

  // Event form
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '09:00',
    endTime: '10:00',
    location: '',
    isOnline: false,
    meetingLink: '',
  })

  // Meeting link state
  const [calendarMeetingLink, setCalendarMeetingLink] = useState(calendar.meetingLink || '')
  const [isSavingMeetingLink, setIsSavingMeetingLink] = useState(false)
  const [meetingLinkSaved, setMeetingLinkSaved] = useState(false)

  const handleSaveMeetingLink = async () => {
    setIsSavingMeetingLink(true)
    const result = await updateCalendarMeetingLink(calendar.id, calendarMeetingLink)
    if (!result.error) {
      setMeetingLinkSaved(true)
      setTimeout(() => setMeetingLinkSaved(false), 2000)
    }
    setIsSavingMeetingLink(false)
  }

  // Calendar calculations
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()
    const days: Date[] = []

    // Add days from previous month
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i))
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }

    // Add days from next month to complete grid
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i))
    }

    return days
  }, [currentDate])

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1))
  }

  const navigateWeek = (direction: number) => {
    setCurrentDate(new Date(currentDate.getTime() + direction * 7 * 24 * 60 * 60 * 1000))
  }

  const navigateDay = (direction: number) => {
    setCurrentDate(new Date(currentDate.getTime() + direction * 24 * 60 * 60 * 1000))
  }

  const getBookingsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return bookings.filter((b) => b.bookingDate.split('T')[0] === dateStr)
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return events.filter((e) => e.startTime.split('T')[0] === dateStr)
  }

  const getSlotsForDay = (dayOfWeek: number) => {
    return calendar.slots.filter((s) => s.dayOfWeek === dayOfWeek && s.isActive)
  }

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const result = await addCalendarSlot({
      calendarId: calendar.id,
      dayOfWeek: newSlot.dayOfWeek,
      startTime: newSlot.startTime,
      endTime: newSlot.endTime,
      maxBookings: newSlot.maxBookings,
    })

    if ('error' in result && result.error) {
      alert(result.error)
      setIsSubmitting(false)
      return
    }

    setShowAddSlotModal(false)
    setIsSubmitting(false)
    router.refresh()
  }

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Delete this slot?')) return

    const result = await deleteCalendarSlot(slotId)
    if ('error' in result && result.error) {
      alert(result.error)
      return
    }
    router.refresh()
  }

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const startDateTime = new Date(`${newEvent.date}T${newEvent.startTime}`)
    const endDateTime = new Date(`${newEvent.date}T${newEvent.endTime}`)

    const result = await addCalendarEvent({
      calendarId: calendar.id,
      title: newEvent.title,
      description: newEvent.description || undefined,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      location: newEvent.location || undefined,
      isOnline: newEvent.isOnline,
      meetingLink: newEvent.meetingLink || undefined,
    })

    if ('error' in result && result.error) {
      alert(result.error)
      setIsSubmitting(false)
      return
    }

    setShowAddEventModal(false)
    setNewEvent({
      title: '',
      description: '',
      date: '',
      startTime: '09:00',
      endTime: '10:00',
      location: '',
      isOnline: false,
      meetingLink: '',
    })
    setIsSubmitting(false)
    router.refresh()
  }

  const handleUpdateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    const result = await updateBookingStatus(bookingId, status)
    if ('error' in result && result.error) {
      alert(result.error)
      return
    }

    setBookings(bookings.map((b) => (b.id === bookingId ? { ...b, status } : b)))
    setSelectedBooking(null)
  }

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':')
    const h = parseInt(hour)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minute} ${ampm}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/calendars">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${calendar.color}20` }}
            >
              <CalendarDays className="h-5 w-5" style={{ color: calendar.color }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{calendar.name}</h1>
              <p className="text-sm text-gray-500">
                {calendar.type === 'BOOKING' ? 'Booking Calendar' : 'Events Calendar'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {calendar.type === 'BOOKING' && (
            <button
              onClick={() => setShowAddSlotModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Clock className="h-4 w-4" />
              Add Slot
            </button>
          )}
          <button
            onClick={() => setShowAddEventModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Add Event
          </button>
        </div>
      </div>

      {/* View Controls & Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (viewMode === 'month') navigateMonth(-1)
                else if (viewMode === 'week') navigateWeek(-1)
                else navigateDay(-1)
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Today
            </button>
            <button
              onClick={() => {
                if (viewMode === 'month') navigateMonth(1)
                else if (viewMode === 'week') navigateWeek(1)
                else navigateDay(1)
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 ml-4">
              {currentDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
                ...(viewMode === 'day' && { day: 'numeric', weekday: 'long' }),
              })}
            </h2>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'day' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Views */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Month View */}
        {viewMode === 'month' && (
          <div>
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {DAYS.map((day) => (
                <div key={day} className="py-3 text-center text-sm font-medium text-gray-500 border-r last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {daysInMonth.map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                const isToday = date.toDateString() === new Date().toDateString()
                const dayBookings = getBookingsForDate(date)
                const dayEvents = getEventsForDate(date)
                const daySlots = getSlotsForDay(date.getDay())
                const totalItems = dayBookings.length + dayEvents.length

                return (
                  <div
                    key={index}
                    className={`min-h-[120px] p-2 border-r border-b last:border-r-0 ${
                      !isCurrentMonth ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div
                      className={`text-sm mb-1 ${
                        isToday
                          ? 'w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center'
                          : isCurrentMonth
                          ? 'text-gray-900'
                          : 'text-gray-400'
                      }`}
                    >
                      {date.getDate()}
                    </div>

                    {/* Show slots indicator */}
                    {calendar.type === 'BOOKING' && daySlots.length > 0 && (
                      <div className="text-xs text-gray-500 mb-1">
                        {daySlots.length} slot{daySlots.length !== 1 ? 's' : ''}
                      </div>
                    )}

                    {/* Show events and bookings */}
                    <div className="space-y-1">
                      {/* Events */}
                      {dayEvents.slice(0, 2).map((event) => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className="w-full text-left text-xs px-2 py-1 rounded truncate"
                          style={{ backgroundColor: `${calendar.color}20`, color: calendar.color }}
                        >
                          {formatTime(event.startTime.split('T')[1].slice(0, 5))} - {event.title}
                        </button>
                      ))}
                      {/* Bookings */}
                      {dayBookings.slice(0, Math.max(0, 3 - dayEvents.length)).map((booking) => (
                        <button
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`w-full text-left text-xs px-2 py-1 rounded truncate ${statusColors[booking.status]}`}
                        >
                          {formatTime(booking.startTime.split('T')[1].slice(0, 5))} - {booking.bookerName}
                        </button>
                      ))}
                      {totalItems > 3 && (
                        <div className="text-xs text-gray-500 px-2">
                          +{totalItems - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
          <div>
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {DAYS.map((day, index) => {
                const weekStart = new Date(currentDate)
                weekStart.setDate(currentDate.getDate() - currentDate.getDay() + index)
                const isToday = weekStart.toDateString() === new Date().toDateString()

                return (
                  <div
                    key={day}
                    className={`py-3 text-center border-r last:border-r-0 ${isToday ? 'bg-primary-50' : ''}`}
                  >
                    <div className="text-sm font-medium text-gray-500">{day}</div>
                    <div className={`text-lg ${isToday ? 'text-primary-600 font-bold' : 'text-gray-900'}`}>
                      {weekStart.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Time Grid */}
            <div className="grid grid-cols-7 min-h-[400px]">
              {DAYS.map((_, index) => {
                const weekStart = new Date(currentDate)
                weekStart.setDate(currentDate.getDate() - currentDate.getDay() + index)
                const dayBookings = getBookingsForDate(weekStart)
                const dayEvents = getEventsForDate(weekStart)
                const daySlots = getSlotsForDay(index)

                return (
                  <div key={index} className="border-r last:border-r-0 p-2">
                    {/* Slots */}
                    {calendar.type === 'BOOKING' && daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="mb-2 p-2 bg-gray-100 rounded text-xs"
                      >
                        <div className="font-medium">{formatTime(slot.startTime)}</div>
                        <div className="text-gray-500">Slot available</div>
                      </div>
                    ))}

                    {/* Events */}
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="w-full text-left mb-2 p-2 rounded text-xs"
                        style={{ backgroundColor: `${calendar.color}20`, color: calendar.color }}
                      >
                        <div className="font-medium">{formatTime(event.startTime.split('T')[1].slice(0, 5))}</div>
                        <div className="truncate">{event.title}</div>
                      </button>
                    ))}

                    {/* Bookings */}
                    {dayBookings.map((booking) => (
                      <button
                        key={booking.id}
                        onClick={() => setSelectedBooking(booking)}
                        className={`w-full text-left mb-2 p-2 rounded text-xs ${statusColors[booking.status]}`}
                      >
                        <div className="font-medium">{formatTime(booking.startTime.split('T')[1].slice(0, 5))}</div>
                        <div className="truncate">{booking.bookerName}</div>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Day View */}
        {viewMode === 'day' && (
          <div className="p-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Available Slots for this day */}
              {calendar.type === 'BOOKING' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Available Slots</h3>
                  <div className="space-y-2">
                    {getSlotsForDay(currentDate.getDay()).map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium">
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {slot.maxBookings} booking{slot.maxBookings !== 1 ? 's' : ''} max
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {getSlotsForDay(currentDate.getDay()).length === 0 && (
                      <p className="text-sm text-gray-500">No slots available on {FULL_DAYS[currentDate.getDay()]}s</p>
                    )}
                  </div>
                </div>
              )}

              {/* Events for this day */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Events</h3>
                <div className="space-y-2">
                  {getEventsForDate(currentDate).map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="w-full text-left p-4 rounded-lg"
                      style={{ backgroundColor: `${calendar.color}15` }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium" style={{ color: calendar.color }}>{event.title}</div>
                          <div className="text-sm text-gray-600">
                            {formatTime(event.startTime.split('T')[1].slice(0, 5))} -{' '}
                            {formatTime(event.endTime.split('T')[1].slice(0, 5))}
                          </div>
                          {event.location && (
                            <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" /> {event.location}
                            </div>
                          )}
                        </div>
                        {event.isOnline && <Video className="h-4 w-4 text-gray-500" />}
                      </div>
                    </button>
                  ))}
                  {getEventsForDate(currentDate).length === 0 && (
                    <p className="text-sm text-gray-500">No events for this day</p>
                  )}
                </div>
              </div>

              {/* Bookings for this day */}
              {calendar.type === 'BOOKING' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Bookings</h3>
                  <div className="space-y-2">
                    {getBookingsForDate(currentDate).map((booking) => (
                      <button
                        key={booking.id}
                        onClick={() => setSelectedBooking(booking)}
                        className={`w-full text-left p-4 rounded-lg ${statusColors[booking.status]}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{booking.bookerName}</div>
                            <div className="text-sm">
                              {formatTime(booking.startTime.split('T')[1].slice(0, 5))} -{' '}
                              {formatTime(booking.endTime.split('T')[1].slice(0, 5))}
                            </div>
                          </div>
                          <span className="text-sm font-medium">{booking.status}</span>
                        </div>
                      </button>
                    ))}
                    {getBookingsForDate(currentDate).length === 0 && (
                      <p className="text-sm text-gray-500">No bookings for this day</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="divide-y divide-gray-200">
            {events.length === 0 && bookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No events or bookings for this month
              </div>
            ) : (
              <>
                {/* Events */}
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="w-full text-left p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium" style={{ color: calendar.color }}>{event.title}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(event.startTime).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })}{' '}
                          at {formatTime(event.startTime.split('T')[1].slice(0, 5))}
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                        Event
                      </span>
                    </div>
                  </button>
                ))}
                {/* Bookings */}
                {bookings.map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => setSelectedBooking(booking)}
                    className="w-full text-left p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{booking.bookerName}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(booking.bookingDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })}{' '}
                          at {formatTime(booking.startTime.split('T')[1].slice(0, 5))}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[booking.status]}`}>
                        {booking.status}
                      </span>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Recurring Slots Summary (for Booking calendars) */}
      {calendar.type === 'BOOKING' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Recurring Slots</h3>
          <div className="grid grid-cols-7 gap-4">
            {DAYS.map((day, index) => {
              const daySlots = getSlotsForDay(index)
              return (
                <div key={day} className="text-center">
                  <div className="text-sm font-medium text-gray-700 mb-2">{day}</div>
                  {daySlots.length > 0 ? (
                    <div className="space-y-1">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="text-xs p-2 bg-green-100 text-green-800 rounded"
                        >
                          {formatTime(slot.startTime)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">No slots</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Meeting Link Configuration (for Booking calendars) */}
      {calendar.type === 'BOOKING' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Video className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Meeting Link</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Set a default meeting link (Zoom, Google Meet, etc.) that will be shared with prospects when they schedule an orientation.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={calendarMeetingLink}
              onChange={(e) => setCalendarMeetingLink(e.target.value)}
              placeholder="https://zoom.us/j/1234567890"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
            <button
              onClick={handleSaveMeetingLink}
              disabled={isSavingMeetingLink}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
            >
              {isSavingMeetingLink ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : meetingLinkSaved ? (
                <Check className="h-4 w-4" />
              ) : null}
              {meetingLinkSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {showAddSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddSlotModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Add Time Slot</h2>
              <button onClick={() => setShowAddSlotModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddSlot} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                <select
                  value={newSlot.dayOfWeek}
                  onChange={(e) => setNewSlot({ ...newSlot, dayOfWeek: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {FULL_DAYS.map((day, index) => (
                    <option key={day} value={index}>{day}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newSlot.startTime}
                    onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={newSlot.endTime}
                    onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Bookings</label>
                <input
                  type="number"
                  value={newSlot.maxBookings}
                  onChange={(e) => setNewSlot({ ...newSlot, maxBookings: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min={1}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSlotModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddEventModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Add Event</h2>
              <button onClick={() => setShowAddEventModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Optional"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isOnline"
                  checked={newEvent.isOnline}
                  onChange={(e) => setNewEvent({ ...newEvent, isOnline: e.target.checked })}
                  className="h-4 w-4 text-primary-600 rounded"
                />
                <label htmlFor="isOnline" className="text-sm text-gray-700">Online meeting</label>
              </div>

              {newEvent.isOnline && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                  <input
                    type="url"
                    value={newEvent.meetingLink}
                    onChange={(e) => setNewEvent({ ...newEvent, meetingLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedBooking(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Booking Details</h2>
              <button onClick={() => setSelectedBooking(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Booker Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="font-medium">{selectedBooking.bookerName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <a href={`mailto:${selectedBooking.bookerEmail}`} className="text-primary-600 hover:underline">
                    {selectedBooking.bookerEmail}
                  </a>
                </div>
                {selectedBooking.bookerPhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <span>{selectedBooking.bookerPhone}</span>
                  </div>
                )}
              </div>

              {/* Date/Time */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">Scheduled for</div>
                <div className="font-medium">
                  {new Date(selectedBooking.bookingDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-sm text-gray-600">
                  {formatTime(selectedBooking.startTime.split('T')[1].slice(0, 5))} -{' '}
                  {formatTime(selectedBooking.endTime.split('T')[1].slice(0, 5))}
                </div>
              </div>

              {/* Status */}
              <div>
                <div className="text-sm text-gray-500 mb-2">Status</div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[selectedBooking.status]}`}>
                  {selectedBooking.status}
                </span>
              </div>

              {/* Linked Prospect */}
              {selectedBooking.prospect && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600 mb-1">Linked Prospect</div>
                  <Link
                    href={`/admin/prospects/${selectedBooking.prospect.id}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {selectedBooking.prospect.firstName} {selectedBooking.prospect.lastName}
                  </Link>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                {selectedBooking.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'CONFIRMED')}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Check className="h-4 w-4" />
                      Confirm
                    </button>
                    <button
                      onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'CANCELLED')}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </button>
                  </>
                )}
                {selectedBooking.status === 'CONFIRMED' && (
                  <>
                    <button
                      onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'COMPLETED')}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Check className="h-4 w-4" />
                      Mark Completed
                    </button>
                    <button
                      onClick={() => handleUpdateBookingStatus(selectedBooking.id, 'NO_SHOW')}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      No Show
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedEvent(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Event Details</h2>
              <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Event Title */}
              <div>
                <h3 className="text-lg font-semibold" style={{ color: calendar.color }}>
                  {selectedEvent.title}
                </h3>
              </div>

              {/* Description */}
              {selectedEvent.description && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Description</div>
                  <p className="text-gray-700">{selectedEvent.description}</p>
                </div>
              )}

              {/* Date/Time */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">
                    {new Date(selectedEvent.startTime).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="text-sm text-gray-600 ml-6">
                  {formatTime(selectedEvent.startTime.split('T')[1].slice(0, 5))} -{' '}
                  {formatTime(selectedEvent.endTime.split('T')[1].slice(0, 5))}
                </div>
              </div>

              {/* Location */}
              {selectedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}

              {/* Online Meeting */}
              {selectedEvent.isOnline && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Video className="h-5 w-5" />
                    <span className="font-medium">Online Meeting</span>
                  </div>
                  {selectedEvent.meetingLink && (
                    <a
                      href={selectedEvent.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-2 text-blue-600 hover:underline truncate"
                    >
                      {selectedEvent.meetingLink}
                    </a>
                  )}
                </div>
              )}

              {/* Delete Action */}
              <div className="pt-4 border-t">
                <button
                  onClick={async () => {
                    if (!confirm('Delete this event?')) return
                    const result = await deleteCalendarEvent(selectedEvent.id)
                    if (result.error) {
                      alert(result.error)
                      return
                    }
                    setEvents(events.filter((e) => e.id !== selectedEvent.id))
                    setSelectedEvent(null)
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
