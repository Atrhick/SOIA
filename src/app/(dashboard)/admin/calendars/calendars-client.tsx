'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  Plus,
  Settings,
  Eye,
  Trash2,
  X,
  Loader2,
  CalendarCheck,
  CalendarDays,
  Users,
  Globe,
  Lock,
  Link2,
  Copy,
  Check,
} from 'lucide-react'
import {
  createAdminCalendar,
  deleteAdminCalendar,
  getOrCreateOrientationCalendar,
} from '@/lib/actions/admin-calendars'
import { CalendarType, CalendarVisibility } from '@prisma/client'

interface AdminCalendarData {
  id: string
  name: string
  description: string | null
  type: CalendarType
  visibility: CalendarVisibility
  color: string
  slotDurationMinutes: number | null
  isPublicBookable: boolean
  publicSlug: string | null
  isActive: boolean
  createdAt: string
  _count: {
    slots: number
    bookings: number
    events: number
  }
}

interface Props {
  calendars: AdminCalendarData[]
}

const visibilityLabels: Record<CalendarVisibility, string> = {
  GLOBAL: 'All Users',
  COACHES_ONLY: 'Coaches Only',
  AMBASSADORS_ONLY: 'Ambassadors Only',
  CUSTOM: 'Custom Access',
  PUBLIC: 'Public',
}

const visibilityIcons: Record<CalendarVisibility, React.ReactNode> = {
  GLOBAL: <Globe className="h-4 w-4" />,
  COACHES_ONLY: <Users className="h-4 w-4" />,
  AMBASSADORS_ONLY: <Users className="h-4 w-4" />,
  CUSTOM: <Lock className="h-4 w-4" />,
  PUBLIC: <Globe className="h-4 w-4" />,
}

export function CalendarsClient({ calendars: initialCalendars }: Props) {
  const router = useRouter()
  const [calendars, setCalendars] = useState(initialCalendars)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [isSettingUpOrientation, setIsSettingUpOrientation] = useState(false)

  const [newCalendar, setNewCalendar] = useState({
    name: '',
    description: '',
    type: 'EVENTS' as CalendarType,
    visibility: 'GLOBAL' as CalendarVisibility,
    color: '#3B82F6',
    slotDurationMinutes: 60,
    isPublicBookable: false,
    publicSlug: '',
  })

  const handleCreateCalendar = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    const result = await createAdminCalendar({
      name: newCalendar.name,
      description: newCalendar.description || undefined,
      type: newCalendar.type,
      visibility: newCalendar.visibility,
      color: newCalendar.color,
      slotDurationMinutes: newCalendar.type === 'BOOKING' ? newCalendar.slotDurationMinutes : undefined,
      isPublicBookable: newCalendar.isPublicBookable,
      publicSlug: newCalendar.publicSlug || undefined,
    })

    if ('error' in result && result.error) {
      setError(result.error)
      setIsCreating(false)
      return
    }

    setShowCreateModal(false)
    setNewCalendar({
      name: '',
      description: '',
      type: 'EVENTS',
      visibility: 'GLOBAL',
      color: '#3B82F6',
      slotDurationMinutes: 60,
      isPublicBookable: false,
      publicSlug: '',
    })
    setIsCreating(false)
    router.refresh()
  }

  const handleDeleteCalendar = async (calendarId: string) => {
    if (!confirm('Are you sure you want to delete this calendar? All events and bookings will be lost.')) {
      return
    }

    const result = await deleteAdminCalendar(calendarId)
    if ('error' in result && result.error) {
      alert(result.error)
      return
    }

    setCalendars(calendars.filter((c) => c.id !== calendarId))
  }

  const handleSetupOrientationCalendar = async () => {
    setIsSettingUpOrientation(true)
    setError(null)

    try {
      const result = await getOrCreateOrientationCalendar()

      if (result.error) {
        setError(result.error)
        setIsSettingUpOrientation(false)
        return
      }

      // Navigate to the new calendar
      if (result.calendar?.id) {
        // Use window.location for more reliable navigation
        window.location.href = `/admin/calendars/${result.calendar.id}`
      } else {
        // Fallback: just refresh the page
        window.location.reload()
      }
    } catch (err) {
      console.error('Error setting up orientation calendar:', err)
      setError('Failed to create orientation calendar. Please try again.')
      setIsSettingUpOrientation(false)
    }
  }

  const copyPublicLink = async (slug: string) => {
    const link = `${window.location.origin}/book/${slug}`
    await navigator.clipboard.writeText(link)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const hasOrientationCalendar = calendars.some((c) => c.publicSlug === 'orientation')

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-800 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendars</h1>
          <p className="text-gray-500 mt-1">
            Create and manage calendars for events and bookings
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!hasOrientationCalendar && (
            <button
              onClick={handleSetupOrientationCalendar}
              disabled={isSettingUpOrientation}
              className="inline-flex items-center gap-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors font-medium disabled:opacity-50"
            >
              {isSettingUpOrientation ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <CalendarCheck className="h-4 w-4" />
                  Setup Orientation Calendar
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <Plus className="h-4 w-4" />
            Create Calendar
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      {calendars.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No calendars yet</h3>
          <p className="text-gray-500 mb-6">
            Create your first calendar to start managing events and bookings.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Calendar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {calendars.map((calendar) => (
            <div
              key={calendar.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Color Bar */}
              <div className="h-2" style={{ backgroundColor: calendar.color }} />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${calendar.color}20` }}
                    >
                      {calendar.type === 'BOOKING' ? (
                        <CalendarCheck className="h-5 w-5" style={{ color: calendar.color }} />
                      ) : (
                        <CalendarDays className="h-5 w-5" style={{ color: calendar.color }} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{calendar.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        {visibilityIcons[calendar.visibility]}
                        <span>{visibilityLabels[calendar.visibility]}</span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      calendar.type === 'BOOKING'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {calendar.type === 'BOOKING' ? 'Booking' : 'Events'}
                  </span>
                </div>

                {/* Description */}
                {calendar.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {calendar.description}
                  </p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 py-3 border-y border-gray-100 mb-4">
                  {calendar.type === 'BOOKING' && (
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {calendar._count.slots}
                      </div>
                      <div className="text-xs text-gray-500">Slots</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {calendar._count.events}
                    </div>
                    <div className="text-xs text-gray-500">Events</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {calendar._count.bookings}
                    </div>
                    <div className="text-xs text-gray-500">Bookings</div>
                  </div>
                </div>

                {/* Public Link */}
                {calendar.isPublicBookable && calendar.publicSlug && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                      <Link2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 truncate flex-1">
                        /book/{calendar.publicSlug}
                      </span>
                      <button
                        onClick={() => copyPublicLink(calendar.publicSlug!)}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Copy link"
                      >
                        {copiedSlug === calendar.publicSlug ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/calendars/${calendar.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Link>
                  <Link
                    href={`/admin/calendars/${calendar.id}?tab=settings`}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDeleteCalendar(calendar.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Calendar Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Create Calendar</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCalendar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Calendar Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCalendar.name}
                  onChange={(e) => setNewCalendar({ ...newCalendar, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., SOIA Events"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newCalendar.description}
                  onChange={(e) => setNewCalendar({ ...newCalendar, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Calendar Type
                  </label>
                  <select
                    value={newCalendar.type}
                    onChange={(e) => setNewCalendar({ ...newCalendar, type: e.target.value as CalendarType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="EVENTS">Events (display only)</option>
                    <option value="BOOKING">Booking (with slots)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newCalendar.color}
                      onChange={(e) => setNewCalendar({ ...newCalendar, color: e.target.value })}
                      className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newCalendar.color}
                      onChange={(e) => setNewCalendar({ ...newCalendar, color: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <select
                  value={newCalendar.visibility}
                  onChange={(e) => setNewCalendar({ ...newCalendar, visibility: e.target.value as CalendarVisibility })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="GLOBAL">All Users (Coaches & Ambassadors)</option>
                  <option value="COACHES_ONLY">Coaches Only</option>
                  <option value="AMBASSADORS_ONLY">Ambassadors Only</option>
                  <option value="PUBLIC">Public (including prospects)</option>
                  <option value="CUSTOM">Custom (per-user access)</option>
                </select>
              </div>

              {newCalendar.type === 'BOOKING' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Slot Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={newCalendar.slotDurationMinutes}
                      onChange={(e) => setNewCalendar({ ...newCalendar, slotDurationMinutes: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min={15}
                      step={15}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isPublicBookable"
                      checked={newCalendar.isPublicBookable}
                      onChange={(e) => setNewCalendar({ ...newCalendar, isPublicBookable: e.target.checked })}
                      className="h-4 w-4 text-primary-600 rounded border-gray-300"
                    />
                    <label htmlFor="isPublicBookable" className="text-sm text-gray-700">
                      Allow public booking (for prospects)
                    </label>
                  </div>

                  {newCalendar.isPublicBookable && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Public URL Slug
                      </label>
                      <div className="flex items-center">
                        <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-500">
                          /book/
                        </span>
                        <input
                          type="text"
                          value={newCalendar.publicSlug}
                          onChange={(e) => setNewCalendar({ ...newCalendar, publicSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="orientation"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newCalendar.name}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Calendar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
