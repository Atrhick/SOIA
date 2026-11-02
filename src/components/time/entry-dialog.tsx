'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ProjectPicker, type ProjectGroup } from '@/components/time/project-picker'
import {
  dayKey,
  entryRangeError,
  formatIn,
  formatMinutes,
  zonedInstant,
  type EntryView,
  type ProjectOption,
} from '@/lib/time'

export interface EntryValues {
  id?: string
  description: string
  projectId: string | null
  startTime: string
  endTime: string | null
  reason?: string
}

type Result = { error?: string }

interface EntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Null adds a new entry. */
  entry: EntryView | null
  timeZone: string
  /** Null hides the project field. */
  projectGroups: ProjectGroup[] | null
  onCreateProject?: (name: string) => Promise<ProjectOption | null>
  /** Admin edits require a reason and are recorded against the admin. */
  requireReason?: boolean
  /** Ask for an end time even on a running timer, to stop one that was forgotten. */
  requireEnd?: boolean
  title?: string
  subtitle?: string
  onSave: (values: EntryValues) => Promise<Result>
  onDelete?: (reason: string) => Promise<Result>
  /** Rendered under the form, e.g. the entry's edit history. */
  children?: ReactNode
}

const inputClass =
  'h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

export function EntryDialog({
  open,
  onOpenChange,
  entry,
  timeZone,
  projectGroups,
  onCreateProject,
  requireReason,
  requireEnd,
  title,
  subtitle,
  onSave,
  onDelete,
  children,
}: EntryDialogProps) {
  // A running timer's end is set by stopping it, unless the caller is fixing one.
  const running = Boolean(entry && !entry.endTime) && !requireEnd
  const [description, setDescription] = useState('')
  const [project, setProject] = useState<ProjectOption | null>(null)
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  // Reset the form each time it opens.
  useEffect(() => {
    if (!open) return
    const now = new Date().toISOString()
    setDescription(entry?.description ?? '')
    setProject(entry?.projectId ? { id: entry.projectId, name: entry.projectName ?? 'Project' } : null)
    setDate(dayKey(entry?.startTime ?? now, timeZone))
    setStart(entry ? formatIn(entry.startTime, 'HH:mm', timeZone) : '')
    setEnd(entry?.endTime ? formatIn(entry.endTime, 'HH:mm', timeZone) : '')
    setReason('')
    setError(null)
    setConfirmDelete(false)
  }, [open, entry, timeZone])

  // Untouched fields keep the entry's exact instants. The inputs only show
  // minutes, so re-reading them would trim seconds off every edit and turn a
  // sub-minute entry (12:52 - 12:52) into an overnight one.
  const original = entry
    ? {
        date: dayKey(entry.startTime, timeZone),
        start: formatIn(entry.startTime, 'HH:mm', timeZone),
        end: entry.endTime ? formatIn(entry.endTime, 'HH:mm', timeZone) : '',
      }
    : null
  const startUnchanged = Boolean(entry && original && date === original.date && start === original.start)
  const endUnchanged = Boolean(entry?.endTime && original && date === original.date && end === original.end)

  // Times are typed as wall-clock times on one date; an end earlier than the
  // start means the entry ran past midnight.
  const startAt = startUnchanged ? new Date(entry!.startTime) : date && start ? zonedInstant(date, start, timeZone) : null
  let endAt = running
    ? null
    : endUnchanged
      ? new Date(entry!.endTime!)
      : date && end
        ? zonedInstant(date, end, timeZone)
        : null
  const overnight = Boolean(startAt && endAt && !endUnchanged && endAt < startAt)
  if (startAt && endAt && overnight) endAt = new Date(endAt.getTime() + 24 * 3600_000)
  const minutes = startAt && endAt ? Math.round((endAt.getTime() - startAt.getTime()) / 60000) : null

  const save = () => {
    setError(null)
    if (!startAt || (!running && !endAt)) {
      setError(running ? 'Enter a start time.' : 'Enter a start and end time.')
      return
    }
    const rangeError = entryRangeError(startAt, endAt)
    if (rangeError) return setError(rangeError)
    if (requireReason && reason.trim().length < 3) return setError('Give a reason for the change.')

    startTransition(async () => {
      const result = await onSave({
        id: entry?.id,
        description: description.trim(),
        projectId: project?.id ?? null,
        startTime: startAt.toISOString(),
        endTime: endAt?.toISOString() ?? null,
        reason: requireReason ? reason.trim() : undefined,
      })
      if (result.error) setError(result.error)
      else onOpenChange(false)
    })
  }

  const remove = () => {
    if (!onDelete) return
    if (requireReason && reason.trim().length < 3) return setError('Give a reason for deleting this entry.')
    if (!confirmDelete) return setConfirmDelete(true)
    startTransition(async () => {
      const result = await onDelete(reason.trim())
      if (result.error) setError(result.error)
      else onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title ?? (entry ? 'Edit time' : 'Add time')}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="entry-description">What did you work on?</Label>
            <input
              id="entry-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className={inputClass}
            />
          </div>

          {projectGroups && (
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Project</span>
              <div>
                <ProjectPicker
                  value={project}
                  groups={projectGroups}
                  onChange={setProject}
                  onCreate={onCreateProject}
                  className="inline-block"
                />
              </div>
            </div>
          )}

          {/* On phones the date gets its own row so it is not cut off. */}
          <div className={running ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'}>
            <div className={running ? 'space-y-1.5' : 'col-span-2 space-y-1.5 sm:col-span-1'}>
              <Label htmlFor="entry-date">Date</Label>
              <input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-start">Start</Label>
              <input id="entry-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
            </div>
            {!running && (
              <div className="space-y-1.5">
                <Label htmlFor="entry-end">End</Label>
                <input id="entry-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
              </div>
            )}
          </div>

          {minutes !== null && minutes > 0 && (
            <div className="flex justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
              <span className="text-gray-600">Duration{overnight ? ' (ends the next day)' : ''}</span>
              <strong>{formatMinutes(minutes)}</strong>
            </div>
          )}
          {running && <p className="text-sm text-gray-600">This timer is still running. Stop it to set the end time.</p>}

          {requireReason && (
            <div className="space-y-1.5">
              <Label htmlFor="entry-reason">
                Reason for the change <span className="text-red-700">(required)</span>
              </Label>
              <Textarea id="entry-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {onDelete && entry && !running ? (
              <Button type="button" variant="ghost" className="text-red-700 hover:text-red-800" onClick={remove} disabled={pending}>
                {confirmDelete ? 'Click again to delete' : 'Delete'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" onClick={save} isLoading={pending}>
                Save
              </Button>
            </div>
          </div>
        </div>

        {children}
      </DialogContent>
    </Dialog>
  )
}
