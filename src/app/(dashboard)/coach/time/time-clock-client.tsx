'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Clock,
  Play,
  Pause,
  Square,
  Coffee,
  Timer,
  Calendar,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  startTimer,
  stopTimer,
} from '@/lib/actions/time-clock'

type ClockEntry = {
  id: string
  type: string
  timestamp: string
  notes: string | null
}

type RunningTimer = {
  id: string
  startTime: string
  description: string | null
  project: { id: string; name: string } | null
  task: { id: string; title: string } | null
}

type WeeklyStats = {
  totalMinutes: number
  totalHours: number
  billableMinutes: number
  billableHours: number
  entryCount: number
}

export function TimeClockClient({
  initialStatus,
  todayEntries,
  weeklyStats,
  runningTimer,
}: {
  initialStatus: string
  todayEntries: ClockEntry[]
  weeklyStats: WeeklyStats
  runningTimer: RunningTimer | null
}) {
  const [status, setStatus] = useState(initialStatus)
  const [isLoading, setIsLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [timer, setTimer] = useState(runningTimer)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')
  const [timerDescription, setTimerDescription] = useState('')

  // Update elapsed time for running timer
  useEffect(() => {
    if (!timer) {
      setElapsedTime('00:00:00')
      return
    }

    const updateElapsed = () => {
      const start = new Date(timer.startTime).getTime()
      const now = Date.now()
      const elapsed = now - start
      const hours = Math.floor(elapsed / 3600000)
      const minutes = Math.floor((elapsed % 3600000) / 60000)
      const seconds = Math.floor((elapsed % 60000) / 1000)
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      )
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [timer])

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

  const handleStartTimer = async () => {
    setIsLoading(true)
    const result = await startTimer(undefined, undefined, timerDescription || undefined)
    if (result.success) {
      setTimer({
        id: result.entryId!,
        startTime: new Date().toISOString(),
        description: timerDescription || null,
        project: null,
        task: null,
      })
      setTimerDescription('')
    }
    setIsLoading(false)
  }

  const handleStopTimer = async () => {
    setIsLoading(true)
    const result = await stopTimer()
    if (result.success) {
      setTimer(null)
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
      <div className="lg:col-span-2 space-y-6">
        {/* Clock In/Out Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time Clock
                </CardTitle>
                <CardDescription>
                  Clock in and out for work attendance
                </CardDescription>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-6">
              <div className="text-5xl font-mono font-bold text-gray-900 mb-2">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
                  className="col-span-2 h-14 text-lg bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Play className="h-5 w-5 mr-2" />
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
                    className="h-14 text-lg"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Coffee className="h-5 w-5 mr-2" />
                    )}
                    Start Break
                  </Button>
                  <Button
                    onClick={handleClockOut}
                    disabled={isLoading}
                    className="h-14 text-lg bg-red-600 hover:bg-red-700"
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
                  className="col-span-2 h-14 text-lg bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Pause className="h-5 w-5 mr-2" />
                  )}
                  End Break
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Project Timer Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Project Timer
            </CardTitle>
            <CardDescription>
              Track time spent on specific projects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl font-mono font-bold text-gray-900 mb-2">
                {elapsedTime}
              </div>
              {timer && timer.description && (
                <p className="text-gray-500">{timer.description}</p>
              )}
            </div>

            {!timer && (
              <div>
                <Input
                  placeholder="What are you working on?"
                  value={timerDescription}
                  onChange={(e) => setTimerDescription(e.target.value)}
                />
              </div>
            )}

            <Button
              onClick={timer ? handleStopTimer : handleStartTimer}
              disabled={isLoading}
              className={`w-full h-12 ${timer ? 'bg-red-600 hover:bg-red-700' : 'bg-primary'}`}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : timer ? (
                <Square className="h-5 w-5 mr-2" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              {timer ? 'Stop Timer' : 'Start Timer'}
            </Button>
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
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-900">
                {weeklyStats.totalHours}h
              </div>
              <p className="text-sm text-gray-500">Total Hours</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-700">
                  {weeklyStats.billableHours}h
                </div>
                <p className="text-xs text-green-600">Billable</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-700">
                  {weeklyStats.entryCount}
                </div>
                <p className="text-xs text-blue-600">Entries</p>
              </div>
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
