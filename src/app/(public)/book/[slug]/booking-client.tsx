'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Loader2,
  User,
  Mail,
  Phone,
} from 'lucide-react'
import { getAvailableSlots, createPublicBooking, getAvailableDatesForMonth } from '@/lib/actions/admin-calendars'

interface CalendarData {
  id: string
  name: string
  description: string | null
  type: string
  color: string
  slotDurationMinutes: number | null
  slots: {
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    timezone: string
    maxBookings: number
    isRecurring: boolean
    specificDate: string | null
  }[]
}

interface AvailableSlot {
  id: string
  startTime: string
  endTime: string
  timezone: string
  available: boolean
  remainingCapacity: number
}

interface ProspectData {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
}

interface BookingClientProps {
  calendar: CalendarData
  prospect?: ProspectData | null
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const TIMEZONE_LABELS: Record<string, string> = {
  'America/Los_Angeles': 'PT',
  'America/Denver': 'MT',
  'America/Chicago': 'CT',
  'America/New_York': 'ET',
  'America/Anchorage': 'AKT',
  'Pacific/Honolulu': 'HT',
  'America/Phoenix': 'MST',
  'UTC': 'UTC',
}

// Helper to get hour/minute from formatToParts
function getTimeFromParts(parts: Intl.DateTimeFormatPart[]): { hours: number; minutes: number } {
  const hourPart = parts.find(p => p.type === 'hour')
  const minutePart = parts.find(p => p.type === 'minute')

  let hours = parseInt(hourPart?.value || '0', 10)
  const minutes = parseInt(minutePart?.value || '0', 10)

  return { hours, minutes }
}

// Convert time from source timezone to target timezone
function convertTimeToTimezone(
  time: string,
  date: Date,
  fromTimezone: string,
  toTimezone: string
): { hours: number; minutes: number } {
  const [slotHours, slotMinutes] = time.split(':').map(Number)

  // Use a reference date at noon UTC to calculate timezone offsets
  const refDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0))

  // Create formatters for both timezones (24-hour format)
  const fromFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: fromTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const toFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: toTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  // Get the time in each timezone for the same instant
  const fromParts = fromFormatter.formatToParts(refDate)
  const toParts = toFormatter.formatToParts(refDate)

  const fromTime = getTimeFromParts(fromParts)
  const toTime = getTimeFromParts(toParts)

  // Calculate offset: how many minutes ahead is toTimezone compared to fromTimezone?
  let offsetMinutes = (toTime.hours * 60 + toTime.minutes) - (fromTime.hours * 60 + fromTime.minutes)

  // Handle day boundary wraparound
  if (offsetMinutes > 720) offsetMinutes -= 1440
  if (offsetMinutes < -720) offsetMinutes += 1440

  // Apply offset to slot time
  let resultMinutes = slotHours * 60 + slotMinutes + offsetMinutes

  // Handle day wraparound
  while (resultMinutes < 0) resultMinutes += 1440
  while (resultMinutes >= 1440) resultMinutes -= 1440

  return {
    hours: Math.floor(resultMinutes / 60),
    minutes: resultMinutes % 60,
  }
}

export function BookingClient({ calendar, prospect }: BookingClientProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isLoadingDates, setIsLoadingDates] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState('')
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())
  const [maxBookingDays, setMaxBookingDays] = useState<number | null>(null)
  const [maxBookingDate, setMaxBookingDate] = useState<Date | null>(null)

  // Store confirmed booking details for the success screen
  const [confirmedBooking, setConfirmedBooking] = useState<{
    date: Date
    startTime: string
    endTime: string
    timezone: string
  } | null>(null)

  // Detect user's browser timezone
  const [userTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

  // Form fields - pre-fill from prospect if available
  const [name, setName] = useState(prospect ? `${prospect.firstName} ${prospect.lastName}` : '')
  const [email, setEmail] = useState(prospect?.email || '')
  const [phone, setPhone] = useState(prospect?.phone || '')
  const [notes, setNotes] = useState('')

  // Fetch available dates for the current month
  const fetchAvailableDates = useCallback(async () => {
    console.log('[BookingClient] Fetching available dates for:', {
      calendarId: calendar.id,
      year: currentMonth.getFullYear(),
      month: currentMonth.getMonth()
    })
    setIsLoadingDates(true)
    try {
      const result = await getAvailableDatesForMonth(
        calendar.id,
        currentMonth.getFullYear(),
        currentMonth.getMonth()
      )
      console.log('[BookingClient] Result:', result)
      if (result.availableDates) {
        console.log('[BookingClient] Available dates:', result.availableDates)
        setAvailableDates(new Set(result.availableDates))
      } else if (result.error) {
        console.error('[BookingClient] Error:', result.error)
      }
      // Store booking window info
      if (result.maxBookingDays !== undefined) {
        setMaxBookingDays(result.maxBookingDays)
      }
      if (result.maxBookingDate) {
        setMaxBookingDate(new Date(result.maxBookingDate))
      }
    } catch (err) {
      console.error('[BookingClient] Failed to load available dates:', err)
    } finally {
      setIsLoadingDates(false)
    }
  }, [calendar.id, currentMonth])

  // Fetch available dates when month changes
  useEffect(() => {
    fetchAvailableDates()
  }, [fetchAvailableDates])

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  const calendarDays = generateCalendarDays()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isDateSelectable = (date: Date) => {
    // Check if this date has available slots
    // Use local date formatting to be consistent with the server
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return availableDates.has(dateStr)
  }

  const fetchAvailableSlots = useCallback(async (date: Date) => {
    setIsLoadingSlots(true)
    setAvailableSlots([])
    setSelectedSlot(null)

    try {
      // Use local date formatting to be consistent with the server
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const result = await getAvailableSlots(calendar.id, dateStr)

      if (result.error) {
        setError(result.error)
      } else if (result.slots) {
        setAvailableSlots(result.slots)
      }
    } catch {
      setError('Failed to load available times')
    } finally {
      setIsLoadingSlots(false)
    }
  }, [calendar.id])

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots(selectedDate)
    }
  }, [selectedDate, fetchAvailableSlots])

  // Server-Sent Events for real-time availability updates
  useEffect(() => {
    // Don't connect if booking is complete
    if (isComplete) return

    const eventSource = new EventSource(`/api/calendar/${calendar.id}/events`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // Refresh availability when a booking is created
        if (data.type === 'booking_created' || data.type === 'booking_updated') {
          fetchAvailableDates()
          if (selectedDate) {
            fetchAvailableSlots(selectedDate)
          }
        }
      } catch (error) {
        console.error('[SSE] Error parsing message:', error)
      }
    }

    return () => {
      eventSource.close()
    }
  }, [calendar.id, fetchAvailableDates, fetchAvailableSlots, selectedDate, isComplete])

  const handleDateClick = (date: Date | null) => {
    if (!date || !isDateSelectable(date)) return
    setSelectedDate(date)
    setError('')
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  // Check if we can navigate to next month (not beyond booking window)
  const canGoNextMonth = () => {
    if (!maxBookingDate) return true // No limit set
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    return nextMonth <= maxBookingDate
  }

  // Check if we can navigate to previous month (not before current month)
  const canGoPrevMonth = () => {
    const today = new Date()
    const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    return currentMonthStart > thisMonthStart
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate || !selectedSlot) return

    setIsSubmitting(true)
    setError('')

    try {
      // Use local date formatting to be consistent with the server
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
      const result = await createPublicBooking({
        calendarId: calendar.id,
        slotId: selectedSlot.id,
        date: dateStr,
        bookerName: name,
        bookerEmail: email,
        bookerPhone: phone || undefined,
        prospectId: prospect?.id,
        notes: notes || undefined,
      })

      if (result.error) {
        setError(result.error)
      } else {
        // Save booking details for success screen
        setConfirmedBooking({
          date: selectedDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          timezone: selectedSlot.timezone,
        })
        setIsComplete(true)
      }
    } catch {
      setError('Failed to complete booking. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Format time converted to user's timezone
  const formatTimeInUserTimezone = (time: string, slotTimezone: string) => {
    if (!selectedDate) return formatTime(time)

    const userTzLabel = TIMEZONE_LABELS[userTimezone] || userTimezone

    // If user is in the same timezone as the slot, just show the time
    if (slotTimezone === userTimezone) {
      return `${formatTime(time)} ${userTzLabel}`
    }

    // Convert to user's timezone
    const converted = convertTimeToTimezone(time, selectedDate, slotTimezone, userTimezone)
    const convertedTimeStr = `${String(converted.hours).padStart(2, '0')}:${String(converted.minutes).padStart(2, '0')}`

    return `${formatTime(convertedTimeStr)} ${userTzLabel}`
  }

  // Get the original slot time label
  const getOriginalTimeLabel = (time: string, slotTimezone: string) => {
    const slotTzLabel = TIMEZONE_LABELS[slotTimezone] || slotTimezone
    return `${formatTime(time)} ${slotTzLabel}`
  }

  // Helper to format time for success screen using confirmed booking data
  const formatConfirmedTime = (time: string, timezone: string) => {
    if (!confirmedBooking) return formatTime(time)

    const userTzLabel = TIMEZONE_LABELS[userTimezone] || userTimezone

    if (timezone === userTimezone) {
      return `${formatTime(time)} ${userTzLabel}`
    }

    // Convert to user's timezone
    const converted = convertTimeToTimezone(time, confirmedBooking.date, timezone, userTimezone)
    const convertedTimeStr = `${String(converted.hours).padStart(2, '0')}:${String(converted.minutes).padStart(2, '0')}`
    return `${formatTime(convertedTimeStr)} ${userTzLabel}`
  }

  // Success screen
  if (isComplete && confirmedBooking) {
    const slotTzLabel = TIMEZONE_LABELS[confirmedBooking.timezone] || confirmedBooking.timezone

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Booking Confirmed!
          </h1>
          <p className="text-gray-600 mb-6">
            Your {calendar.name.toLowerCase()} has been scheduled.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="w-5 h-5 text-gray-500" />
              <span className="font-medium">
                {confirmedBooking.date.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              <div>
                <span className="font-medium">
                  {formatConfirmedTime(confirmedBooking.startTime, confirmedBooking.timezone)} - {formatConfirmedTime(confirmedBooking.endTime, confirmedBooking.timezone)}
                </span>
                {userTimezone !== confirmedBooking.timezone && (
                  <span className="block text-sm text-gray-500 mt-1">
                    ({formatTime(confirmedBooking.startTime)} - {formatTime(confirmedBooking.endTime)} {slotTzLabel})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <p className="text-primary-800 text-sm">
              You will receive a confirmation email at <strong>{email}</strong> with the meeting details.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{calendar.name}</h1>
        {calendar.description && (
          <p className="text-gray-600 max-w-2xl mx-auto">{calendar.description}</p>
        )}
        {prospect && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-sm">
            <User className="w-4 h-4" />
            <span>Booking for: <strong>{prospect.firstName} {prospect.lastName}</strong></span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calendar */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePrevMonth}
              disabled={!canGoPrevMonth()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <button
              onClick={handleNextMonth}
              disabled={!canGoNextMonth()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          {/* Booking window indicator */}
          {maxBookingDays && maxBookingDays > 0 && (
            <p className="text-xs text-gray-500 text-center mb-4">
              Book within the next {maxBookingDays} days
            </p>
          )}

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {isLoadingDates ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              <span className="ml-2 text-gray-500">Loading available dates...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="aspect-square" />
                }

                const isSelectable = isDateSelectable(date)
                const isSelected = selectedDate?.toDateString() === date.toDateString()
                const isToday = date.toDateString() === new Date().toDateString()
                const isPast = date < today

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateClick(date)}
                    disabled={!isSelectable}
                    className={`
                      aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                      ${isSelected
                        ? 'bg-primary-600 text-white'
                        : isSelectable
                          ? 'hover:bg-primary-50 text-gray-900 bg-green-50'
                          : isPast
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 cursor-not-allowed'
                      }
                      ${isToday && !isSelected ? 'ring-2 ring-primary-500 ring-offset-2' : ''}
                    `}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary-600"></div>
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-50 border border-green-200"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              <span>Unavailable</span>
            </div>
          </div>

          {/* No availability message */}
          {!isLoadingDates && availableDates.size === 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-sm">
                No available slots for this month. Please check the next month.
              </p>
            </div>
          )}
        </div>

        {/* Time slots and booking form */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {!selectedDate ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a date to see available times</p>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-gray-900 mb-4">
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </h3>

              {isLoadingSlots ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto" />
                  <p className="text-gray-500 mt-2">Loading available times...</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No available times for this date</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Time slot selection */}
                  <div>
                    <p className="text-sm text-gray-600 mb-3">
                      Select a time
                      {userTimezone !== (availableSlots[0]?.timezone || 'America/Los_Angeles') && (
                        <span className="text-gray-500"> (shown in your timezone: {TIMEZONE_LABELS[userTimezone] || userTimezone})</span>
                      )}:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {availableSlots.map(slot => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          disabled={!slot.available}
                          className={`
                            px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all
                            ${!slot.available
                              ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                              : selectedSlot?.id === slot.id
                                ? 'border-primary-600 bg-primary-50 text-primary-700'
                                : 'border-gray-200 hover:border-primary-300 text-gray-900'
                            }
                          `}
                        >
                          <span className="block">{formatTimeInUserTimezone(slot.startTime, slot.timezone)}</span>
                          {userTimezone !== slot.timezone && (
                            <span className="block text-xs text-gray-500 mt-0.5">
                              ({getOriginalTimeLabel(slot.startTime, slot.timezone)})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Booking form - shown when slot is selected */}
                  {selectedSlot && (
                    <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
                      <h4 className="font-medium text-gray-900">Your Information</h4>

                      {prospect && (
                        <div className="p-3 bg-primary-50 text-primary-700 text-sm rounded-lg mb-2">
                          Booking for: <strong>{name}</strong>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name {!prospect && '*'}
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => !prospect && setName(e.target.value)}
                            readOnly={!!prospect}
                            required
                            className={`w-full pl-10 pr-4 py-2 border rounded-lg ${
                              prospect
                                ? 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                                : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                            }`}
                            placeholder="John Doe"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address {!prospect && '*'}
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => !prospect && setEmail(e.target.value)}
                            readOnly={!!prospect}
                            required
                            className={`w-full pl-10 pr-4 py-2 border rounded-lg ${
                              prospect
                                ? 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                                : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                            }`}
                            placeholder="name@example.com"
                          />
                        </div>
                      </div>

                      {(prospect?.phone || !prospect) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => !prospect && setPhone(e.target.value)}
                              readOnly={!!prospect}
                              className={`w-full pl-10 pr-4 py-2 border rounded-lg ${
                                prospect
                                  ? 'border-gray-200 bg-gray-50 text-gray-700 cursor-not-allowed'
                                  : 'border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
                              }`}
                              placeholder="(555) 123-4567"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes (optional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Any questions or additional information..."
                        />
                      </div>

                      {error && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSubmitting || !name || !email}
                        className="w-full py-3 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Booking...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            Confirm Booking
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Timezone note */}
      <p className="text-center text-sm text-gray-500 mt-6">
        {userTimezone === (calendar.slots[0]?.timezone || 'America/Los_Angeles')
          ? `All times are shown in ${TIMEZONE_LABELS[userTimezone] || userTimezone}`
          : `Times are shown in your local timezone (${TIMEZONE_LABELS[userTimezone] || userTimezone})`
        }
      </p>
    </div>
  )
}
