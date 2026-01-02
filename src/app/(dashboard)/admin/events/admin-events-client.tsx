'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createEvent, updateEvent, deleteEvent } from '@/lib/actions/events'
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  MapPin,
  Users,
  CheckCircle,
  Clock,
} from 'lucide-react'

interface Event {
  id: string
  name: string
  description: string | null
  location: string | null
  startDate: string
  endDate: string | null
  requireOnboardingComplete: boolean
  requiredApprovedAmbassadors: number
  isActive: boolean
  createdAt: string
  rsvpCounts: {
    yes: number
    no: number
    maybe: number
  }
  qualifiedCount: number
}

interface Stats {
  total: number
  upcoming: number
  active: number
  totalRsvps: number
}

export function AdminEventsClient({
  events,
  stats,
}: {
  events: Event[]
  stats: Stats
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const result = editingEvent
      ? await updateEvent(editingEvent.id, formData)
      : await createEvent(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setShowForm(false)
      setEditingEvent(null)
      ;(e.target as HTMLFormElement).reset()
    }
    setIsLoading(false)
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return
    setIsLoading(true)
    await deleteEvent(eventId)
    setIsLoading(false)
  }

  const handleEdit = (event: Event) => {
    setEditingEvent(event)
    setShowForm(true)
  }

  const isPast = (dateStr: string) => new Date(dateStr) < new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600">Create and manage events</p>
        </div>
        <Button onClick={() => { setEditingEvent(null); setShowForm(!showForm) }}>
          <Plus className="h-4 w-4 mr-2" />
          New Event
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Calendar className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-500">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
                <p className="text-sm text-gray-500">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-gray-500">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalRsvps}</p>
                <p className="text-sm text-gray-500">Total RSVPs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingEvent ? 'Edit Event' : 'Create New Event'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                name="name"
                label="Event Name"
                placeholder="Annual Conference 2025"
                defaultValue={editingEvent?.name}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Event details..."
                  defaultValue={editingEvent?.description || ''}
                />
              </div>

              <Input
                name="location"
                label="Location"
                placeholder="New York, NY"
                defaultValue={editingEvent?.location || ''}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  name="startDate"
                  label="Start Date"
                  type="datetime-local"
                  defaultValue={editingEvent?.startDate?.slice(0, 16)}
                  required
                />
                <Input
                  name="endDate"
                  label="End Date (optional)"
                  type="datetime-local"
                  defaultValue={editingEvent?.endDate?.slice(0, 16) || ''}
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Qualification Requirements</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="requireOnboardingComplete"
                      value="true"
                      defaultChecked={editingEvent?.requireOnboardingComplete}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Require onboarding to be complete</span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Required Approved Ambassadors
                    </label>
                    <input
                      type="number"
                      name="requiredApprovedAmbassadors"
                      min="0"
                      defaultValue={editingEvent?.requiredApprovedAmbassadors || 0}
                      className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {editingEvent && (
                <div className="border-t pt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isActive"
                      value="true"
                      defaultChecked={editingEvent.isActive}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Event is active</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowForm(false); setEditingEvent(null) }}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>All Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-4 border rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{event.name}</h4>
                        {!event.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {isPast(event.startDate) && (
                          <Badge variant="secondary">Past</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(event.startDate).toLocaleDateString()}
                          {event.endDate && ` - ${new Date(event.endDate).toLocaleDateString()}`}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(event)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => handleDelete(event.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {event.description && (
                    <p className="text-sm text-gray-600">{event.description}</p>
                  )}

                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">RSVPs:</span>
                      <Badge variant="success" className="text-xs">
                        {event.rsvpCounts.yes} Yes
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {event.rsvpCounts.maybe} Maybe
                      </Badge>
                      <Badge variant="destructive" className="text-xs">
                        {event.rsvpCounts.no} No
                      </Badge>
                    </div>
                    <span className="text-gray-500">
                      Qualified: {event.qualifiedCount}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400">
                    Requirements:{' '}
                    {event.requireOnboardingComplete && 'Onboarding complete'}
                    {event.requireOnboardingComplete && event.requiredApprovedAmbassadors > 0 && ', '}
                    {event.requiredApprovedAmbassadors > 0 && `${event.requiredApprovedAmbassadors} approved ambassadors`}
                    {!event.requireOnboardingComplete && event.requiredApprovedAmbassadors === 0 && 'None'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">No events yet</p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Event
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
