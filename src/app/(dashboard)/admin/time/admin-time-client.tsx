'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Archive, ArchiveRestore, ChevronDown, ChevronLeft, ChevronRight, Download, Pencil, Plus } from 'lucide-react'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { EntryDialog } from '@/components/time/entry-dialog'
import type { ProjectGroup } from '@/components/time/project-picker'
import { useNow } from '@/components/time/use-now'
import { cn } from '@/lib/utils'
import { countedMinutes, dayKey, entryMs, formatHM, formatIn, formatMinutes, isRunaway, type EntryView } from '@/lib/time'
import {
  adminDeleteEntry,
  adminUpdateEntry,
  createSharedProject,
  getEntryHistory,
  updateProject,
  type EntryHistoryItem,
  type Timesheet,
  type TimesheetPerson,
} from '@/lib/actions/admin-time'

type Editing = { person: TimesheetPerson; entry: EntryView }

// Keeps names in view while the day columns scroll sideways on narrow screens.
const stickyCol = 'sticky left-0 z-10'

export function AdminTimeClient({ data }: { data: Timesheet }) {
  const router = useRouter()
  const now = useNow(data.asOf)
  const zone = data.timeZone
  const [view, setView] = useState<'people' | 'projects'>('people')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dayKeys = data.days.map((d) => dayKey(d, zone))
  const inWeek = (e: EntryView) => dayKeys.includes(dayKey(e.startTime, zone))

  const running = data.people.flatMap((p) => p.entries.filter((e) => !e.endTime).map((e) => ({ person: p, entry: e })))
  const working = running.filter((r) => !isRunaway(r.entry, now))
  const runaways = running.filter((r) => isRunaway(r.entry, now))

  const weekEntries = data.people.flatMap((p) => p.entries.filter(inWeek))
  const weekTotal = countedMinutes(weekEntries, now)

  // The projects this person could pick themselves: ambassadors only see shared ones.
  const projectGroupsFor = (person: TimesheetPerson): ProjectGroup[] => [
    { label: 'NT projects', options: data.projects.filter((p) => p.isShared && !p.archived) },
    {
      label: `${person.name}'s projects`,
      options:
        person.role === 'COACH'
          ? data.projects.filter((p) => !p.isShared && !p.archived && p.ownerId === person.userId)
          : [],
    },
  ]

  const exportCsv = () => {
    const header = ['Person', 'Role', 'Date', 'Start', 'End', 'Hours', 'Project', 'Description', 'Added manually']
    const rows = data.people.flatMap((p) =>
      p.entries.filter(inWeek).map((e) => [
        p.name,
        p.role,
        formatIn(e.startTime, 'yyyy-MM-dd', zone),
        formatIn(e.startTime, 'HH:mm', zone),
        e.endTime ? formatIn(e.endTime, 'HH:mm', zone) : 'running',
        isRunaway(e, now) ? '' : (entryMs(e, now) / 3600_000).toFixed(2),
        e.projectName ?? '',
        e.description ?? '',
        e.isManual ? 'yes' : 'no',
      ])
    )
    const csv = [header, ...rows]
      // A leading = + - @ would run as a formula in Excel; prefix a quote.
      .map((r) => r.map((cell) => `"${String(cell).replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheet-${dayKeys[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const weekLink = (offset: number) => (offset === 0 ? '/admin/time' : `/admin/time?week=${offset}`)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white">
          <Link href={weekLink(data.weekOffset - 1)} aria-label="Previous week" className="flex h-10 w-10 items-center justify-center text-gray-700">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="px-2 text-sm font-medium">
            {formatIn(data.days[0], 'MMM d', zone)} – {formatIn(data.days[6], 'MMM d, yyyy', zone)}
          </span>
          {data.weekOffset < 0 ? (
            <Link href={weekLink(data.weekOffset + 1)} aria-label="Next week" className="flex h-10 w-10 items-center justify-center text-gray-700">
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center text-gray-300" aria-hidden="true">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5" role="tablist">
          {(['people', 'projects'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                'h-9 rounded-md px-3 text-sm capitalize',
                view === v ? 'bg-primary-100 font-semibold text-primary-800' : 'text-gray-600'
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <Button variant="outline" className="h-10" onClick={exportCsv} disabled={weekEntries.length === 0}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {error && <AlertBanner variant="error" message={error} dismissible onDismiss={() => setError(null)} />}

      {(working.length > 0 || runaways.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {working.length > 0 && (
            <div className="flex flex-[1_1_360px] flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span className="h-2 w-2 rounded-full bg-green-600" />
                Working now
              </span>
              {working.map(({ person, entry }) => (
                <span key={entry.id} className="rounded-full bg-gray-100 px-2.5 py-1 text-sm">
                  {person.name} · <span className="font-mono">{formatHM(entryMs(entry, now) / 60000)}</span>
                </span>
              ))}
            </div>
          )}
          {runaways.map(({ person, entry }) => (
            <div
              key={entry.id}
              className="flex flex-[1_1_360px] items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="flex-1">
                {person.name}&apos;s timer has run <strong>{formatMinutes(entryMs(entry, now) / 60000)}</strong>. It&apos;s left out of the
                totals until it&apos;s fixed.
              </span>
              <button type="button" onClick={() => setEditing({ person, entry })} className="font-semibold text-primary-700 hover:text-primary-800">
                Fix
              </button>
            </div>
          ))}
        </div>
      )}

      {view === 'people' ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600">
                <th className={cn(stickyCol, 'bg-gray-50 px-4 py-3 text-left')}>Person</th>
                {data.days.map((d) => (
                  <th key={d} className="px-3 py-3 text-right">
                    {formatIn(d, 'EEE', zone)}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-gray-900">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.people.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                    No time was recorded this week.
                  </td>
                </tr>
              )}
              {data.people.map((person) => {
                const entries = person.entries.filter((e) => inWeek(e) || !e.endTime)
                const flagged = entries.some((e) => isRunaway(e, now))
                const open = expanded === person.userId
                return (
                  <Fragment key={person.userId}>
                    <tr className={cn('border-b border-gray-100', flagged && 'bg-amber-50')}>
                      <td className={cn(stickyCol, 'px-4 py-3', flagged ? 'bg-amber-50' : 'bg-white')}>
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setExpanded(open ? null : person.userId)}
                          className="inline-flex items-center gap-1.5 font-semibold text-gray-900"
                        >
                          <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
                          {person.name}
                        </button>{' '}
                        <span className="text-xs text-gray-500">{roleLabel(person.role)}</span>
                      </td>
                      {dayKeys.map((key) => {
                        const dayEntries = entries.filter((e) => dayKey(e.startTime, zone) === key)
                        const hasRunaway = dayEntries.some((e) => isRunaway(e, now))
                        const minutes = countedMinutes(dayEntries, now)
                        return (
                          <td key={key} className="px-3 py-3 text-right font-mono text-[13px]">
                            {hasRunaway ? (
                              <span className="font-semibold text-amber-700" title="Timer left running">
                                needs fix
                              </span>
                            ) : minutes > 0 ? (
                              formatHM(minutes)
                            ) : (
                              <span className="text-gray-300">–</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right font-mono text-[13px] font-semibold">
                        {formatHM(countedMinutes(entries.filter(inWeek), now))}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        <td colSpan={9} className="p-0">
                          {/* Pinned to the visible width, so a phone does not have to scroll sideways through 860px of entries. */}
                          <div className="sticky left-0 pb-3 pl-10 pr-4 pt-1 max-sm:w-[calc(100vw-2rem-2px)] sm:max-lg:w-[calc(100vw-3rem-2px)]">
                          {entries.map((e) => (
                            <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-200 py-2.5 last:border-0">
                              <span className="w-24 text-[13px] text-gray-600">{formatIn(e.startTime, 'EEE MMM d', zone)}</span>
                              <span className="min-w-0 flex-[1_1_200px] text-sm">
                                {e.description || 'No description'}
                                <span className="text-xs text-gray-500"> · {e.projectName ?? 'No project'}</span>
                                {e.isManual && (
                                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">ADDED MANUALLY</span>
                                )}
                              </span>
                              <span className={cn('font-mono text-[13px]', isRunaway(e, now) ? 'text-amber-700' : 'text-gray-600')}>
                                {formatIn(e.startTime, 'h:mm a', zone)} – {e.endTime ? formatIn(e.endTime, 'h:mm a', zone) : 'still running'}
                                {e.endTime && ` · ${formatHM(entryMs(e, now) / 60000)}`}
                              </span>
                              <Button variant="outline" size="sm" onClick={() => setEditing({ person, entry: e })}>
                                <Pencil className="mr-1 h-3.5 w-3.5" />
                                {e.endTime ? 'Edit' : 'Fix'}
                              </Button>
                            </div>
                          ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            {data.people.length > 0 && (
              <tfoot>
                <tr className="font-mono text-[13px]">
                  <td className={cn(stickyCol, 'bg-white px-4 py-3 font-sans font-semibold')}>All people</td>
                  {dayKeys.map((key) => (
                    <td key={key} className="px-3 py-3 text-right">
                      {formatHM(countedMinutes(weekEntries.filter((e) => dayKey(e.startTime, zone) === key), now))}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold">{formatHM(weekTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <ProjectsView data={data} weekEntries={weekEntries} now={now} onError={setError} />
      )}

      <p className="text-sm text-gray-500">
        Click a person to see their entries. Every admin edit asks for a reason and is kept in the entry&apos;s history.
      </p>

      {editing && (
        <EntryDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          entry={editing.entry}
          timeZone={zone}
          projectGroups={projectGroupsFor(editing.person)}
          requireReason
          requireEnd
          title={`Edit entry · ${editing.person.name}`}
          subtitle={editing.entry.endTime ? undefined : 'This timer is still running. Set the time they actually stopped.'}
          onSave={async (v) => {
            const result = await adminUpdateEntry(v)
            router.refresh()
            return result
          }}
          onDelete={async (reason) => {
            const result = await adminDeleteEntry({ id: editing.entry.id, reason })
            router.refresh()
            return result
          }}
        >
          <EntryHistory entryId={editing.entry.id} zone={zone} />
        </EntryDialog>
      )}
    </div>
  )
}

function roleLabel(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, ' ')
}

function EntryHistory({ entryId, zone }: { entryId: string; zone: string }) {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getEntryHistory>> | null>(null)

  useEffect(() => {
    let live = true
    getEntryHistory(entryId).then((h) => live && setHistory(h))
    return () => {
      live = false
    }
  }, [entryId])

  if (!history) return <p className="border-t border-gray-200 pt-3 text-sm text-gray-500">Loading history…</p>
  if ('error' in history) return null

  return (
    <div className="space-y-2.5 border-t border-gray-200 pt-3">
      <strong className="text-sm text-gray-700">History</strong>
      <HistoryLine
        at={history.createdAt}
        zone={zone}
        text={`${history.isManual ? 'Added manually' : 'Started with the timer'} by ${history.createdBy}`}
      />
      {history.changes.map((c, i) => (
        <HistoryLine key={i} at={c.at} zone={zone} text={describeChange(c, zone)} reason={c.reason} />
      ))}
    </div>
  )
}

function HistoryLine({ at, zone, text, reason }: { at: string; zone: string; text: string; reason?: string | null }) {
  return (
    <div className="flex gap-2.5 text-[13px] leading-snug">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-400" />
      <div>
        <div>{text}</div>
        {reason && <div className="text-gray-700">Reason: {reason}</div>}
        <div className="text-gray-500">{formatIn(at, "EEE MMM d, h:mm a", zone)}</div>
      </div>
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  description: 'description',
  projectId: 'project',
  startTime: 'start',
  endTime: 'end',
}

function describeChange(c: EntryHistoryItem, zone: string) {
  const show = (field: string, v: string | null) => {
    if (v === null) return field === 'endTime' ? 'running' : 'none'
    return field === 'startTime' || field === 'endTime' ? formatIn(v, 'MMM d h:mm a', zone) : field === 'projectId' ? 'changed' : `"${v}"`
  }
  const parts = Object.entries(c.diff).map(([field, [before, after]]) =>
    field === 'projectId' ? 'changed the project' : `${FIELD_LABELS[field] ?? field} ${show(field, before)} → ${show(field, after)}`
  )
  return `${c.editorName ?? 'Someone'} changed ${parts.join(', ')}`
}

function ProjectsView({
  data,
  weekEntries,
  now,
  onError,
}: {
  data: Timesheet
  weekEntries: EntryView[]
  now: number
  onError: (message: string) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  const minutesFor = (projectId: string | null) =>
    countedMinutes(weekEntries.filter((e) => e.projectId === projectId), now)

  const act = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn()
      if (result.error) onError(result.error)
      else after?.()
      router.refresh()
    })

  const shared = data.projects.filter((p) => p.isShared)
  const personal = data.projects.filter((p) => !p.isShared)

  const rows = (list: typeof data.projects, label: string) => (
    <>
      <tr className="bg-gray-50">
        <td colSpan={4} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </td>
      </tr>
      {list.length === 0 && (
        <tr>
          <td colSpan={4} className="px-4 py-3 text-gray-500">
            None yet
          </td>
        </tr>
      )}
      {list.map((p) => (
        <tr key={p.id} className={cn('border-b border-gray-100', p.archived && 'text-gray-500')}>
          <td className="px-4 py-3">
            {renaming?.id === p.id ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  act(() => updateProject({ id: p.id, name: renaming.name }), () => setRenaming(null))
                }}
              >
                <input
                  autoFocus
                  aria-label="Project name"
                  value={renaming.name}
                  onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                  className="h-9 min-w-0 flex-1 rounded-md border border-gray-300 px-2"
                />
                <Button size="sm" type="submit" disabled={pending}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setRenaming(null)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <>
                <span className="font-medium text-gray-900">{p.name}</span>
                {p.archived && <span className="ml-2 text-xs">(archived)</span>}
              </>
            )}
          </td>
          <td className="px-4 py-3 text-gray-600">{p.isShared ? 'Everyone' : p.ownerName}</td>
          <td className="px-4 py-3 text-right font-mono text-[13px]">{formatHM(minutesFor(p.id))}</td>
          <td className="px-4 py-3 text-right">
            <div className="flex justify-end gap-1">
              <Button size="icon" variant="ghost" aria-label={`Rename ${p.name}`} onClick={() => setRenaming({ id: p.id, name: p.name })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={p.archived ? `Restore ${p.name}` : `Archive ${p.name}`}
                title={p.archived ? 'Restore' : 'Archive'}
                onClick={() => act(() => updateProject({ id: p.id, archived: !p.archived }))}
                disabled={pending}
              >
                {p.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
            </div>
          </td>
        </tr>
      ))}
    </>
  )

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          act(() => createSharedProject(newName), () => setNewName(''))
        }}
      >
        <input
          aria-label="New shared project name"
          placeholder="New shared project, e.g. Community Garden Build"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={100}
          className="h-10 min-w-0 flex-[1_1_280px] rounded-md border border-gray-300 bg-white px-3 text-sm"
        />
        <Button type="submit" className="h-10" disabled={pending || !newName.trim()}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add shared project
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs font-semibold text-gray-600">
              <th className="px-4 py-3 text-left">Project</th>
              <th className="px-4 py-3 text-left">Used by</th>
              <th className="px-4 py-3 text-right">Hours this week</th>
              <th className="px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows(shared, 'NT projects (everyone sees these)')}
            {rows(personal, "Coaches' own projects")}
            <tr className="border-t border-gray-200">
              <td className="px-4 py-3 text-gray-600">No project</td>
              <td />
              <td className="px-4 py-3 text-right font-mono text-[13px]">{formatHM(minutesFor(null))}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
