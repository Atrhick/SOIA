import Link from 'next/link'

export type OneADaySection = 'invite' | 'follow-ups' | 'playbook' | 'results'

/**
 * The same four tabs on every One-A-Day page: Invite · Follow-ups (badge) · Playbook · Results.
 * Labels are short so all four fit a 375px phone without sideways scrolling. The invite profile is a
 * link inside Invite, not a tab.
 */
export function OneADayNav({ role, current, followUpsDue }: { role: 'COACH' | 'AMBASSADOR'; current: OneADaySection | null; followUpsDue: number }) {
  const base = role === 'COACH' ? '/coach' : '/ambassador'
  const items: { key: OneADaySection; label: string; href: string }[] = [
    { key: 'invite', label: 'Invite', href: `${base}/one-a-day` },
    { key: 'follow-ups', label: 'Follow-ups', href: `${base}/one-a-day/follow-ups` },
    { key: 'playbook', label: 'Playbook', href: `${base}/one-a-day/playbook` },
    { key: 'results', label: 'Results', href: `${base}/one-a-day/results` },
  ]
  return (
    <nav aria-label="One-A-Day">
      <ul className="grid grid-cols-4 border-b border-gray-200">
        {items.map((i) => (
          <li key={i.key} className="min-w-0">
            <Link href={i.href} aria-current={current === i.key ? 'page' : undefined}
              className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 border-b-[3px] -mb-px px-1 py-1 text-[15px] font-semibold sm:min-h-[48px] sm:flex-row sm:gap-1.5 sm:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${current === i.key ? 'border-primary-700 text-primary-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
              <span className="whitespace-nowrap">{i.label}</span>
              {i.key === 'follow-ups' && followUpsDue > 0 && (
                // Under the label on a phone (never covers it), beside it on wider screens.
                <span className="min-w-[24px] rounded-full bg-amber-700 px-1.5 text-center text-sm font-bold leading-5 text-white">
                  {followUpsDue > 99 ? '99+' : followUpsDue}<span className="sr-only"> due</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
