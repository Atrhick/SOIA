'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Clock,
  Play,
  Square,
  Coffee,
  Pause,
  Calendar,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
} from '@/lib/actions/time-clock'

type ClockEntry = {
  id: string
  type: string
  timestamp: string
  notes: string | null
}

type WeeklyStats = {
  totalMinutes: number
  totalHours: number
  billableMinutes: number
  billableHours: number
  entryCount: number
}

export function AmbassadorTimeClockClient({
  initialStatus,
  todayEntries,
  weeklyStats,
}: {
  initialStatus: string
  todayEntries: ClockEntry[]
  weeklyStats: WeeklyStats
}) {
  const [status, setStatus] = useState(initialStatus)
  const [isLoading, setIsLoading] = useState(false)
  const [notes, setNotes] = useState('')

  const handleClockIn = async () => {
    setIsLoading(true)
    const result = await clockIn(notes || undefined)
    if (result.success) {
      setStatus('CLOCKED_IN')
      setNotes('')
    }
    setIsLoading(false)
  }

  const handleClockOut = async () => {
    setIsLoading(true)
    const result = await clockOut(notes || undefined)
    if (result.success) {
      setStatus('CLOCKED_OUT')
      setNotes('')
    }
    setIsLoading(false)
  }

  const handleStartBreak = async () => {
    setIsLoading(true)
    const result = await startBreak(notes || undefined)
    if (result.success) {
      setStatus('ON_BREAK')
      setNotes('')
    }
    setIsLoading(false)
  }

  const handleEndBreak = async () => {
    setIsLoading(true)
    const result = await endBreak(notes || undefined)
    if (result.success) {
      setStatus('CLOCKED_IN')
      setNotes('')
    }
    setIsLoading(false)
  }

  const getStatusBadge = () => {
    switch (status) {
      case 'CLOCKED_IN':
        return <Badge variant="success" className="text-sm">Clocked In</Badge>
      case 'ON_BREAK':
        return <Badge variant="warning" className="text-sm">On Break</Badge>
      default:
        return <Badge variant="secondary" className="text-sm">Clocked Out</Badge>
    }
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Clock Widget */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time Clock
                </CardTitle>
                <CardDescription>
                  Clock in and out for your activities
                </CardDescription>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8">
              <div className="text-6xl font-mono font-bold text-gray-900 mb-2">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <p className="text-gray-500">
                {new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div>
              <Textarea
                placeholder="Add notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {status === 'CLOCKED_OUT' && (
                <Button
                  onClick={handleClockIn}
                  disabled={isLoading}
                  className="col-span-2 h-16 text-xl bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  ) : (
                    <Play className="h-6 w-6 mr-2" />
                  )}
                  Clock In
                </Button>
              )}

              {status === 'CLOCKED_IN' && (
                <>
                  <Button
                    onClick={handleStartBreak}
                    disabled={isLoading}
                    variant="outline"
                    className="h-16 text-lg"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Coffee className="h-5 w-5 mr-2" />
                    )}
                    Take Break
                  </Button>
                  <Button
                    onClick={handleClockOut}
                    disabled={isLoading}
                    className="h-16 text-lg bg-red-600 hover:bg-red-700"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Square className="h-5 w-5 mr-2" />
                    )}
                    Clock Out
                  </Button>
                </>
              )}

              {status === 'ON_BREAK' && (
                <Button
                  onClick={handleEndBreak}
                  disabled={isLoading}
                  className="col-span-2 h-16 text-xl bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  ) : (
                    <Pause className="h-6 w-6 mr-2" />
                  )}
                  End Break
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Weekly Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <div className="text-4xl font-bold text-gray-900">
                {weeklyStats.totalHours}h
              </div>
              <p className="text-sm text-gray-500 mt-1">Total Hours</p>
            </div>
          </CardContent>
        </Card>

        {/* Today's Entries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today&apos;s Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {todayEntries.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No clock entries today
              </p>
            ) : (
              <div className="space-y-3">
                {todayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">
                        {entry.type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
