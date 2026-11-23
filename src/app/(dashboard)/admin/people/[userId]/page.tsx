import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ExternalLink, Mail, Phone, Settings, UserRound } from 'lucide-react'
import { auth } from '@/lib/auth'
import { loadPersonHub } from '@/lib/people/hub'
import { ago, listWords, signInLine, splitAreas, type Area } from '@/lib/people/hub-core'
import { kit } from '@/components/ui/kit/styles'
import { ViewAsButton } from '@/components/people/view-as-button'

export const dynamic = 'force-dynamic'

const fmtJoined = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
const small = `inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 text-base font-semibold text-gray-900 hover:bg-gray-50 ${kit.ring}`
const textLink = `font-semibold text-primary-700 underline-offset-2 hover:underline ${kit.ring} rounded`

export default async function PersonPage({ params }: { params: { userId: string } }) {
  const session = await auth()
  // Admins only (not sub-admins), checked before any query about the person.
  if (!session || session.user.role !== 'ADMIN') redirect('/login')

  const now = new Date()
  const hub = await loadPersonHub(params.userId, now)
  if (!hub) notFound()
  const h = hub.header
  const { shown, nothingYet } = splitAreas(hub.areas)
  const isMe = h.userId === session.user.id
  const viewAs = isMe || session.user.isImpersonating ? [] : h.viewAs

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin/users" className={`inline-flex min-h-[44px] items-center gap-1 text-base text-gray-700 hover:text-gray-900 ${kit.ring} rounded`}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> All users
      </Link>

      {/* Who they are */}
      <section aria-labelledby="person-name" className={`${kit.card} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700" aria-hidden>
              {(h.name?.[0] || '?').toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 id="person-name" className="break-words text-2xl font-bold text-gray-900">{h.name}</h1>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {h.roleLabels.map((r) => (
                  <span key={r} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-sm font-semibold text-primary-800">{r}</span>
                ))}
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${h.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : h.status === 'SUSPENDED' ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-800'}`}>
                  Account {h.statusLabel.toLowerCase()}
                </span>
                {h.coachStatusLabel && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-800">Coach: {h.coachStatusLabel.toLowerCase()}</span>}
                {h.ambassadorStatusLabel && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-800">Ambassador: {h.ambassadorStatusLabel.toLowerCase()}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {viewAs.map((r) => (
              <ViewAsButton key={r} userId={h.userId} role={r} firstName={h.firstName} showRole={viewAs.length > 1} />
            ))}
            <Link href={`/admin/users?q=${encodeURIComponent(h.email)}`} className={kit.secondary}>
              <Settings className="h-4 w-4" aria-hidden /> Edit account
            </Link>
            {h.coachProfileId && (
              <Link href={`/admin/coaches/${h.coachProfileId}`} className={kit.secondary}>
                <UserRound className="h-4 w-4" aria-hidden /> Coach record
              </Link>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-base sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-sm font-semibold text-gray-600">Email</dt>
            <dd className="flex items-center gap-1.5 break-all text-gray-900"><Mail className="h-4 w-4 flex-none text-gray-500" aria-hidden /><a href={`mailto:${h.email}`} className={textLink}>{h.email}</a></dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm font-semibold text-gray-600">Phone</dt>
            <dd className="flex items-center gap-1.5 text-gray-900"><Phone className="h-4 w-4 flex-none text-gray-500" aria-hidden />{h.phone ? <a href={`tel:${h.phone.replace(/[^\d+]/g, '')}`} className={textLink}>{h.phone}</a> : 'Not given'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm font-semibold text-gray-600">Joined</dt>
            <dd className="text-gray-900">{fmtJoined(h.joinedAt)}{h.age !== null ? ` · age ${h.age}` : ''}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm font-semibold text-gray-600">Signing in</dt>
            <dd className="text-gray-900">{signInLine(h.lastLoginAt, h.lastSeenAt, now)}</dd>
          </div>
          {h.coach && (
            <div className="min-w-0">
              <dt className="text-sm font-semibold text-gray-600">Their coach</dt>
              <dd className="text-gray-900">{h.coach.href ? <Link href={h.coach.href} className={textLink}>{h.coach.name}</Link> : h.coach.name}</dd>
            </div>
          )}
          {h.parent && (
            <div className="min-w-0">
              <dt className="text-sm font-semibold text-gray-600">Parent or guardian</dt>
              <dd className="break-words text-gray-900">
                {h.parent.href ? <Link href={h.parent.href} className={textLink}>{h.parent.name}</Link> : h.parent.name}
                {h.parent.sub && <span className="block break-all text-sm text-gray-600">{h.parent.sub}</span>}
              </dd>
            </div>
          )}
          {h.children.length > 0 && (
            <div className="min-w-0">
              <dt className="text-sm font-semibold text-gray-600">Their child</dt>
              <dd className="text-gray-900">
                {h.children.map((c) => (
                  <span key={c.name} className="block">
                    {c.href ? <Link href={c.href} className={textLink}>{c.name}</Link> : c.name}
                    {c.sub && <span className="text-sm text-gray-600"> · {c.sub}</span>}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Where they are active */}
      <section aria-labelledby="areas-title" className="space-y-3">
        <h2 id="areas-title" className="text-xl font-bold text-gray-900">Where {h.firstName} is active</h2>
        {shown.length === 0 ? (
          <p className={`${kit.card} text-base text-gray-700`}>Nothing yet. {h.firstName} hasn&apos;t started anything in the app.</p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {shown.map((a) => <AreaCard key={a.key} area={a} />)}
          </div>
        )}
        {nothingYet.length > 0 && (
          <p className="text-base text-gray-700"><span className="font-semibold">Nothing yet in:</span> {listWords(nothingYet)}.</p>
        )}
      </section>

      {/* Recent activity */}
      <section aria-labelledby="activity-title" className={`${kit.card} space-y-3`}>
        <h2 id="activity-title" className="text-xl font-bold text-gray-900">Recent activity</h2>
        <p className="text-base text-gray-700">
          {h.lastSeenAt ? `Last active in the app ${ago(h.lastSeenAt, now)}.` : 'No visits to the app recorded yet.'}
          {h.lastLoginAt ? ` Last signed in ${ago(h.lastLoginAt, now)}.` : ''}
        </p>
        {hub.activity.length === 0 ? (
          <p className="text-base text-gray-600">No recorded changes yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {hub.activity.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
                <span className="min-w-0 break-words text-base text-gray-900">
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-bold ${l.byThem ? 'bg-primary-50 text-primary-800' : 'bg-gray-100 text-gray-700'}`}>{l.byThem ? 'They did' : 'Done to them'}</span>
                  {l.text}
                </span>
                <span className="text-sm text-gray-600">{ago(l.at, now)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/audit-logs" className={small}>Open the full audit log</Link>
      </section>
    </div>
  )
}

function AreaCard({ area }: { area: Area }) {
  return (
    <article className={`${kit.card} flex min-w-0 flex-col gap-3`}>
      <div className="min-w-0">
        <h3 className="text-lg font-bold text-gray-900">{area.title}</h3>
        <p className="mt-0.5 text-base text-gray-700">{area.status}</p>
      </div>
      {area.items && area.items.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {area.items.map((i, n) => (
            <li key={`${i.label}-${n}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
              <span className="min-w-0">
                <span className="block break-words text-base font-semibold text-gray-900">
                  {i.href ? <Link href={i.href} className={textLink}>{i.label}</Link> : i.label}
                </span>
                {i.sub && <span className="block break-words text-sm text-gray-600">{i.sub}</span>}
              </span>
              {i.secondary && (
                <a href={i.secondary.href} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-[44px] items-center gap-1 text-sm ${textLink}`}>
                  {i.secondary.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </li>
          ))}
          {area.more ? <li className="px-3 py-2 text-sm text-gray-600">and {area.more} more</li> : null}
        </ul>
      )}
      {area.note && <p className="text-sm text-gray-600">{area.note}</p>}
      {area.links.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-2">
          {area.links.map((l, n) => (
            <Link key={l.href} href={l.href} className={n === 0 ? small.replace('border-gray-300', 'border-primary-600').replace('text-gray-900', 'text-primary-800') : small}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
