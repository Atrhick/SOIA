/**
 * PRail: the prospect's progress through the Get Involved journey.
 * Desktop (md and up): a card with the full step list, meant for a left column.
 * Phone: a compact bar ("Step 4 of 7 · Assessment") with a progress track and the step list
 * folded into a native <details>, so nothing scrolls sideways at 390px.
 * Works in server and client components (no hooks). Steps come from railSteps() in core.ts.
 */
import { Check } from 'lucide-react'
import { railSteps, type JourneyStage, type RailStep } from '@/lib/get-involved/core'

interface Props {
  stage: JourneyStage
  role: string | null
  ageRange: string | null
  /** Shown after "Your journey · ", e.g. the role label "Coach". */
  roleLabel?: string | null
  className?: string
}

export function JourneyRail({ stage, role, ageRange, roleLabel, className = '' }: Props) {
  const steps = railSteps({ role, ageRange, stage })
  const currentIdx = steps.findIndex((s) => s.state === 'current')
  const title = `Your journey${roleLabel ? ` · ${roleLabel}` : ''}`
  return (
    <div className={className}>
      {/* Phone */}
      <div className="md:hidden rounded-2xl border border-gray-200 bg-white p-4">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-wide text-primary-800">{title}</span>
              <span className="block truncate text-sm font-semibold text-gray-900">
                {currentIdx >= 0 ? `Step ${currentIdx + 1} of ${steps.length} · ${steps[currentIdx].label}` : `${steps.length} steps`}
              </span>
            </span>
            <span className="flex-none text-sm font-semibold text-primary-700 group-open:hidden">All steps</span>
            <span className="hidden flex-none text-sm font-semibold text-primary-700 group-open:inline">Hide</span>
          </summary>
          <StepList steps={steps} className="mt-3" />
        </details>
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {steps.map((s) => (
            <span key={s.key} className={`h-1.5 flex-1 rounded-full ${s.state === 'done' ? 'bg-green-500' : s.state === 'current' ? 'bg-primary-700' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      {/* Desktop */}
      <nav aria-label="Your progress" className="hidden md:flex flex-col gap-1.5 rounded-2xl border border-gray-200 bg-white p-5">
        <span className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-primary-800">{title}</span>
        <StepList steps={steps} />
      </nav>
    </div>
  )
}

function StepList({ steps, className = '' }: { steps: RailStep[]; className?: string }) {
  return (
    <ol className={`flex flex-col gap-1.5 ${className}`}>
      {steps.map((s, i) => {
        const now = s.state === 'current'
        const done = s.state === 'done'
        return (
          <li key={s.key} aria-current={now ? 'step' : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${now ? 'bg-sky-100 font-bold text-primary-800' : done ? 'font-medium text-green-800' : 'text-gray-600'}`}>
            <span aria-hidden="true" className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${now ? 'bg-primary-700 text-white' : done ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span>{s.label}</span>
            <span className="sr-only">{done ? ' (done)' : now ? ' (current step)' : ''}</span>
          </li>
        )
      })}
    </ol>
  )
}
