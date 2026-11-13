'use client'

import { useState, type RefObject } from 'react'
import { ChevronDown, Lightbulb } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import type { LineIdea } from '@/lib/get-involved/scripts'

const FIRST_SHOWN = 3

/**
 * Tap-to-use ideas under a "why you thought of them" box. Picking one puts it in the box and selects the
 * first [bracket] so the member can type over it straight away.
 */
export function LineIdeasPicker({ ideas, onPick, target, id }: {
  ideas: LineIdea[]
  onPick: (line: string) => void
  /** The box the idea goes into (focused after picking). */
  target: RefObject<HTMLTextAreaElement | null>
  id: string
}) {
  const [all, setAll] = useState(false)
  if (!ideas.length) return null
  const shown = all ? ideas : ideas.slice(0, FIRST_SHOWN)

  function pick(line: string) {
    onPick(line)
    setTimeout(() => {
      const el = target.current
      if (!el) return
      el.focus()
      const start = line.indexOf('[')
      const end = start >= 0 ? line.indexOf(']', start) : -1
      if (start >= 0 && end > start) el.setSelectionRange(start, end + 1)
      else el.setSelectionRange(line.length, line.length)
    }, 0)
  }

  return (
    <div className="mt-2 rounded-xl bg-amber-50 p-3" role="group" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="flex items-center gap-1.5 text-sm font-semibold text-amber-950">
        <Lightbulb className="h-4 w-4 flex-none" aria-hidden />Not sure what to write? Tap an idea, then make it yours.
      </p>
      <ul className="mt-2 space-y-1.5">
        {shown.map((i) => (
          <li key={i.line}>
            <button type="button" onClick={() => pick(i.line)}
              className={`w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-left hover:border-primary-600 ${kit.ring}`}>
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{i.when}</span>
              <span className="block text-sm text-gray-900">{i.line}</span>
            </button>
          </li>
        ))}
      </ul>
      {ideas.length > FIRST_SHOWN && (
        <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className={`${kit.quiet} mt-1`}>
          <ChevronDown className={`h-4 w-4 transition-transform ${all ? 'rotate-180' : ''}`} aria-hidden />
          {all ? 'Fewer ideas' : `${ideas.length - FIRST_SHOWN} more ideas`}
        </button>
      )}
      <p className="mt-1.5 text-xs text-gray-700">Change the part in [brackets] to what you know about them. Only use what they told you themselves.</p>
    </div>
  )
}
