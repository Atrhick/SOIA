import Link from 'next/link'

const TABS = [
  { href: '/admin/discovery-calls', label: 'Calls' },
  { href: '/admin/discovery-calls/availability', label: 'Availability' },
  { href: '/admin/discovery-calls/hosts', label: 'Hosts' },
]

export function DiscoveryTabs({ active }: { active: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Discovery Calls</h1>
        <p className="text-gray-600 mt-1">The first call with each Get Involved prospect. Hosts and their age ranges are set on the Hosts tab.</p>
      </div>
      <nav aria-label="Discovery calls" className="flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={active === t.href ? 'page' : undefined}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${active === t.href ? 'border-primary-700 text-primary-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>{t.label}</Link>
        ))}
      </nav>
    </div>
  )
}
