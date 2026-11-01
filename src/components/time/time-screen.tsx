'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Play, Plus, Square } from 'lucide-react'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EntryDialog, type EntryValues } from '@/components/time/entry-dialog'
import { ProjectPicker, type ProjectGroup } from '@/components/time/project-picker'
import { useNow } from '@/components/time/use-now'
import { cn } from '@/lib/utils'
import {
  countedMinutes,
  dayKey,
  entryMs,
  formatClock,
  formatIn,
  formatMinutes,
  isRunaway,
  weekDays,
  zonedInstant,
  type EntryView,
  type ProjectOption,
} from '@/lib/time'
import { createMyProject, deleteEntry, saveEntry, startTimer, stopTimer, type MyTime } from '@/lib/actions/time'

type Result = { error?: string }

export function TimeScreen({ data }: { data: MyTime }) {
  const router = useRouter()
  const now = useNow(data.asOf)
  const zone = data.timeZone
  const locked = data.readOnly
  const [pending, startTransition] = useTransition()
  // Saves from editing the bar run separately so they never disable Stop: the
  // blur that saves a typed description fires on the same click as Stop.
  const [, startBarSave] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const running = data.running
  const [description, setDescription] = useState(running?.description ?? '')
  const [project, setProject] = useState<ProjectOption | null>(projectOf(running))
  // Track which running entry the bar was filled from, so a refresh that
  // starts or stops a timer resets it without clobbering typing in between.
  const [barFor, setBarFor] = useState(running?.id ?? null)
  if ((running?.id ?? null) !== barFor) {
    setBarFor(running?.id ?? null)
    setDescription(running?.description ?? '')
    setProject(projectOf(running))
  }

  const [editing, setEditing] = useState<EntryView | 'new' | null>(null)
  const [forgotDismissed, setForgotDismissed] = useState(false)

  const groups: ProjectGroup[] | null = data.useProjects
    ? [
        { label: 'NT projects', options: data.projects.shared },
        { label: 'My projects', options: data.projects.mine },
      ]
    : null

  const run = (fn: () => Promise<Result>) => {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  const createProject = async (name: string) => {
    const result = await createMyProject(name)
    if ('error' in result) {
      setError(result.error ?? 'Could not create the project.')
      return null
    }
    router.refresh()
    return result.project
  }

  /**
   * Changes to the bar while a timer runs are saved straight onto that entry.
   * If Stop lands first, the server keeps the stop and still applies the change.
   */
  const updateRunning = (changes: { description?: string; project?: ProjectOption | null }) => {
    if (!running || locked) return
    startBarSave(async () => {
      const result = await saveEntry({
        id: running.id,
        description: changes.description ?? description,
        projectId: (changes.project !== undefined ? changes.project : project)?.id ?? null,
        startTime: running.startTime,
        endTime: null,
      })
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  const resume = (e: EntryView) =>
    run(() => startTimer({ description: e.description ?? undefined, projectId: e.projectId }))

  // ---- Derived lists ----

  const days = useMemo(() => weekDays(zone, 0, new Date(data.asOf)).map((d) => dayKey(d, zone)), [zone, data.asOf])
  const byDay = useMemo(() => {
    const map = new Map<string, EntryView[]>()
    for (const e of data.entries) {
      const key = dayKey(e.startTime, zone)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return Array.from(map.entries())
  }, [data.entries, zone])

  const thisWeek = data.entries.filter((e) => days.includes(dayKey(e.startTime, zone)))
  const weekMinutes = countedMinutes(thisWeek, now)
  const dayMinutes = days.map((d) => countedMinutes(thisWeek.filter((e) => dayKey(e.startTime, zone) === d), now))
  const maxDay = Math.max(60, ...dayMinutes)
  const todayKey = dayKey(new Date(now), zone)

  const totals = new Map<string, number>()
  for (const e of thisWeek) {
    if (isRunaway(e, now)) continue
    const name = e.projectName ?? 'No project'
    totals.set(name, (totals.get(name) ?? 0) + Math.round(entryMs(e, now) / 60000))
  }
  const projectTotals = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])

  const runaway = running && isRunaway(running, now) ? running : null

  return (
    <div className="space-y-6">
      {locked && (
        <AlertBanner
          variant="warning"
          title="Viewing as this user"
          message="You can see this time, but starting, stopping and editing are turned off while impersonating."
        />
      )}
      {error && <AlertBanner variant="error" message={error} dismissible onDismiss={() => setError(null)} />}

      {/* Timer bar */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-4 rounded-xl border bg-white px-5 py-4',
          running ? 'border-primary-300 ring-4 ring-primary-50' : 'border-gray-200'
        )}
      >
        <label htmlFor="timer-description" className="sr-only">
          What are you working on?
        </label>
        <input
          id="timer-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => running && description !== (running.description ?? '') && updateRunning({ description })}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (running) (e.target as HTMLInputElement).blur()
            else run(() => startTimer({ description: description.trim() || undefined, projectId: project?.id ?? null }))
          }}
          placeholder="What are you working on?"
          maxLength={500}
          disabled={locked}
          className="h-11 min-w-0 flex-[999_1_240px] bg-transparent text-base font-medium text-gray-900 outline-none placeholder:text-gray-400"
        />
        {groups && (
          <ProjectPicker
            value={project}
            groups={groups}
            onChange={(p) => {
              setProject(p)
              updateRunning({ project: p })
            }}
            onCreate={createProject}
            disabled={locked}
          />
        )}
        <div className="flex flex-col items-end">
          <span className="font-mono text-2xl font-semibold tabular-nums text-gray-900">
            {formatClock(running ? entryMs(running, now) : 0)}
          </span>
          {running && <span className="text-xs text-gray-500">since {formatIn(running.startTime, 'h:mm a', zone)}</span>}
        </div>
        {running ? (
          <Button
            variant="destructive"
            size="lg"
            className="h-12 px-6"
            // A forgotten timer is stopped by saying when, not at now.
            onClick={() => (runaway ? setForgotDismissed(false) : run(() => stopTimer()))}
            disabled={locked || pending}
          >
            <Square className="mr-2 h-4 w-4 fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-12 px-6"
            onClick={() => run(() => startTimer({ description: description.trim() || undefined, projectId: project?.id ?? null }))}
            disabled={locked || pending}
          >
            <Play className="mr-2 h-4 w-4 fill-current" />
            Start
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* Entries by day */}
        <div className="min-w-0 flex-[999_1_560px] space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent time</h2>
            <Button variant="outline" onClick={() => setEditing('new')} disabled={locked}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add time
            </Button>
          </div>

          {byDay.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
              No time yet. Press Start when you begin working, or add time you forgot to track.
            </div>
          )}

          {byDay.map(([key, entries]) => (
            <div key={key} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex justify-between bg-gray-50 px-5 py-3 text-sm">
                <strong>
                  {key === todayKey ? 'Today · ' : ''}
                  {formatIn(entries[0].startTime, 'EEE, MMM d', zone)}
                </strong>
                <span className="font-mono font-semibold">{formatMinutes(countedMinutes(entries, now))}</span>
              </div>
              {entries.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  zone={zone}
                  now={now}
                  locked={locked || pending}
                  onResume={() => resume(e)}
                  onEdit={() => setEditing(e)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Week summary */}
        <div className="min-w-0 flex-[1_1_300px] space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <strong className="text-sm">This week</strong>
              <span className="text-xs text-gray-500">
                {formatIn(data.weekStart, 'MMM d', zone)} – {formatIn(zonedInstant(days[6], '12:00', zone), 'MMM d', zone)}
              </span>
            </div>
            <div className="mb-4 mt-2 font-mono text-3xl font-semibold">{formatMinutes(weekMinutes)}</div>
            <div className="grid h-24 grid-cols-7 items-end gap-2" aria-hidden="true">
              {dayMinutes.map((m, i) => (
                <div
                  key={days[i]}
                  className={cn('rounded', m === 0 ? 'bg-gray-200' : days[i] === todayKey ? 'bg-primary-600' : 'bg-primary-400')}
                  style={{ height: m === 0 ? 2 : `${Math.max(6, (m / maxDay) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-2 text-center text-[11px] text-gray-500">
              {days.map((d) => (
                <span key={d} className={d === todayKey ? 'font-semibold text-primary-700' : ''}>
                  {formatIn(zonedInstant(d, '12:00', zone), 'EEEEE', zone)}
                </span>
              ))}
            </div>
            <ul className="sr-only">
              {days.map((d, i) => (
                <li key={d}>
                  {formatIn(zonedInstant(d, '12:00', zone), 'EEEE', zone)}: {formatMinutes(dayMinutes[i])}
                </li>
              ))}
            </ul>
          </div>

          {data.useProjects && projectTotals.length > 0 && (
            <div className="space-y-3.5 rounded-xl border border-gray-200 bg-white p-5">
              <strong className="text-sm">By project, this week</strong>
              {projectTotals.map(([name, minutes]) => (
                <div key={name}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{name}</span>
                    <span className="font-mono font-semibold">{formatMinutes(minutes)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded bg-gray-100">
                    <div className="h-1.5 rounded bg-primary-600" style={{ width: `${(minutes / Math.max(1, weekMinutes)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <EntryDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        entry={editing === 'new' ? null : editing}
        timeZone={zone}
        projectGroups={groups}
        onCreateProject={createProject}
        onSave={async (v: EntryValues) => {
          const result = await saveEntry(v)
          router.refresh()
          return result
        }}
        onDelete={
          editing && editing !== 'new'
            ? async () => {
                const result = await deleteEntry(editing.id)
                router.refresh()
                return result
              }
            : undefined
        }
      />

      {runaway && !locked && (
        <ForgotDialog
          key={runaway.id}
          entry={runaway}
          zone={zone}
          now={now}
          open={!forgotDismissed}
          onDismiss={() => setForgotDismissed(true)}
          onSave={async (endTime) => {
            const result = await stopTimer({ endTime })
            router.refresh()
            return result
          }}
        />
      )}
    </div>
  )
}

function projectOf(e: EntryView | null): ProjectOption | null {
  return e?.projectId ? { id: e.projectId, name: e.projectName ?? 'Project' } : null
}

function EntryRow({
  entry,
  zone,
  now,
  locked,
  onResume,
  onEdit,
}: {
  entry: EntryView
  zone: string
  now: number
  locked: boolean
  onResume: () => void
  onEdit: () => void
}) {
  const isRunning = !entry.endTime
  const runaway = isRunaway(entry, now)
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 px-5 py-3.5', isRunning && 'bg-primary-50')}>
      <div className="min-w-0 flex-[1_1_220px]">
        <div className="truncate text-[15px] font-medium text-gray-900">{entry.description || 'No description'}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {entry.projectName && (
            <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800">{entry.projectName}</span>
          )}
          {entry.isManual && <span className="text-xs text-gray-500">Added manually</span>}
          {isRunning && (
            <span className={cn('text-xs font-semibold', runaway ? 'text-amber-700' : 'text-primary-700')}>
              {runaway ? 'Forgot to stop?' : 'Running'}
            </span>
          )}
        </div>
      </div>
      <span className="w-36 text-right font-mono text-[13px] text-gray-600">
        {formatIn(entry.startTime, 'h:mm a', zone)} – {entry.endTime ? formatIn(entry.endTime, 'h:mm a', zone) : 'now'}
      </span>
      <span className="w-16 text-right font-mono text-sm font-semibold">{formatMinutes(entryMs(entry, now) / 60000)}</span>
      <div className="flex w-[84px] justify-end gap-1">
        {!isRunning && (
          <Button variant="outline" size="icon-lg" aria-label="Resume this entry" onClick={onResume} disabled={locked}>
            <Play className="h-4 w-4 fill-current" />
          </Button>
        )}
        <Button variant="outline" size="icon-lg" aria-label="Edit entry" onClick={onEdit} disabled={locked}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function ForgotDialog({
  entry,
  zone,
  now,
  open,
  onDismiss,
  onSave,
}: {
  entry: EntryView
  zone: string
  now: number
  open: boolean
  onDismiss: () => void
  onSave: (endTime: string) => Promise<Result>
}) {
  const [date, setDate] = useState(() => dayKey(entry.startTime, zone))
  const [time, setTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  let endAt = date && time ? zonedInstant(date, time, zone) : null
  const minutes = endAt ? Math.round((endAt.getTime() - Date.parse(entry.startTime)) / 60000) : null
  if (minutes !== null && minutes <= 0) endAt = null

  const save = () => {
    if (!endAt) return setError('Enter a time after the timer started.')
    startTransition(async () => {
      const result = await onSave(endAt!.toISOString())
      if (result.error) setError(result.error)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Did you forget to stop your timer?</DialogTitle>
          <DialogDescription>
            {entry.description ? `"${entry.description}"` : 'Your timer'} has been running for{' '}
            <strong className="text-gray-900">{formatMinutes(entryMs(entry, now) / 60000)}</strong>, since{' '}
            {formatIn(entry.startTime, "EEE 'at' h:mm a", zone)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-gray-700">When did you actually stop?</span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="forgot-date" className="sr-only">
                Date
              </Label>
              <input
                id="forgot-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="forgot-time" className="sr-only">
                Time
              </Label>
              <input
                id="forgot-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11 w-full rounded-md border border-gray-300 px-3 text-sm"
              />
            </div>
          </div>
          {endAt && minutes !== null && <p className="text-sm text-gray-600">That makes this entry {formatMinutes(minutes)}.</p>}
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onDismiss} disabled={pending}>
            I&apos;m still working
          </Button>
          <Button onClick={save} isLoading={pending}>
            Save end time
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
