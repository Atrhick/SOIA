/**
 * Program info workflow, owner screens: shared looks (from the approved mockups). No hooks, so server
 * and client components can both use it.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { CoachTone } from '@/lib/program-info/stage'
import { programsHome, type OwnerRole } from '@/lib/program-info/paths'

const ring = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2'

export const ui = {
  ring,
  /** One per screen. */
  primary: `inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-[17px] font-bold text-white no-underline hover:bg-violet-800 disabled:opacity-60 ${ring}`,
  primarySm: `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-violet-700 px-5 text-[15px] font-bold text-white no-underline hover:bg-violet-800 disabled:opacity-60 ${ring}`,
  outline: `inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-violet-700 bg-white px-5 text-base font-bold text-violet-800 no-underline hover:bg-violet-50 disabled:opacity-60 ${ring}`,
  secondary: `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-white px-4 text-[15px] font-semibold text-gray-900 no-underline hover:bg-gray-50 disabled:opacity-60 ${ring}`,
  danger: `inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-base font-bold text-white hover:bg-red-800 disabled:opacity-60 ${ring}`,
  link: `inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-violet-800 hover:text-violet-900 ${ring}`,
  card: 'rounded-2xl border border-gray-200 bg-white',
  box: 'w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-base leading-relaxed text-gray-900 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/30 disabled:bg-gray-50 disabled:text-gray-700',
  label: 'block text-[17px] font-bold leading-snug text-gray-900',
  labelSm: 'block text-[15px] font-semibold text-gray-900',
  hint: 'm-0 text-sm leading-relaxed text-gray-600',
  example: 'm-0 rounded-[10px] bg-gray-50 px-2.5 py-2 text-sm leading-relaxed text-gray-700',
  part: 'm-0 text-[13px] font-bold uppercase tracking-[.05em] text-violet-800',
  optional: 'font-medium text-gray-600',
}

/** The status pill colours: blue = waiting for you, amber = the team is on it, green = live. */
export function pillClass(label: string, tone: CoachTone): string {
  const base = 'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-bold'
  if (label === 'Ready for you to check' || label === 'Question from the team') return `${base} bg-blue-100 text-blue-800`
  if (tone === 'waiting') return `${base} bg-amber-100 text-amber-800`
  if (tone === 'live') return `${base} bg-green-100 text-green-800`
  if (tone === 'offline') return `${base} bg-red-50 text-red-800`
  return `${base} bg-gray-100 text-gray-700`
}

export function Pill({ label, tone }: { label: string; tone: CoachTone }) {
  return <span className={pillClass(label, tone)}>{label}</span>
}

export function BackLink({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={`${ui.link} -ml-1 no-underline ${className}`}>
      <ChevronLeft className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  )
}

/** "My programs › Financial Empowerment › Families page" (computer layout). */
/**
 * Breadcrumb for one page: My programs › <Program> › <Group> page. A one-group program skips the program
 * step, which would only repeat the page name ("My programs › Start your business page").
 */
export function pageCrumbItems(role: OwnerRole, p: { audienceLabel: string | null; programName: string; pageName: string }): { label: string; href?: string }[] {
  const home = { label: 'My programs', href: programsHome(role) }
  return p.audienceLabel ? [home, { label: p.programName, href: programsHome(role) }, { label: p.pageName }] : [home, { label: p.pageName }]
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-600">
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1.5 p-0">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>›</span>}
            {it.href ? <Link href={it.href} className="font-semibold text-violet-800 no-underline hover:underline">{it.label}</Link> : <span aria-current="page">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Shown while an admin is viewing as this person: everything is visible, nothing can be changed. */
export function ViewingAsBanner() {
  return (
    <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[15px] leading-relaxed text-amber-900">
      <b>Viewing as this person.</b> You can see everything, but changes are turned off while impersonating.
    </div>
  )
}

export function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}
