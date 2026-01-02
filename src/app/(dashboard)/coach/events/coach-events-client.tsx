'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { submitRSVP } from '@/lib/actions/events'
import {
  Calendar,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
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
  rsvpStatus: 'YES' | 'NO' | 'MAYBE' | null
  isQualified: boolean
  qualificationReasons: string[]
}

export function CoachEventsClient({
  upcomingEvents,
  pastEvents,
}: {
  upcomingEvents: Event[]
  pastEvents: Event[]
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')

  const handleRSVP = async (eventId: string, status: 'YES' | 'NO' | 'MAYBE') => {
    setIsLoading(true)
    setError('')
    const result = await submitRSVP(eventId, status)
    if (result.error) {
      setError(result.error)
    }
    setIsLoading(false)
  }

  const events = activeTab === 'upcoming' ? upcomingEvents : pastEvents

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <p className="text-gray-600">View upcoming events and RSVP</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Calendar className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingEvents.length}</p>
                <p className="text-sm text-gray-500">Upcoming Events</p>
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
                <p className="text-2xl font-bold">
                  {upcomingEvents.filter((e) => e.isQualified).length}
                </p>
                <p className="text-sm text-gray-500">Qualified For</p>
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
                <p className="text-2xl font-bold">
                  {upcomingEvents.filter((e) => e.rsvpStatus === 'YES').length}
                </p>
                <p className="text-sm text-gray-500">RSVPs Confirmed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'upcoming'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Upcoming ({upcomingEvents.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'past'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Past ({pastEvents.length})
        </button>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === 'upcoming' ? 'Upcoming Events' : 'Past Events'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`p-4 border rounded-lg space-y-3 ${
                    !event.isQualified && activeTab === 'upcoming'
                      ? 'bg-gray-50 border-gray-200'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{event.name}</h4>
                        {event.isQualified ? (
                          <Badge variant="success" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Qualified
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Not Qualified
                          </Badge>
                        )}
                        {event.rsvpStatus && (
                          <Badge
                            variant={
                              event.rsvpStatus === 'YES'
                                ? 'success'
                                : event.rsvpStatus === 'MAYBE'
                                  ? 'warning'
                                  : 'secondary'
                            }
                            className="text-xs"
                          >
                            RSVP: {event.rsvpStatus}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(event.startDate).toLocaleDateString()}
                          {event.endDate &&
                            ` - ${new Date(event.endDate).toLocaleDateString()}`}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {event.description && (
                    <p className="text-sm text-gray-600">{event.description}</p>
                  )}

                  {/* Qualification Reasons */}
                  {!event.isQualified && event.qualificationReasons.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-sm font-medium text-yellow-800 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        To qualify for this event:
                      </p>
                      <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                        {event.qualificationReasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* RSVP Buttons */}
                  {activeTab === 'upcoming' && event.isQualified && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant={event.rsvpStatus === 'YES' ? 'default' : 'outline'}
                        onClick={() => handleRSVP(event.id, 'YES')}
                        disabled={isLoading}
                        className={
                          event.rsvpStatus === 'YES'
                            ? 'bg-green-600 hover:bg-green-700'
                            : ''
                        }
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Yes
                      </Button>
                      <Button
                        size="sm"
                        variant={event.rsvpStatus === 'MAYBE' ? 'default' : 'outline'}
                        onClick={() => handleRSVP(event.id, 'MAYBE')}
                        disabled={isLoading}
                        className={
                          event.rsvpStatus === 'MAYBE'
                            ? 'bg-yellow-600 hover:bg-yellow-700'
                            : ''
                        }
                      >
                        Maybe
                      </Button>
                      <Button
                        size="sm"
                        variant={event.rsvpStatus === 'NO' ? 'default' : 'outline'}
                        onClick={() => handleRSVP(event.id, 'NO')}
                        disabled={isLoading}
                        className={
                          event.rsvpStatus === 'NO'
                            ? 'bg-gray-600 hover:bg-gray-700'
                            : ''
                        }
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        No
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">
                {activeTab === 'upcoming'
                  ? 'No upcoming events'
                  : 'No past events'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
