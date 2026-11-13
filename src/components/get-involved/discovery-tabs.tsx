import Link from 'next/link'

/** Tabs for the discovery-call pages. Admins get Hosts too; a coach host sees only their own calls and times. */
export function DiscoveryTabs({ active, base = '/admin/discovery-calls', admin = true, tzNote }: { active: string; base?: string; admin?: boolean; tzNote?: string }) {
  const tabs = [
    { href: base, label: admin ? 'Calls' : 'My calls' },
    { href: `${base}/availability`, label: admin ? 'Availability' : 'My times' },
    ...(admin ? [{ href: `${base}/hosts`, label: 'Hosts' }] : []),
  ]
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Discovery Calls</h1>
        <p className="text-gray-600 mt-1">
          {admin
            ? 'The first 15-minute call with each Get Involved prospect.'
            : 'The first call with each Get Involved prospect. Set the times you can take calls, then record what happened after each one.'}
          {tzNote ? ` Times are shown in ${tzNote}.` : ''}
        </p>
      </div>
      <nav aria-label="Discovery calls" className="flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} aria-current={active === t.href ? 'page' : undefined}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${active === t.href ? 'border-primary-700 text-primary-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>{t.label}</Link>
        ))}
      </nav>
    </div>
  )
}
