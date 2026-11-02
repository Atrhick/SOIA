'use client'

import { useId, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Loader2, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectOption } from '@/lib/time'

export interface ProjectGroup {
  label: string
  options: ProjectOption[]
}

interface ProjectPickerProps {
  value: ProjectOption | null
  groups: ProjectGroup[]
  onChange: (project: ProjectOption | null) => void
  /** When given, typing a name with no match offers to create it. */
  onCreate?: (name: string) => Promise<ProjectOption | null>
  disabled?: boolean
  className?: string
}

/** A searchable project dropdown with "No project" and, optionally, create-by-name. */
export function ProjectPicker({ value, groups, onChange, onCreate, disabled, className }: ProjectPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const listId = useId()

  const q = query.trim().toLowerCase()
  const filtered = groups
    .map((g) => ({ ...g, options: g.options.filter((o) => o.name.toLowerCase().includes(q)) }))
    .filter((g) => g.options.length > 0)
  const exactMatch = groups.some((g) => g.options.some((o) => o.name.toLowerCase() === q))

  const pick = (project: ProjectOption | null) => {
    onChange(project)
    setOpen(false)
    setQuery('')
  }

  const create = async () => {
    if (!onCreate) return
    setCreating(true)
    const project = await onCreate(query.trim())
    setCreating(false)
    if (project) pick(project)
  }

  return (
    // A portalled popover, so a dialog's scrolling can't clip the list and it
    // flips to whichever side has room.
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery('')
      }}
    >
      <Popover.Trigger
        disabled={disabled}
        aria-haspopup="listbox"
        className={cn(
          'inline-flex h-9 max-w-full items-center gap-1.5 rounded-full px-3 text-sm font-medium disabled:opacity-50',
          value ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-600',
          className
        )}
      >
        <span className="truncate">{value?.name ?? 'No project'}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-[60] w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-gray-200 px-3 focus-within:border-primary-500">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && q && !exactMatch && onCreate) {
                  e.preventDefault()
                  create()
                }
              }}
              placeholder={onCreate ? 'Find or create a project' : 'Find a project'}
              aria-label="Find a project"
              aria-controls={listId}
              className="h-11 min-w-0 flex-1 border-0 text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div
            id={listId}
            role="listbox"
            className="max-h-[min(18rem,calc(var(--radix-popover-content-available-height)_-_3rem))] overflow-y-auto py-1"
          >
            {!q && <Option label="No project" muted selected={!value} onClick={() => pick(null)} />}
            {filtered.map((g) => (
              <div key={g.label}>
                <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {g.label}
                </div>
                {g.options.map((o) => (
                  <Option key={o.id} label={o.name} selected={value?.id === o.id} onClick={() => pick(o)} />
                ))}
              </div>
            ))}
            {q && filtered.length === 0 && !onCreate && (
              <p className="px-3 py-2 text-sm text-gray-500">No matching project</p>
            )}
          </div>
          {q && !exactMatch && onCreate && (
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="flex min-h-11 w-full items-center gap-2 border-t border-gray-200 px-3 text-left text-sm font-semibold text-primary-700 hover:bg-primary-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create project &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Option({
  label,
  selected,
  muted,
  onClick,
}: {
  label: string
  selected: boolean
  muted?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-10 w-full items-center justify-between px-3 text-left text-sm hover:bg-gray-50',
        muted ? 'text-gray-600' : 'text-gray-900'
      )}
    >
      <span className="truncate">{label}</span>
      {selected && <Check className="h-4 w-4 text-primary-600" />}
    </button>
  )
}
