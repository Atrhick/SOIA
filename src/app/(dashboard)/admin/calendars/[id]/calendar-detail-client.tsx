'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
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
  RefreshCw,
  Pencil,
} from 'lucide-react'
import {
  addCalendarSlot,
  deleteCalendarSlot,
  updateCalendarSlot,
  addCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  updateBookingStatus,
  updateCalendarMeetingLink,
  updateAdminCalendar,
  deleteRecurringEventSeries,
  updateRecurringEventSeries,
  getEventSeriesInfo,
  refreshCalendarData,
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
  maxBookingDays: number | null
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
  eventId: string | null
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
  timezone: string
  location: string | null
  isOnline: boolean
  meetingLink: string | null
  isRecurring: boolean
  seriesId: string | null
  createdAt: string
  booking: {
    id: string
    bookerName: string
    bookerEmail: string
    status: string
    prospectId: string | null
    prospectName: string | null
  } | null
}

interface Props {
  calendar: CalendarData
  bookings: BookingData[]
  events: EventData[]
  returnTo?: string
  returnLabel?: string
}

type ViewMode = 'month' | 'week' | 'day' | 'list'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
  { value: 'UTC', label: 'UTC' },
]

const statusColors: Record<BookingStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  NO_SHOW: 'bg-gray-100 text-gray-800',
}

export function CalendarDetailClient({ calendar, bookings: initialBookings, events: initialEvents, returnTo, returnLabel }: Props) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [bookings, setBookings] = useState(initialBookings)
  const [events, setEvents] = useState(initialEvents)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(new Date())
  const [isConnected, setIsConnected] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null)
  const [showDeleteRecurringModal, setShowDeleteRecurringModal] = useState(false)
  const [showEditRecurringModal, setShowEditRecurringModal] = useState(false)
  const [showEditEventModal, setShowEditEventModal] = useState(false)
  const [eventSeriesInfo, setEventSeriesInfo] = useState<{
    isRecurring: boolean
    seriesId?: string
    totalEvents?: number
    followingEvents?: number
  } | null>(null)
  const [editEventData, setEditEventData] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    timezone: 'America/Los_Angeles',
    location: '',
    isOnline: false,
    meetingLink: '',
  })

  // Modals
  const [showAddSlotModal, setShowAddSlotModal] = useState(false)
  const [showEditSlotModal, setShowEditSlotModal] = useState(false)
  const [showDeleteSlotModal, setShowDeleteSlotModal] = useState(false)
  const [slotToDelete, setSlotToDelete] = useState<{
    id: string
    startTime: string
    endTime: string
    hasMatchingSlots: boolean
  } | null>(null)
  const [deleteAllMatching, setDeleteAllMatching] = useState(false)
  const [showAddEventModal, setShowAddEventModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Slot form - supports multiple days
  const [newSlot, setNewSlot] = useState({
    selectedDays: [1] as number[], // Array of selected days (0=Sun, 1=Mon, etc.)
    startTime: '07:00',
    endTime: '08:00',
    maxBookings: 1,
    timezone: 'America/Los_Angeles',
    excludeWeekends: false,
  })

  // Edit slot form
  const [editSlot, setEditSlot] = useState<{
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    maxBookings: number
    timezone: string
  } | null>(null)

  // Event form - default to today's date (using local timezone)
  const getTodayString = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '09:00',
    endTime: '10:00',
    timezone: 'America/Los_Angeles',
    location: '',
    isOnline: false,
    meetingLink: '',
    // Recurrence options
    repeatType: 'none' as 'none' | 'daily' | 'weekly' | 'monthly' | 'custom',
    repeatDays: [] as number[], // For weekly: [0,1,2,3,4,5,6] (Sun-Sat)
    repeatEndType: 'never' as 'never' | 'on' | 'after',
    repeatEndDate: '',
    repeatOccurrences: 10,
    // Multi-day
    multipleDays: false,
    selectedDates: [] as string[],
    // Exclusions
    excludedDates: [] as string[],
    excludeWeekends: false,
    excludedDaysOfWeek: [] as number[], // [0,1,2,3,4,5,6] for Sun-Sat
  })
  const [showEventConfirmation, setShowEventConfirmation] = useState(false)

  const resetEventForm = () => {
    setNewEvent({
      title: '',
      description: '',
      date: '',
      startTime: '09:00',
      endTime: '10:00',
      timezone: 'America/Los_Angeles',
      location: '',
      isOnline: false,
      meetingLink: '',
      repeatType: 'none',
      repeatDays: [],
      repeatEndType: 'never',
      repeatEndDate: '',
      repeatOccurrences: 10,
      multipleDays: false,
      selectedDates: [],
      excludedDates: [],
      excludeWeekends: false,
      excludedDaysOfWeek: [],
    })
    setShowEventConfirmation(false)
  }

  // Today's date string for min date validation
  const todayStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  // Helper to advance end time by 1 hour from a given start time
  const getEndTimeOneHourLater = (startTime: string): string => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const endHours = Math.min(hours + 1, 23)
    return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  // Meeting link state
  const [calendarMeetingLink, setCalendarMeetingLink] = useState(calendar.meetingLink || '')
  const [isSavingMeetingLink, setIsSavingMeetingLink] = useState(false)
  const [meetingLinkSaved, setMeetingLinkSaved] = useState(false)

  // Booking window state
  const [maxBookingDays, setMaxBookingDays] = useState(calendar.maxBookingDays ?? 14)
  const [isSavingBookingWindow, setIsSavingBookingWindow] = useState(false)
  const [bookingWindowSaved, setBookingWindowSaved] = useState(false)

  // Real-time polling for calendar data
  const fetchLatestData = useCallback(async () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const result = await refreshCalendarData(calendar.id, {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString(),
    })

    if (!('error' in result)) {
      setBookings(result.bookings)
      setEvents(result.events)
      setLastRefreshed(new Date())
    }
  }, [calendar.id])

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await fetchLatestData()
    setIsRefreshing(false)
  }, [fetchLatestData])

  // Set up Server-Sent Events for real-time updates
  useEffect(() => {
    const eventSource = new EventSource(`/api/calendar/${calendar.id}/events`)

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Refresh data when any change occurs
        if (['booking_created', 'booking_updated', 'event_added', 'event_updated', 'event_deleted', 'slot_added', 'slot_deleted'].includes(data.type)) {
          fetchLatestData()
        }
      } catch {
        // Ignore malformed SSE messages
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
    }

    // Cleanup on unmount
    return () => {
      eventSource.close()
      setIsConnected(false)
    }
  }, [calendar.id, fetchLatestData])

  // Update data when currentDate changes (month navigation)
  useEffect(() => {
    const fetchDataForMonth = async () => {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const result = await refreshCalendarData(calendar.id, {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString(),
      })

      if (!('error' in result)) {
        setBookings(result.bookings)
        setEvents(result.events)
      }
    }

    fetchDataForMonth()
  }, [currentDate, calendar.id])

  const handleSaveMeetingLink = async () => {
    setIsSavingMeetingLink(true)
    const result = await updateCalendarMeetingLink(calendar.id, calendarMeetingLink)
    if (!result.error) {
      setMeetingLinkSaved(true)
      setTimeout(() => setMeetingLinkSaved(false), 2000)
    }
    setIsSavingMeetingLink(false)
  }

  const handleSaveBookingWindow = async () => {
    setIsSavingBookingWindow(true)
    const result = await updateAdminCalendar(calendar.id, {
      maxBookingDays: maxBookingDays || null,
    })
    if (!('error' in result)) {
      setBookingWindowSaved(true)
      setTimeout(() => setBookingWindowSaved(false), 2000)
    }
    setIsSavingBookingWindow(false)
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
    // Exclude bookings linked to events (those show on the event itself)
    return bookings.filter((b) => b.bookingDate.split('T')[0] === dateStr && !b.eventId)
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

    // Filter out weekends if excludeWeekends is checked
    let daysToCreate = [...newSlot.selectedDays]
    if (newSlot.excludeWeekends) {
      daysToCreate = daysToCreate.filter(day => day !== 0 && day !== 6) // Remove Sunday (0) and Saturday (6)
    }

    if (daysToCreate.length === 0) {
      alert('Please select at least one day (weekdays if excluding weekends)')
      return
    }

    setIsSubmitting(true)

    // Create slots for all selected days
    let hasError = false
    for (const dayOfWeek of daysToCreate) {
      const result = await addCalendarSlot({
        calendarId: calendar.id,
        dayOfWeek,
        startTime: newSlot.startTime,
        endTime: newSlot.endTime,
        maxBookings: newSlot.maxBookings,
        timezone: newSlot.timezone,
      })

      if ('error' in result && result.error) {
        alert(`Error creating slot for ${FULL_DAYS[dayOfWeek]}: ${result.error}`)
        hasError = true
        break
      }
    }

    if (!hasError) {
      setShowAddSlotModal(false)
      // Reset form
      setNewSlot({
        selectedDays: [1],
        startTime: '07:00',
        endTime: '08:00',
        maxBookings: 1,
        timezone: 'America/Los_Angeles',
        excludeWeekends: false,
      })
    }
    setIsSubmitting(false)
    // Instant refresh without page reload
    await fetchLatestData()
  }

  const handleDeleteSlotClick = (slot: CalendarSlot) => {
    // Check if there are other slots with the same start/end time
    const matchingSlots = calendar.slots.filter(
      s => s.startTime === slot.startTime && s.endTime === slot.endTime && s.id !== slot.id
    )

    setSlotToDelete({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      hasMatchingSlots: matchingSlots.length > 0,
    })
    setDeleteAllMatching(false)
    setShowDeleteSlotModal(true)
  }

  const confirmDeleteSlot = async () => {
    if (!slotToDelete) return

    setIsDeleting(true)

    if (deleteAllMatching && slotToDelete.hasMatchingSlots) {
      // Delete all slots with the same start/end time
      const slotsToDelete = calendar.slots.filter(
        s => s.startTime === slotToDelete.startTime && s.endTime === slotToDelete.endTime
      )

      for (const slot of slotsToDelete) {
        const result = await deleteCalendarSlot(slot.id)
        if ('error' in result && result.error) {
          alert(`Error deleting slot: ${result.error}`)
          setIsDeleting(false)
          return
        }
      }
    } else {
      // Delete only this slot
      const result = await deleteCalendarSlot(slotToDelete.id)
      if ('error' in result && result.error) {
        alert(result.error)
        setIsDeleting(false)
        return
      }
    }

    setShowDeleteSlotModal(false)
    setSlotToDelete(null)
    setDeleteAllMatching(false)
    setIsDeleting(false)
    // Instant refresh without page reload
    await fetchLatestData()
  }

  const handleDeleteFromEditModal = () => {
    if (!editSlot) return
    setShowEditSlotModal(false)

    // Check if there are other slots with the same start/end time
    const matchingSlots = calendar.slots.filter(
      s => s.startTime === editSlot.startTime && s.endTime === editSlot.endTime && s.id !== editSlot.id
    )

    setSlotToDelete({
      id: editSlot.id,
      startTime: editSlot.startTime,
      endTime: editSlot.endTime,
      hasMatchingSlots: matchingSlots.length > 0,
    })
    setDeleteAllMatching(false)
    setShowDeleteSlotModal(true)
    setEditSlot(null)
  }

  const handleEditSlotClick = (slot: CalendarSlot) => {
    setEditSlot({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxBookings: slot.maxBookings,
      timezone: slot.timezone,
    })
    setShowEditSlotModal(true)
  }

  const handleUpdateSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editSlot) return

    setIsSubmitting(true)
    const result = await updateCalendarSlot(editSlot.id, {
      dayOfWeek: editSlot.dayOfWeek,
      startTime: editSlot.startTime,
      endTime: editSlot.endTime,
      maxBookings: editSlot.maxBookings,
      timezone: editSlot.timezone,
    })

    if ('error' in result && result.error) {
      alert(result.error)
      setIsSubmitting(false)
      return
    }

    setShowEditSlotModal(false)
    setEditSlot(null)
    setIsSubmitting(false)
    // Instant refresh without page reload
    await fetchLatestData()
  }

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate start time is not in the past
    const eventStart = new Date(`${newEvent.date}T${newEvent.startTime}`)
    if (eventStart < new Date()) {
      alert('Cannot schedule events in the past. Please select a future date and time.')
      return
    }

    // Validate end time is after start time
    if (newEvent.endTime <= newEvent.startTime) {
      alert('End time must be after start time.')
      return
    }

    // Validate recurrence settings
    if (newEvent.repeatType === 'weekly' && newEvent.repeatDays.length === 0) {
      alert('Please select at least one day for weekly recurring events')
      return
    }

    if (newEvent.repeatType === 'custom' && newEvent.selectedDates.length === 0) {
      alert('Please add at least one additional date for custom recurring events, or select "Does not repeat" for a single event')
      return
    }

    if ((newEvent.repeatType === 'daily' || newEvent.repeatType === 'weekly' || newEvent.repeatType === 'monthly') &&
        newEvent.repeatEndType === 'on' && !newEvent.repeatEndDate) {
      alert('Please specify an end date or choose a different end option')
      return
    }

    // Validate exclusions don't conflict with recurrence pattern
    if (newEvent.repeatType === 'weekly') {
      const excludedDaysSet = new Set(newEvent.excludedDaysOfWeek)
      const hasValidDays = newEvent.repeatDays.some((day) => {
        if (newEvent.excludeWeekends && (day === 0 || day === 6)) return false
        if (excludedDaysSet.has(day)) return false
        return true
      })

      if (!hasValidDays) {
        alert('All selected days are excluded! Please either:\n• Select different days to repeat on, or\n• Remove some exclusions')
        return
      }
    }

    // Check if we'll actually create any events
    const previewDates = generateEventDates()
    if (previewDates.length === 0) {
      alert('No events will be created with the current settings. Please check your exclusions.')
      return
    }

    // Show confirmation modal instead of submitting directly
    setShowEventConfirmation(true)
  }

  // Generate dates based on recurrence settings
  const generateEventDates = (): string[] => {
    const dates: string[] = []
    const startDate = new Date(newEvent.date + 'T00:00:00')
    const excludedSet = new Set(newEvent.excludedDates.filter(Boolean))
    const excludedDaysSet = new Set(newEvent.excludedDaysOfWeek)

    // Helper function to check if a date should be excluded
    const shouldExcludeDate = (date: Date, dateStr: string): boolean => {
      const dayOfWeek = date.getDay()

      // Check specific date exclusions
      if (excludedSet.has(dateStr)) return true

      // Check weekend exclusion
      if (newEvent.excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) return true

      // Check day of week exclusions
      if (excludedDaysSet.has(dayOfWeek)) return true

      return false
    }

    if (newEvent.repeatType === 'none') {
      return [newEvent.date]
    }

    if (newEvent.repeatType === 'custom') {
      // Include start date plus all selected dates, excluding any excluded dates
      const allDates = [newEvent.date, ...newEvent.selectedDates].filter(Boolean)
      return Array.from(new Set(allDates))
        .filter((dateStr) => {
          const date = new Date(dateStr + 'T00:00:00')
          return !shouldExcludeDate(date, dateStr)
        })
        .sort()
    }

    // Validate weekly recurrence - check if there are any non-excluded days
    if (newEvent.repeatType === 'weekly') {
      const hasValidDays = newEvent.repeatDays.some((day) => {
        if (newEvent.excludeWeekends && (day === 0 || day === 6)) return false
        if (excludedDaysSet.has(day)) return false
        return true
      })
      if (!hasValidDays) {
        // All selected days are excluded - return empty array
        return []
      }
    }

    // For daily, weekly, monthly recurring
    let currentDate = new Date(startDate)
    const targetOccurrences = newEvent.repeatEndType === 'after' ? newEvent.repeatOccurrences : 365
    let occurrences = 0
    let iterations = 0
    const maxIterations = 3650 // Safety: max 10 years of iterations

    while (occurrences < targetOccurrences && iterations < maxIterations) {
      iterations++

      // Check end date
      if (newEvent.repeatEndType === 'on' && newEvent.repeatEndDate) {
        const endDate = new Date(newEvent.repeatEndDate + 'T23:59:59')
        if (currentDate > endDate) break
      }

      // Check if we should process this date based on recurrence pattern
      let shouldProcessDate = false

      if (newEvent.repeatType === 'daily') {
        shouldProcessDate = true
      } else if (newEvent.repeatType === 'weekly') {
        shouldProcessDate = newEvent.repeatDays.includes(currentDate.getDay())
      } else if (newEvent.repeatType === 'monthly') {
        shouldProcessDate = true
      }

      // If this date matches the pattern and is not excluded, add it
      if (shouldProcessDate) {
        const dateStr = currentDate.toISOString().split('T')[0]
        if (!shouldExcludeDate(currentDate, dateStr)) {
          dates.push(dateStr)
          occurrences++
        }
      }

      // Advance to next potential date
      if (newEvent.repeatType === 'daily' || newEvent.repeatType === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 1)
      } else if (newEvent.repeatType === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1)
      }

      // Safety check: if we've gone too far into the future, break
      if (newEvent.repeatEndType === 'never' && iterations > 1000) {
        break
      }
    }

    return dates
  }

  const handleConfirmAddEvent = async () => {
    setIsSubmitting(true)

    try {
      const datesToCreate = generateEventDates()
      const createdEvents: EventData[] = []

      // Generate a seriesId if this is a recurring event (multiple dates)
      const seriesId = datesToCreate.length > 1 ? `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : undefined

      // Create event for each date
      for (const date of datesToCreate) {
        const startDateTime = new Date(`${date}T${newEvent.startTime}`)
        const endDateTime = new Date(`${date}T${newEvent.endTime}`)

        const result = await addCalendarEvent({
          calendarId: calendar.id,
          title: newEvent.title,
          description: newEvent.description || undefined,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          timezone: newEvent.timezone,
          location: newEvent.location || undefined,
          isOnline: newEvent.isOnline,
          meetingLink: newEvent.meetingLink || undefined,
          seriesId,
        })

        if ('error' in result && result.error) {
          alert(`Error creating event for ${date}: ${result.error}`)
          continue
        }

        if ('event' in result && result.event) {
          const evt = result.event
          createdEvents.push({
            id: evt.id,
            title: evt.title,
            description: evt.description,
            startTime: typeof evt.startTime === 'string' ? evt.startTime : new Date(evt.startTime).toISOString(),
            endTime: typeof evt.endTime === 'string' ? evt.endTime : new Date(evt.endTime).toISOString(),
            isAllDay: evt.isAllDay,
            timezone: evt.timezone || 'America/Los_Angeles',
            location: evt.location,
            isOnline: evt.isOnline,
            meetingLink: evt.meetingLink,
            isRecurring: evt.isRecurring || false,
            seriesId: evt.seriesId || null,
            createdAt: typeof evt.createdAt === 'string' ? evt.createdAt : new Date(evt.createdAt).toISOString(),
            booking: null,
          })
        }
      }

      // Update local state with all created events
      setEvents([...events, ...createdEvents])

      setShowAddEventModal(false)
      resetEventForm()
      setIsSubmitting(false)
    } catch {
      alert('Failed to create events')
      setIsSubmitting(false)
    }
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

  const handleDeleteEventClick = async (event: EventData) => {
    if (event.isRecurring && event.seriesId) {
      // Fetch series info
      const info = await getEventSeriesInfo(event.id)
      if ('error' in info) {
        alert(info.error)
        return
      }
      setEventSeriesInfo(info)
      setShowDeleteRecurringModal(true)
    } else {
      // Simple delete confirmation for non-recurring events
      if (!confirm('Delete this event?')) return
      const result = await deleteCalendarEvent(event.id)
      if (result.error) {
        alert(result.error)
        return
      }
      setEvents(events.filter((e) => e.id !== event.id))
      setSelectedEvent(null)
    }
  }

  const handleDeleteRecurring = async (scope: 'this' | 'following' | 'all') => {
    if (!selectedEvent) return
    setIsSubmitting(true)

    const result = await deleteRecurringEventSeries(selectedEvent.id, scope)

    if (result.error) {
      alert(result.error)
      setIsSubmitting(false)
      return
    }

    // Instant refresh without page reload
    await fetchLatestData()

    setShowDeleteRecurringModal(false)
    setSelectedEvent(null)
    setIsSubmitting(false)
  }

  const handleEditEventClick = async (event: EventData) => {
    // Populate edit form with event data
    const eventDate = new Date(event.startTime)
    const startTime = eventDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    const endDate = new Date(event.endTime)
    const endTime = endDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    const dateStr = eventDate.toISOString().split('T')[0]

    setEditEventData({
      title: event.title,
      description: event.description || '',
      date: dateStr,
      startTime: startTime,
      endTime: endTime,
      timezone: event.timezone,
      location: event.location || '',
      isOnline: event.isOnline,
      meetingLink: event.meetingLink || '',
    })

    if (event.isRecurring && event.seriesId) {
      // Fetch series info
      const info = await getEventSeriesInfo(event.id)
      if ('error' in info) {
        alert(info.error)
        return
      }
      setEventSeriesInfo(info)
      setShowEditRecurringModal(true)
    } else {
      // For non-recurring events, go straight to edit modal
      setShowEditEventModal(true)
    }
  }

  const handleEditRecurringChoice = (scope: 'this' | 'following' | 'all') => {
    setShowEditRecurringModal(false)
    setShowEditEventModal(true)
    // Store the scope for use when submitting
    setEditEventData((prev) => ({ ...prev, editScope: scope } as any))
  }

  const handleUpdateEvent = async () => {
    if (!selectedEvent) return

    // Validate start time is not in the past
    const eventStart = new Date(`${editEventData.date}T${editEventData.startTime}`)
    if (eventStart < new Date()) {
      alert('Cannot schedule events in the past. Please select a future date and time.')
      return
    }

    // Validate end time is after start time
    if (editEventData.endTime <= editEventData.startTime) {
      alert('End time must be after start time.')
      return
    }

    setIsSubmitting(true)

    const startDateTime = new Date(`${editEventData.date}T${editEventData.startTime}`)
    const endDateTime = new Date(`${editEventData.date}T${editEventData.endTime}`)

    const updateData = {
      title: editEventData.title,
      description: editEventData.description || undefined,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      timezone: editEventData.timezone,
      location: editEventData.location || undefined,
      isOnline: editEventData.isOnline,
      meetingLink: editEventData.meetingLink || undefined,
    }

    let result

    if (selectedEvent.isRecurring && selectedEvent.seriesId) {
      // Update recurring event with scope
      const scope = (editEventData as any).editScope || 'this'
      result = await updateRecurringEventSeries(selectedEvent.id, scope, updateData)
    } else {
      // Update single event
      result = await updateCalendarEvent(selectedEvent.id, updateData)
    }

    if ('error' in result && result.error) {
      alert(result.error)
      setIsSubmitting(false)
      return
    }

    // Instant refresh without page reload
    await fetchLatestData()

    setShowEditEventModal(false)
    setSelectedEvent(null)
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-6">
      {/* Return to prospect banner */}
      {returnTo && (
        <Link
          href={returnTo}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 border border-primary-200 rounded-lg text-sm font-medium text-primary-700 hover:bg-primary-100 transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {returnLabel}
        </Link>
      )}

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
            <div className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}
                title={isConnected ? 'Live updates active' : 'Reconnecting...'}
              />
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title={`Last updated: ${lastRefreshed.toLocaleTimeString()}`}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
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
                          className={`w-full text-left text-xs px-2 py-1 rounded truncate ${event.booking ? 'ring-1 ring-green-400' : ''}`}
                          style={{ backgroundColor: event.booking ? '#dcfce720' : `${calendar.color}20`, color: event.booking ? '#166534' : calendar.color }}
                        >
                          {event.booking && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />}
                          {new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {event.booking ? event.booking.bookerName : event.title}
                        </button>
                      ))}
                      {/* Bookings */}
                      {dayBookings.slice(0, Math.max(0, 3 - dayEvents.length)).map((booking) => (
                        <button
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`w-full text-left text-xs px-2 py-1 rounded truncate ${statusColors[booking.status]}`}
                        >
                          {new Date(booking.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {booking.bookerName}
                        </button>
                      ))}
                      {totalItems > 3 && (
                        <button
                          onClick={() => {
                            setCurrentDate(new Date(date))
                            setViewMode('day')
                          }}
                          className="text-xs text-primary-600 hover:text-primary-800 px-2 font-medium hover:underline"
                        >
                          +{totalItems - 3} more
                        </button>
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
                      <button
                        key={slot.id}
                        onClick={() => handleEditSlotClick(slot)}
                        className="w-full text-left mb-2 p-2 bg-gray-100 hover:bg-gray-200 rounded text-xs transition-colors"
                      >
                        <div className="font-medium">{formatTime(slot.startTime)}</div>
                        <div className="text-gray-500">Click to edit</div>
                      </button>
                    ))}

                    {/* Events */}
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`w-full text-left mb-2 p-2 rounded text-xs ${event.booking ? 'ring-1 ring-green-300' : ''}`}
                        style={{ backgroundColor: event.booking ? '#dcfce720' : `${calendar.color}20`, color: event.booking ? '#166534' : calendar.color }}
                      >
                        <div className="font-medium">{new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                        <div className="truncate">{event.booking ? event.booking.bookerName : event.title}</div>
                        {event.booking && <div className="text-green-600 text-[10px] mt-0.5">Booked</div>}
                      </button>
                    ))}

                    {/* Bookings */}
                    {dayBookings.map((booking) => (
                      <button
                        key={booking.id}
                        onClick={() => setSelectedBooking(booking)}
                        className={`w-full text-left mb-2 p-2 rounded text-xs ${statusColors[booking.status]}`}
                      >
                        <div className="font-medium">{new Date(booking.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
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
                        <button
                          onClick={() => handleEditSlotClick(slot)}
                          className="flex-1 text-left hover:bg-gray-100 rounded -m-2 p-2 transition-colors"
                        >
                          <div className="font-medium">
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {slot.maxBookings} booking{slot.maxBookings !== 1 ? 's' : ''} max
                          </div>
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditSlotClick(slot)}
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded"
                            title="Edit slot"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSlotClick(slot)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded"
                            title="Delete slot"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
                      className={`w-full text-left p-4 rounded-lg ${event.booking ? 'ring-1 ring-green-300' : ''}`}
                      style={{ backgroundColor: event.booking ? '#f0fdf415' : `${calendar.color}15` }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium" style={{ color: event.booking ? '#166534' : calendar.color }}>{event.title}</div>
                          <div className="text-sm text-gray-600">
                            {new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} -{' '}
                            {new Date(event.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </div>
                          {event.location && (
                            <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" /> {event.location}
                            </div>
                          )}
                          {event.booking && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <Check className="h-3 w-3 mr-1" />
                                Booked
                              </span>
                              <span className="text-sm text-gray-600">{event.booking.bookerName}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {event.isOnline && <Video className="h-4 w-4 text-gray-500" />}
                        </div>
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
                              {new Date(booking.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} -{' '}
                              {new Date(booking.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
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
            {events.length === 0 && bookings.filter(b => !b.eventId).length === 0 ? (
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
                        <div className="font-medium" style={{ color: event.booking ? '#166534' : calendar.color }}>
                          {event.title}
                          {event.booking && <span className="text-sm font-normal text-gray-500 ml-2">- {event.booking.bookerName}</span>}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(event.startTime).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })}{' '}
                          at {new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </div>
                      </div>
                      {event.booking ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                          <Check className="h-3 w-3 mr-1" />
                          Booked
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                          Available
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {/* Bookings (only non-event bookings) */}
                {bookings.filter(b => !b.eventId).map((booking) => (
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
                          at {new Date(booking.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
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

      {/* Recurring Slots Summary (for Booking calendars) - only show if there are slots */}
      {calendar.type === 'BOOKING' && calendar.slots.length > 0 && (
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
                        <button
                          key={slot.id}
                          onClick={() => handleEditSlotClick(slot)}
                          className="w-full text-xs p-2 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors cursor-pointer"
                          title="Click to edit"
                        >
                          {formatTime(slot.startTime)}
                        </button>
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

      {/* Booking Window Configuration (for public booking calendars) */}
      {calendar.type === 'BOOKING' && calendar.isPublicBookable && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Booking Window</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Limit how far in advance prospects can book appointments. This helps maintain scheduling accuracy and keeps prospects engaged.
          </p>
          <div className="flex gap-2">
            <select
              value={maxBookingDays || 0}
              onChange={(e) => setMaxBookingDays(Number(e.target.value) || 0)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value={7}>7 days (1 week)</option>
              <option value={14}>14 days (2 weeks)</option>
              <option value={21}>21 days (3 weeks)</option>
              <option value={30}>30 days (1 month)</option>
              <option value={60}>60 days (2 months)</option>
              <option value={0}>Unlimited</option>
            </select>
            <button
              onClick={handleSaveBookingWindow}
              disabled={isSavingBookingWindow}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
            >
              {isSavingBookingWindow ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : bookingWindowSaved ? (
                <Check className="h-4 w-4" />
              ) : null}
              {bookingWindowSaved ? 'Saved' : 'Save'}
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
              {/* Day Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Days</label>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map((day, index) => {
                    const isSelected = newSlot.selectedDays.includes(index)
                    const isWeekend = index === 0 || index === 6
                    const isDisabled = newSlot.excludeWeekends && isWeekend
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isSelected) {
                            setNewSlot({
                              ...newSlot,
                              selectedDays: newSlot.selectedDays.filter(d => d !== index),
                            })
                          } else {
                            setNewSlot({
                              ...newSlot,
                              selectedDays: [...newSlot.selectedDays, index],
                            })
                          }
                        }}
                        className={`p-2 text-xs font-medium rounded transition-colors ${
                          isDisabled
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isSelected
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const weekdays = [1, 2, 3, 4, 5]
                      setNewSlot({ ...newSlot, selectedDays: weekdays, excludeWeekends: true })
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Select Weekdays
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewSlot({ ...newSlot, selectedDays: [0, 1, 2, 3, 4, 5, 6], excludeWeekends: false })
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setNewSlot({ ...newSlot, selectedDays: [] })}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Exclude Weekends Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="excludeWeekends"
                  checked={newSlot.excludeWeekends}
                  onChange={(e) => {
                    const exclude = e.target.checked
                    setNewSlot({
                      ...newSlot,
                      excludeWeekends: exclude,
                      // Remove weekends from selection if excluding
                      selectedDays: exclude
                        ? newSlot.selectedDays.filter(d => d !== 0 && d !== 6)
                        : newSlot.selectedDays,
                    })
                  }}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <label htmlFor="excludeWeekends" className="text-sm text-gray-700">
                  Exclude weekends (Saturday & Sunday)
                </label>
              </div>

              {/* Time Selection */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Bookings per Slot</label>
                <input
                  type="number"
                  value={newSlot.maxBookings}
                  onChange={(e) => setNewSlot({ ...newSlot, maxBookings: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min={1}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={newSlot.timezone}
                  onChange={(e) => setNewSlot({ ...newSlot, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              {/* Summary */}
              {newSlot.selectedDays.length > 0 && (
                <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <p className="text-sm text-primary-800">
                    <span className="font-medium">Creating {newSlot.excludeWeekends ? newSlot.selectedDays.filter(d => d !== 0 && d !== 6).length : newSlot.selectedDays.length} slot(s):</span>{' '}
                    {(newSlot.excludeWeekends ? newSlot.selectedDays.filter(d => d !== 0 && d !== 6) : newSlot.selectedDays)
                      .sort((a, b) => a - b)
                      .map(d => DAYS[d])
                      .join(', ')}{' '}
                    at {newSlot.startTime} - {newSlot.endTime}
                  </p>
                </div>
              )}

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

      {/* Edit Slot Modal */}
      {showEditSlotModal && editSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => {
            setShowEditSlotModal(false)
            setEditSlot(null)
          }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Edit Time Slot</h2>
              <button onClick={() => {
                setShowEditSlotModal(false)
                setEditSlot(null)
              }} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleUpdateSlot} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                <select
                  value={editSlot.dayOfWeek}
                  onChange={(e) => setEditSlot({ ...editSlot, dayOfWeek: Number(e.target.value) })}
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
                    value={editSlot.startTime}
                    onChange={(e) => setEditSlot({ ...editSlot, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={editSlot.endTime}
                    onChange={(e) => setEditSlot({ ...editSlot, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Bookings</label>
                <input
                  type="number"
                  value={editSlot.maxBookings}
                  onChange={(e) => setEditSlot({ ...editSlot, maxBookings: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min={1}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={editSlot.timezone}
                  onChange={(e) => setEditSlot({ ...editSlot, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleDeleteFromEditModal}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditSlotModal(false)
                    setEditSlot(null)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Slot Confirmation Modal */}
      {showDeleteSlotModal && slotToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => {
            if (!isDeleting) {
              setShowDeleteSlotModal(false)
              setSlotToDelete(null)
              setDeleteAllMatching(false)
            }
          }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">Delete Time Slot</h2>
            <p className="text-gray-600 text-center mb-4">
              Are you sure you want to delete this time slot ({formatTime(slotToDelete.startTime)} - {formatTime(slotToDelete.endTime)})?
            </p>

            {/* Show option to delete all matching slots if there are any */}
            {slotToDelete.hasMatchingSlots && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 mb-3">
                  This time slot exists on multiple days. What would you like to do?
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteOption"
                      checked={!deleteAllMatching}
                      onChange={() => setDeleteAllMatching(false)}
                      className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Delete only this occurrence</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteOption"
                      checked={deleteAllMatching}
                      onChange={() => setDeleteAllMatching(true)}
                      className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">
                      Delete all slots at {formatTime(slotToDelete.startTime)} - {formatTime(slotToDelete.endTime)}{' '}
                      <span className="text-red-600 font-medium">
                        ({calendar.slots.filter(s => s.startTime === slotToDelete.startTime && s.endTime === slotToDelete.endTime).length} slots)
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {!slotToDelete.hasMatchingSlots && (
              <p className="text-sm text-gray-500 text-center mb-6">
                This action cannot be undone.
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteSlotModal(false)
                  setSlotToDelete(null)
                  setDeleteAllMatching(false)
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSlot}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : deleteAllMatching ? (
                  'Delete All'
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => {
            setShowAddEventModal(false)
            resetEventForm()
          }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Add Event</h2>
              <button onClick={() => {
                setShowAddEventModal(false)
                resetEventForm()
              }} className="p-1 hover:bg-gray-100 rounded">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={newEvent.date}
                  min={todayStr}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              {/* Recurrence Options */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-start gap-2 mb-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <CalendarDays className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-indigo-900 mb-1">Schedule Options</div>
                    <p className="text-xs text-indigo-700">
                      Create a single event, schedule it across multiple specific dates, or set up recurring events (daily, weekly, or monthly).
                    </p>
                  </div>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Repeat</label>
                <select
                  value={newEvent.repeatType}
                  onChange={(e) => setNewEvent({ ...newEvent, repeatType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom (multiple specific dates)</option>
                </select>
              </div>

              {/* Weekly Day Selection */}
              {newEvent.repeatType === 'weekly' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-blue-900 mb-3">Repeat on</label>
                  <div className="grid grid-cols-7 gap-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                      const isSelected = newEvent.repeatDays.includes(index)
                      const isExcluded = newEvent.excludedDaysOfWeek.includes(index) ||
                        (newEvent.excludeWeekends && (index === 0 || index === 6))

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            const days = isSelected
                              ? newEvent.repeatDays.filter((d) => d !== index)
                              : [...newEvent.repeatDays, index].sort()
                            setNewEvent({ ...newEvent, repeatDays: days })
                          }}
                          className={`h-10 w-10 rounded-full text-sm font-medium transition-colors relative ${
                            isSelected
                              ? isExcluded
                                ? 'bg-red-600 text-white'
                                : 'bg-primary-600 text-white'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {day}
                          {isSelected && isExcluded && (
                            <span className="absolute -top-1 -right-1 h-3 w-3 bg-orange-500 rounded-full border border-white" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    {newEvent.repeatDays.length === 0
                      ? 'Select at least one day'
                      : `Repeats on ${newEvent.repeatDays
                          .map((d) => DAYS[d])
                          .join(', ')}`}
                  </p>
                  {(() => {
                    const excludedDaysSet = new Set(newEvent.excludedDaysOfWeek)
                    const conflictingDays = newEvent.repeatDays.filter((day) => {
                      if (newEvent.excludeWeekends && (day === 0 || day === 6)) return true
                      if (excludedDaysSet.has(day)) return true
                      return false
                    })
                    const hasValidDays = newEvent.repeatDays.some((day) => {
                      if (newEvent.excludeWeekends && (day === 0 || day === 6)) return false
                      if (excludedDaysSet.has(day)) return false
                      return true
                    })

                    if (conflictingDays.length > 0) {
                      return (
                        <div className={`mt-2 p-2 rounded text-xs ${
                          hasValidDays ? 'bg-yellow-50 text-yellow-800' : 'bg-red-50 text-red-800'
                        }`}>
                          {hasValidDays ? (
                            <>⚠️ {conflictingDays.map(d => DAYS[d]).join(', ')} will be skipped due to exclusions</>
                          ) : (
                            <>❌ All selected days are excluded - no events will be created!</>
                          )}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}

              {/* Custom Multiple Dates */}
              {newEvent.repeatType === 'custom' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-purple-900 mb-2">Additional Dates</label>
                  <p className="text-xs text-purple-600 mb-3">
                    Select multiple specific dates for this event (includes start date)
                  </p>
                  <div className="space-y-2">
                    {newEvent.selectedDates.map((date, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => {
                            const dates = [...newEvent.selectedDates]
                            dates[idx] = e.target.value
                            setNewEvent({ ...newEvent, selectedDates: dates })
                          }}
                          className="flex-1 px-3 py-2 border border-purple-300 rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const dates = newEvent.selectedDates.filter((_, i) => i !== idx)
                            setNewEvent({ ...newEvent, selectedDates: dates })
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, selectedDates: [...newEvent.selectedDates, ''] })}
                      className="w-full px-3 py-2 border border-dashed border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 text-sm font-medium"
                    >
                      + Add Date
                    </button>
                  </div>
                </div>
              )}

              {/* End Date Options for Recurring Events */}
              {(newEvent.repeatType === 'daily' || newEvent.repeatType === 'weekly' || newEvent.repeatType === 'monthly') && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-green-900 mb-3">Ends</label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="repeatEnd"
                        checked={newEvent.repeatEndType === 'never'}
                        onChange={() => setNewEvent({ ...newEvent, repeatEndType: 'never' })}
                        className="h-4 w-4 text-primary-600"
                      />
                      <span className="text-sm text-gray-700">Never</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="repeatEnd"
                        checked={newEvent.repeatEndType === 'on'}
                        onChange={() => setNewEvent({ ...newEvent, repeatEndType: 'on' })}
                        className="h-4 w-4 text-primary-600"
                      />
                      <span className="text-sm text-gray-700">On</span>
                      <input
                        type="date"
                        value={newEvent.repeatEndDate}
                        onChange={(e) => setNewEvent({ ...newEvent, repeatEndDate: e.target.value, repeatEndType: 'on' })}
                        disabled={newEvent.repeatEndType !== 'on'}
                        className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                      />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="repeatEnd"
                        checked={newEvent.repeatEndType === 'after'}
                        onChange={() => setNewEvent({ ...newEvent, repeatEndType: 'after' })}
                        className="h-4 w-4 text-primary-600"
                      />
                      <span className="text-sm text-gray-700">After</span>
                      <input
                        type="number"
                        value={newEvent.repeatOccurrences}
                        onChange={(e) => setNewEvent({ ...newEvent, repeatOccurrences: Number(e.target.value), repeatEndType: 'after' })}
                        disabled={newEvent.repeatEndType !== 'after'}
                        min={1}
                        max={365}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                      />
                      <span className="text-sm text-gray-700">occurrences</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Exclude Dates for Recurring Events */}
              {(newEvent.repeatType === 'daily' || newEvent.repeatType === 'weekly' || newEvent.repeatType === 'monthly') && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <label className="block text-sm font-medium text-orange-900">Exclusions (Optional)</label>
                      <p className="text-xs text-orange-700 mt-1">
                        Skip weekends, specific days, or individual dates
                      </p>
                    </div>
                  </div>

                  {/* Quick Toggle: Skip Weekends */}
                  <div className="mb-4 p-3 bg-white border border-orange-200 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newEvent.excludeWeekends}
                        onChange={(e) => setNewEvent({ ...newEvent, excludeWeekends: e.target.checked })}
                        className="h-4 w-4 text-orange-600 rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">Skip weekends</div>
                        <div className="text-xs text-gray-500">Exclude Saturdays and Sundays</div>
                      </div>
                    </label>
                  </div>

                  {/* Exclude Specific Days of Week */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-orange-900 mb-2">Skip specific days</label>
                    <div className="grid grid-cols-7 gap-2 bg-white p-3 rounded-lg border border-orange-200">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => {
                        const isWeekend = index === 0 || index === 6
                        const isExcluded = newEvent.excludedDaysOfWeek.includes(index)
                        const isWeekendExcluded = newEvent.excludeWeekends && isWeekend

                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              if (isWeekendExcluded) return // Can't toggle if weekend exclusion is on
                              const days = isExcluded
                                ? newEvent.excludedDaysOfWeek.filter((d) => d !== index)
                                : [...newEvent.excludedDaysOfWeek, index].sort()
                              setNewEvent({ ...newEvent, excludedDaysOfWeek: days })
                            }}
                            disabled={isWeekendExcluded}
                            className={`h-10 w-10 rounded-full text-sm font-medium transition-colors ${
                              isExcluded || isWeekendExcluded
                                ? 'bg-orange-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            } ${isWeekendExcluded ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                    {(newEvent.excludedDaysOfWeek.length > 0 || newEvent.excludeWeekends) && (
                      <p className="text-xs text-orange-700 mt-2">
                        Excluding: {(() => {
                          const excluded = [...newEvent.excludedDaysOfWeek]
                          if (newEvent.excludeWeekends) {
                            if (!excluded.includes(0)) excluded.push(0)
                            if (!excluded.includes(6)) excluded.push(6)
                          }
                          return Array.from(new Set(excluded))
                            .sort()
                            .map((d) => DAYS[d])
                            .join(', ')
                        })()}
                      </p>
                    )}
                  </div>

                  {/* Exclude Specific Dates */}
                  <div>
                    <label className="block text-sm font-medium text-orange-900 mb-2">Skip specific dates</label>
                    {newEvent.excludedDates.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {newEvent.excludedDates.map((date, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-white rounded border border-orange-200 p-2">
                            <input
                              type="date"
                              value={date}
                              onChange={(e) => {
                                const dates = [...newEvent.excludedDates]
                                dates[idx] = e.target.value
                                setNewEvent({ ...newEvent, excludedDates: dates })
                              }}
                              className="flex-1 px-2 py-1 border border-orange-300 rounded text-sm"
                            />
                            <span className="text-xs text-gray-500">
                              {date && new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const dates = newEvent.excludedDates.filter((_, i) => i !== idx)
                                setNewEvent({ ...newEvent, excludedDates: dates })
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, excludedDates: [...newEvent.excludedDates, ''] })}
                      className="w-full px-3 py-2 border border-dashed border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 text-sm font-medium"
                    >
                      + Add Date to Exclude
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => {
                      const newStart = e.target.value
                      const newEnd = getEndTimeOneHourLater(newStart)
                      setNewEvent({ ...newEvent, startTime: newStart, endTime: newEnd })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={newEvent.endTime}
                    min={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Zone</label>
                <select
                  value={newEvent.timezone}
                  onChange={(e) => setNewEvent({ ...newEvent, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
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
                  onClick={() => {
                    setShowAddEventModal(false)
                    resetEventForm()
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Confirmation Modal */}
      {showEventConfirmation && (() => {
        const datesToCreate = generateEventDates()
        const showingAll = datesToCreate.length <= 10

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => !isSubmitting && setShowEventConfirmation(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Confirm Event Details</h2>
                <button
                  onClick={() => !isSubmitting && setShowEventConfirmation(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                  disabled={isSubmitting}
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium">
                    {datesToCreate.length === 0 ? (
                      '⚠️ No events will be created - check your exclusion settings'
                    ) : datesToCreate.length === 1 ? (
                      'You are creating 1 event'
                    ) : (
                      `You are creating ${datesToCreate.length} events`
                    )}
                  </p>
                  {datesToCreate.length > 0 && newEvent.repeatEndType === 'after' &&
                   datesToCreate.length < newEvent.repeatOccurrences && (
                    <p className="text-xs text-blue-700 mt-1">
                      Note: Requested {newEvent.repeatOccurrences} events, but some were excluded
                    </p>
                  )}
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Event Title</div>
                  <div className="text-base font-semibold text-gray-900">{newEvent.title}</div>
                </div>

                {newEvent.description && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Description</div>
                    <div className="text-sm text-gray-700">{newEvent.description}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Time</div>
                    <div className="text-sm text-gray-900">
                      {formatTime(newEvent.startTime)} - {formatTime(newEvent.endTime)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Time Zone</div>
                    <div className="text-sm font-semibold text-primary-600">
                      {TIMEZONES.find((tz) => tz.value === newEvent.timezone)?.label}
                    </div>
                  </div>
                </div>

                {/* Exclusions Summary */}
                {(newEvent.excludeWeekends || newEvent.excludedDaysOfWeek.length > 0 || (newEvent.excludedDates.length > 0 && newEvent.excludedDates.some(d => d))) && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <X className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-orange-900 mb-1">Exclusions Applied</div>
                        <div className="space-y-1 text-xs text-orange-700">
                          {newEvent.excludeWeekends && (
                            <div>• Skipping weekends (Sat & Sun)</div>
                          )}
                          {newEvent.excludedDaysOfWeek.length > 0 && !newEvent.excludeWeekends && (
                            <div>
                              • Skipping: {newEvent.excludedDaysOfWeek.map(d => DAYS[d]).join(', ')}
                            </div>
                          )}
                          {newEvent.excludedDaysOfWeek.length > 0 && newEvent.excludeWeekends && (
                            <div>
                              • Also skipping: {newEvent.excludedDaysOfWeek.filter(d => d !== 0 && d !== 6).map(d => DAYS[d]).join(', ') || 'none'}
                            </div>
                          )}
                          {newEvent.excludedDates.filter(d => d).length > 0 && (
                            <div>
                              • Skipping {newEvent.excludedDates.filter(d => d).length} specific date{newEvent.excludedDates.filter(d => d).length !== 1 ? 's' : ''}: {' '}
                              {newEvent.excludedDates.filter(d => d).map(date =>
                                new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              ).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Date Preview */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-gray-700">
                      Event Dates ({datesToCreate.length})
                    </div>
                    {newEvent.repeatType !== 'none' && (
                      <div className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                        {newEvent.repeatType === 'daily' && 'Daily'}
                        {newEvent.repeatType === 'weekly' && 'Weekly'}
                        {newEvent.repeatType === 'monthly' && 'Monthly'}
                        {newEvent.repeatType === 'custom' && 'Custom Dates'}
                      </div>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-3 space-y-1">
                    {(showingAll ? datesToCreate : datesToCreate.slice(0, 10)).map((date, idx) => (
                      <div
                        key={idx}
                        className="text-sm text-gray-700 py-1 px-2 bg-white rounded border border-gray-200"
                      >
                        <span className="font-medium">
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-gray-500 ml-2">
                          • {formatTime(newEvent.startTime)} - {formatTime(newEvent.endTime)}
                        </span>
                      </div>
                    ))}
                    {!showingAll && (
                      <div className="text-sm text-gray-500 italic py-2 text-center">
                        ... and {datesToCreate.length - 10} more dates
                      </div>
                    )}
                  </div>
                </div>

                {newEvent.location && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Location</div>
                    <div className="text-sm text-gray-900">{newEvent.location}</div>
                  </div>
                )}

                {newEvent.isOnline && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Video className="h-4 w-4 text-green-600" />
                      <div className="text-sm font-medium text-green-900">Online Meeting</div>
                    </div>
                    {newEvent.meetingLink && (
                      <div className="text-sm text-green-700 truncate">{newEvent.meetingLink}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEventConfirmation(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Go Back
                </button>
                <button
                  onClick={handleConfirmAddEvent}
                  disabled={isSubmitting || datesToCreate.length === 0}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating {datesToCreate.length} event{datesToCreate.length !== 1 ? 's' : ''}...
                    </>
                  ) : datesToCreate.length === 0 ? (
                    'Cannot Create - No Valid Dates'
                  ) : (
                    <>
                      Confirm & Create {datesToCreate.length} Event{datesToCreate.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
                  {new Date(selectedBooking.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} -{' '}
                  {new Date(selectedBooking.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })}
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
                  {new Date(selectedEvent.startTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })} -{' '}
                  {new Date(selectedEvent.endTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </div>
                <div className="text-sm font-medium text-primary-600 ml-6 mt-1">
                  {TIMEZONES.find((tz) => tz.value === selectedEvent.timezone)?.label || selectedEvent.timezone}
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

              {/* Booking Status */}
              {selectedEvent.booking ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">Booked</span>
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{selectedEvent.booking.status}</span>
                  </div>
                  <div className="space-y-1 ml-7">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      {selectedEvent.booking.bookerName}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      {selectedEvent.booking.bookerEmail}
                    </div>
                    {selectedEvent.booking.prospectId && (
                      <Link
                        href={`/admin/prospects/${selectedEvent.booking.prospectId}`}
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-1"
                      >
                        View Prospect Profile
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    Available - Not yet booked
                  </div>
                </div>
              )}

              {/* Edit & Delete Actions */}
              <div className="pt-4 border-t space-y-3">
                {selectedEvent.isRecurring && selectedEvent.seriesId && (
                  <div className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                    <CalendarDays className="h-3 w-3" />
                    This is part of a recurring event series
                  </div>
                )}

                <button
                  onClick={() => handleEditEventClick(selectedEvent)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Settings className="h-4 w-4" />
                  Edit Event
                </button>

                {selectedEvent.isRecurring && selectedEvent.seriesId ? (
                  <button
                    onClick={() => handleDeleteEventClick(selectedEvent)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Event
                  </button>
                ) : (
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
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recurring Event Choice Modal */}
      {showEditRecurringModal && eventSeriesInfo && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowEditRecurringModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Edit Recurring Event</h2>
              <button
                onClick={() => setShowEditRecurringModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CalendarDays className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      &quot;{selectedEvent.title}&quot;
                    </p>
                    <p className="text-xs text-blue-700">
                      This event is part of a series with {eventSeriesInfo.totalEvents} total occurrences.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-700 mb-4">
                Which events would you like to edit?
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleEditRecurringChoice('this')}
                  className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">This event only</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Only edit this occurrence
                  </div>
                </button>

                <button
                  onClick={() => handleEditRecurringChoice('following')}
                  className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">This and following events</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Edit this and all future occurrences ({eventSeriesInfo.followingEvents} events)
                  </div>
                </button>

                <button
                  onClick={() => handleEditRecurringChoice('all')}
                  className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">All events in the series</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Edit all {eventSeriesInfo.totalEvents} events in this series
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditRecurringModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEditEventModal && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => !isSubmitting && setShowEditEventModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Edit Event</h2>
              <button
                onClick={() => !isSubmitting && setShowEditEventModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={isSubmitting}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {selectedEvent.isRecurring && selectedEvent.seriesId && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-purple-800">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      Editing {(editEventData as any).editScope === 'this' ? 'this event only' : (editEventData as any).editScope === 'following' ? `this and ${eventSeriesInfo?.followingEvents} following events` : `all ${eventSeriesInfo?.totalEvents} events in the series`}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
                <input
                  type="text"
                  value={editEventData.title}
                  onChange={(e) => setEditEventData({ ...editEventData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editEventData.description}
                  onChange={(e) => setEditEventData({ ...editEventData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={editEventData.date}
                  min={todayStr}
                  onChange={(e) => setEditEventData({ ...editEventData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={editEventData.startTime}
                    onChange={(e) => {
                      const newStart = e.target.value
                      const newEnd = getEndTimeOneHourLater(newStart)
                      setEditEventData({ ...editEventData, startTime: newStart, endTime: newEnd })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={editEventData.endTime}
                    min={editEventData.startTime}
                    onChange={(e) => setEditEventData({ ...editEventData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Zone</label>
                <select
                  value={editEventData.timezone}
                  onChange={(e) => setEditEventData({ ...editEventData, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={editEventData.location}
                  onChange={(e) => setEditEventData({ ...editEventData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Optional"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="editIsOnline"
                  checked={editEventData.isOnline}
                  onChange={(e) => setEditEventData({ ...editEventData, isOnline: e.target.checked })}
                  className="h-4 w-4 text-primary-600 rounded"
                />
                <label htmlFor="editIsOnline" className="text-sm text-gray-700">Online meeting</label>
              </div>

              {editEventData.isOnline && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                  <input
                    type="url"
                    value={editEventData.meetingLink}
                    onChange={(e) => setEditEventData({ ...editEventData, meetingLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditEventModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateEvent}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Recurring Event Modal */}
      {showDeleteRecurringModal && eventSeriesInfo && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => !isSubmitting && setShowDeleteRecurringModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Delete Recurring Event</h2>
              <button
                onClick={() => !isSubmitting && setShowDeleteRecurringModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={isSubmitting}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CalendarDays className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 mb-1">
                      &quot;{selectedEvent.title}&quot;
                    </p>
                    <p className="text-xs text-amber-700">
                      This event is part of a series with {eventSeriesInfo.totalEvents} total occurrences.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-700 mb-4">
                Which events would you like to delete?
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleDeleteRecurring('this')}
                  disabled={isSubmitting}
                  className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-gray-900">This event only</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Only delete this occurrence
                  </div>
                </button>

                <button
                  onClick={() => handleDeleteRecurring('following')}
                  disabled={isSubmitting}
                  className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-gray-900">This and following events</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Delete this and all future occurrences ({eventSeriesInfo.followingEvents} events)
                  </div>
                </button>

                <button
                  onClick={() => handleDeleteRecurring('all')}
                  disabled={isSubmitting}
                  className="w-full text-left p-4 border-2 border-red-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-red-900">All events in the series</div>
                  <div className="text-sm text-red-600 mt-1">
                    Delete all {eventSeriesInfo.totalEvents} events in this series
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteRecurringModal(false)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
