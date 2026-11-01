'use client'

import { useEffect, useId, useRef, useState } from 'react'
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
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

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
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex h-9 max-w-full items-center gap-1.5 rounded-full px-3 text-sm font-medium disabled:opacity-50',
          value ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-600'
        )}
      >
        <span className="truncate">{value?.name ?? 'No project'}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        >
          <div className="flex items-center gap-2 border-b border-gray-200 px-3">
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
              className="h-11 min-w-0 flex-1 border-0 text-sm outline-none"
            />
          </div>
          <div id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
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
        </div>
      )}
    </div>
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
