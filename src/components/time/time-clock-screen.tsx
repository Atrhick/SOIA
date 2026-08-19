'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Clock, Coffee, Loader2, Play, Square, Timer } from 'lucide-react'
import { clockOutAt, punch, startTimer, stopTimer } from '@/lib/actions/time-clock'
import {
  PUNCH_LABELS,
  STATUS_LABELS,
  formatHours,
  formatMinutes,
  type ClockPunch,
  type ClockStatus,
  type Shift,
  type ShiftTotals,
} from '@/lib/time-clock'

export interface TimeClockData {
  readOnly: boolean
  timeZone: string
  status: ClockStatus
  since: string | null
  openShift: Shift | null
  staleShift: boolean
  todayEvents: { id: string; type: ClockPunch; timestamp: string; notes: string | null }[]
  todayShifts: Shift[]
  weekShifts: Shift[]
  weekStart: string
  weekEnd: string
  weekTotals: ShiftTotals
  todayTotals: ShiftTotals
  projectTimer: {
    id: string
    startTime: string
    description: string | null
    project: { id: string; name: string } | null
    task: { id: string; title: string } | null
  } | null
  projectWeek: { totalMinutes: number; billableMinutes: number; entryCount: number }
}

const STATUS_VARIANT: Record<ClockStatus, 'success' | 'warning' | 'secondary'> = {
  CLOCKED_IN: 'success',
  ON_BREAK: 'warning',
  CLOCKED_OUT: 'secondary',
}

/** Renders only after mount, so the server and the first client paint agree. */
function LiveClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="text-center py-6">
      <div className="text-5xl font-mono font-bold text-gray-900 mb-2 tabular-nums">
        {now
          ? now.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZone,
            })
          : '--:--:--'}
      </div>
      <p className="text-gray-500">
        {now
          ? now.toLocaleDateString([], {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone,
            })
          : ' '}
      </p>
    </div>
  )
}

function Elapsed({ from, prefix }: { from: string; prefix?: string }) {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    const tick = () => {
      const ms = Date.now() - new Date(from).getTime()
      const total = Math.max(0, Math.floor(ms / 1000))
      const h = Math.floor(total / 3600)
      const m = Math.floor((total % 3600) / 60)
      const s = total % 60
      setText(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [from])

  return (
    <span className="tabular-nums">
      {prefix}
      {text ?? '00:00:00'}
    </span>
  )
}

function timeOf(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone })
}

function dayOf(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  })
}

export function TimeClockScreen({
  data,
  showProjectTimer,
}: {
  data: TimeClockData
  showProjectTimer: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [timerDescription, setTimerDescription] = useState('')
  const [correctedEnd, setCorrectedEnd] = useState('')

  const { readOnly, timeZone, status } = data
  const locked = isPending || readOnly

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>, ok: string) => {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await fn()
      if (result?.error) {
        setError(result.error)
        // The server is the authority on state; pull the truth back down so a
        // rejected punch cannot leave the buttons showing the wrong options.
        router.refresh()
        return
      }
      setNotice(ok)
      setNotes('')
      router.refresh()
    })
  }

  const doPunch = (type: ClockPunch, ok: string) =>
    run(() => punch({ type, notes: notes.trim() || undefined }), ok)

  const reviewCount = data.weekTotals.needsReviewCount

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {readOnly && (
          <AlertBanner
            variant="warning"
            title="Viewing as this user"
            message="You can see this timesheet, but clocking in or out is turned off while impersonating. Switch back to your admin account first."
          />
        )}

        {data.staleShift && data.openShift && (
          <AlertBanner
            variant="warning"
            title="You are still clocked in"
            message={`Your shift started ${dayOf(data.openShift.start, timeZone)} at ${timeOf(
              data.openShift.start,
              timeZone
            )} and has been running for ${formatMinutes(
              data.openShift.workedMinutes
            )}. Close it below with the time you actually finished - it is left out of your totals until you do.`}
          />
        )}

        {error && (
          <AlertBanner variant="error" message={error} dismissible onDismiss={() => setError(null)} />
        )}
        {notice && (
          <AlertBanner
            variant="success"
            message={notice}
            dismissible
            onDismiss={() => setNotice(null)}
          />
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time Clock
                </CardTitle>
                <CardDescription>
                  {status === 'CLOCKED_OUT'
                    ? 'Clock in when you start work'
                    : data.openShift
                      ? `On the clock since ${timeOf(data.openShift.start, timeZone)}`
                      : 'On the clock'}
                </CardDescription>
              </div>
              <Badge variant={STATUS_VARIANT[status]} className="text-sm">
                {STATUS_LABELS[status]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <LiveClock timeZone={timeZone} />

            {data.openShift && !data.staleShift && (
              <p className="text-center text-sm text-gray-500">
                <Elapsed from={data.openShift.start} prefix="This shift: " />
                {data.openShift.breakMinutes > 0 &&
                  ` (including ${formatMinutes(data.openShift.breakMinutes)} of breaks)`}
              </p>
            )}

            <Textarea
              placeholder="Add a note (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              disabled={locked}
              aria-label="Note for this punch"
            />

            <div className="grid grid-cols-2 gap-3">
              {status === 'CLOCKED_OUT' && (
                <Button
                  onClick={() => doPunch('CLOCK_IN', 'Clocked in')}
                  disabled={locked}
                  className="col-span-2 h-14 text-lg bg-green-600 hover:bg-green-700"
                >
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Play className="h-5 w-5 mr-2" />
                  )}
                  Clock in
                </Button>
              )}

              {status === 'CLOCKED_IN' && (
                <>
                  <Button
                    onClick={() => doPunch('BREAK_START', 'Break started')}
                    disabled={locked}
                    variant="outline"
                    className="h-14 text-lg"
                  >
                    <Coffee className="h-5 w-5 mr-2" />
                    Start break
                  </Button>
                  <Button
                    onClick={() => doPunch('CLOCK_OUT', 'Clocked out')}
                    disabled={locked}
                    className="h-14 text-lg bg-red-600 hover:bg-red-700"
                  >
                    {isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Square className="h-5 w-5 mr-2" />
                    )}
                    Clock out
                  </Button>
                </>
              )}

              {status === 'ON_BREAK' && (
                <>
                  <Button
                    onClick={() => doPunch('BREAK_END', 'Back from break')}
                    disabled={locked}
                    className="h-14 text-lg bg-blue-600 hover:bg-blue-700"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    End break
                  </Button>
                  <Button
                    onClick={() => doPunch('CLOCK_OUT', 'Clocked out')}
                    disabled={locked}
                    variant="outline"
                    className="h-14 text-lg"
                  >
                    <Square className="h-5 w-5 mr-2" />
                    Clock out
                  </Button>
                </>
              )}
            </div>

            {data.staleShift && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div>
                  <Label htmlFor="corrected-end">When did you actually finish?</Label>
                  <Input
                    id="corrected-end"
                    type="datetime-local"
                    value={correctedEnd}
                    onChange={(e) => setCorrectedEnd(e.target.value)}
                    disabled={locked}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={locked || !correctedEnd}
                  onClick={() =>
                    run(
                      () => clockOutAt({ endedAt: new Date(correctedEnd).toISOString() }),
                      'Shift closed'
                    )
                  }
                >
                  Close the shift at that time
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {showProjectTimer && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Project timer
              </CardTitle>
              <CardDescription>
                Separate from attendance - use it to track time against a piece of work
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <div className="text-4xl font-mono font-bold text-gray-900 mb-2">
                  {data.projectTimer ? <Elapsed from={data.projectTimer.startTime} /> : '00:00:00'}
                </div>
                {data.projectTimer?.description && (
                  <p className="text-gray-500">{data.projectTimer.description}</p>
                )}
              </div>

              {!data.projectTimer && (
                <Input
                  placeholder="What are you working on?"
                  value={timerDescription}
                  onChange={(e) => setTimerDescription(e.target.value)}
                  maxLength={500}
                  disabled={locked}
                  aria-label="What are you working on"
                />
              )}

              <Button
                onClick={() =>
                  data.projectTimer
                    ? run(() => stopTimer(), 'Timer stopped')
                    : run(
                        () => startTimer({ description: timerDescription.trim() || undefined }),
                        'Timer started'
                      )
                }
                disabled={locked}
                className={`w-full h-12 ${data.projectTimer ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                {isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : data.projectTimer ? (
                  <Square className="h-5 w-5 mr-2" />
                ) : (
                  <Play className="h-5 w-5 mr-2" />
                )}
                {data.projectTimer ? 'Stop timer' : 'Start timer'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">This week</CardTitle>
            <CardDescription>
              {dayOf(data.weekStart, timeZone)} onwards &middot; {timeZone.replace(/_/g, ' ')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-900">
                {formatHours(data.weekTotals.workedMinutes)}
              </div>
              <p className="text-sm text-gray-500">Worked, breaks excluded</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-900">{data.weekTotals.shiftCount}</div>
                <p className="text-xs text-gray-500">Shifts</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-900">
                  {formatMinutes(data.weekTotals.breakMinutes)}
                </div>
                <p className="text-xs text-gray-500">On break</p>
              </div>
            </div>
            {reviewCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                {reviewCount} shift{reviewCount === 1 ? '' : 's'} left out of this total because the
                clock-out looks wrong.
              </p>
            )}
            {showProjectTimer && data.projectWeek.entryCount > 0 && (
              <div className="pt-3 border-t border-gray-100 text-sm text-gray-600">
                Project timer: {formatHours(data.projectWeek.totalMinutes)} across{' '}
                {data.projectWeek.entryCount} entr
                {data.projectWeek.entryCount === 1 ? 'y' : 'ies'}
                {data.projectWeek.billableMinutes > 0 && (
                  <> &middot; {formatHours(data.projectWeek.billableMinutes)} billable</>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today</CardTitle>
            {data.todayTotals.workedMinutes > 0 && (
              <CardDescription>
                {formatMinutes(data.todayTotals.workedMinutes)} worked so far
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {data.todayShifts.length === 0 && data.todayEvents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nothing recorded today</p>
            ) : (
              <div className="space-y-4">
                {data.todayShifts.map((shift) => (
                  <div key={shift.start} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900">
                        {timeOf(shift.start, timeZone)} &ndash;{' '}
                        {shift.end ? timeOf(shift.end, timeZone) : 'now'}
                      </span>
                      <span className="text-gray-600">{formatMinutes(shift.workedMinutes)}</span>
                    </div>
                    {shift.breakMinutes > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatMinutes(shift.breakMinutes)} on break
                      </p>
                    )}
                    {shift.needsReview && (
                      <p className="text-xs text-amber-700 mt-1">{shift.reviewReason}</p>
                    )}
                  </div>
                ))}

                <div className="space-y-2">
                  {data.todayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between text-sm text-gray-600"
                    >
                      <span>{PUNCH_LABELS[event.type]}</span>
                      <span className="text-gray-500">{timeOf(event.timestamp, timeZone)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {data.weekShifts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">This week&apos;s shifts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.weekShifts
                .slice()
                .reverse()
                .map((shift) => (
                  <div key={shift.start} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-900">{dayOf(shift.start, timeZone)}</span>
                      <span className="text-gray-500 ml-2">
                        {timeOf(shift.start, timeZone)} &ndash;{' '}
                        {shift.end ? timeOf(shift.end, timeZone) : 'now'}
                      </span>
                    </div>
                    <span className={shift.needsReview ? 'text-amber-700' : 'text-gray-600'}>
                      {shift.needsReview ? 'Needs review' : formatMinutes(shift.workedMinutes)}
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
