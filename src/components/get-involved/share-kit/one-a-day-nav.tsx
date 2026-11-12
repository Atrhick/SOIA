import Link from 'next/link'

export type OneADaySection = 'invite' | 'results' | 'follow-ups' | 'profile'

/** Sub-nav for One-A-Day: Today's invite · My results · Follow-ups due (badge) · My invite profile. */
export function OneADayNav({ role, current, followUpsDue }: { role: 'COACH' | 'AMBASSADOR'; current: OneADaySection; followUpsDue: number }) {
  const base = role === 'COACH' ? '/coach' : '/ambassador'
  const items: { key: OneADaySection; label: string; href: string }[] = [
    { key: 'invite', label: "Today's invite", href: `${base}/one-a-day` },
    { key: 'results', label: 'My results', href: `${base}/one-a-day/results` },
    { key: 'follow-ups', label: 'Follow-ups due', href: `${base}/one-a-day/follow-ups` },
    { key: 'profile', label: 'My invite profile', href: `${base}/invite-profile` },
  ]
  return (
    <nav aria-label="One-A-Day" className="-mx-1 overflow-x-auto">
      <ul className="flex gap-1 px-1 min-w-max border-b border-gray-200">
        {items.map((i) => (
          <li key={i.key}>
            <Link href={i.href} aria-current={current === i.key ? 'page' : undefined}
              className={`inline-flex items-center gap-2 min-h-[44px] px-3 text-sm font-semibold border-b-2 -mb-px focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${current === i.key ? 'border-primary-700 text-primary-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
              {i.label}
              {i.key === 'follow-ups' && followUpsDue > 0 && (
                <span className="rounded-full bg-amber-700 text-white text-xs font-bold px-2 py-0.5">{followUpsDue}<span className="sr-only"> due</span></span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
