import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ChevronRight, Search } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { Pager } from '@/components/ui/pager'
import { cn } from '@/lib/utils'
import { INBOX_FILTERS, INBOX_FILTER_LABEL, canAssign, parseFilter, takesOnReply, teamBase, type Viewer } from '@/lib/support/core'
import { INBOX_PAGE_SIZE, inboxCounts, loadAssignees, loadInbox, loadTeamThread } from '@/lib/support/server'
import { StatusPill, fmtWhen } from './status-pill'
import { ThreadView } from './thread-view'
import { AssignBox, StatusBox, TeamReplyForm } from './team-actions'

/** The support inbox for admins (/admin/support) and sub-admins (/team/support). */
export async function TeamInbox({ viewer, searchParams }: { viewer: Viewer; searchParams: { filter?: string; q?: string; page?: string } }) {
  const base = teamBase(viewer.role)
  const filter = parseFilter(searchParams.filter)
  const q = (searchParams.q ?? '').trim().slice(0, 100)
  const page = Math.max(1, Math.floor(Number(searchParams.page) || 1))
  const [{ rows, total }, counts] = await Promise.all([loadInbox(viewer, filter, q, page), inboxCounts(viewer)])
  const href = (f: string) => `${base}?${new URLSearchParams({ filter: f, ...(q ? { q } : {}) }).toString()}`

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support inbox</h1>
        <p className="mt-1 text-base text-gray-600">
          Messages from coaches, ambassadors and associates.{' '}
          {viewer.role === 'ADMIN'
            ? 'Assign each new one to someone on the team. Senders only ever see “the NowTRANSFORMED team”, never a name.'
            : 'You see the messages assigned to you, plus new ones waiting for an admin to assign them.'}
        </p>
      </div>

      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {INBOX_FILTERS.map((f) => (
          <Link
            key={f}
            href={href(f)}
            aria-current={f === filter ? 'page' : undefined}
            className={cn('inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-base font-medium', f === filter ? 'border-primary-700 bg-primary-50 text-primary-800' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')}
          >
            {INBOX_FILTER_LABEL[f]}
            <span className="rounded-full bg-gray-100 px-2 text-sm text-gray-700">{counts[f]}</span>
          </Link>
        ))}
      </nav>

      <form action={base} className="flex gap-2">
        <input type="hidden" name="filter" value={filter} />
        <label htmlFor="support-q" className="sr-only">Search</label>
        <input id="support-q" name="q" defaultValue={q} placeholder="Search subject, message or sender" className={`${kit.input} min-w-0 flex-1`} />
        <button type="submit" className={`${kit.secondary} shrink-0`} aria-label="Search"><Search className="h-5 w-5" /><span className="hidden sm:inline">Search</span></button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-base text-gray-600">
          {q ? 'Nothing matches that search.' : filter === 'new' ? 'No new messages. Nice.' : 'Nothing here.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`${base}/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-base font-semibold text-gray-900">{r.subject}</p>
                    <StatusPill status={r.status} audience="team" />
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">
                    {r.senderName} ({r.senderRole}) · {r.category}
                  </p>
                  <p className="text-sm text-gray-600">
                    {r.assignee ? `With ${r.assignee}` : 'Not assigned'} · {fmtWhen(r.lastActivityAt)}{r.replies ? ` · ${r.replies} ${r.replies === 1 ? 'reply' : 'replies'}` : ''}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} pageSize={INBOX_PAGE_SIZE} total={total} basePath={base} params={{ filter, q: q || undefined }} label="messages" />
    </div>
  )
}

/** One message for the team: thread, assign, status, reply. */
export async function TeamThread({ viewer, id }: { viewer: Viewer; id: string }) {
  const t = await loadTeamThread(viewer, id)
  if (!t) notFound()
  const base = teamBase(viewer.role)
  const admin = canAssign(viewer)
  const people = admin ? await loadAssignees() : []
  const items = [{ id: 'first', author: t.sender.name, body: t.body, createdAt: t.createdAt, fromTeam: false }, ...t.replies]

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href={base} className={kit.quiet}><ArrowLeft className="h-4 w-4" /> Support inbox</Link>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <div className={kit.card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="break-words text-xl font-bold text-gray-900">{t.subject}</h1>
                <p className="mt-1 text-sm text-gray-600">{t.category} · sent {fmtWhen(t.createdAt)}</p>
              </div>
              <StatusPill status={t.status} audience="team" />
            </div>
          </div>
          <ThreadView items={items} teamSide="right" />
          {t.canAct ? (
            <TeamReplyForm messageId={t.id} status={t.status} takes={takesOnReply({ assignedToId: t.assignee?.id ?? null, status: t.status })} />
          ) : (
            <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-700">
              This message isn&apos;t assigned to you yet. An admin assigns new messages; once it&apos;s yours you can reply and change its status.
            </p>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <div className={`${kit.card} space-y-2`}>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">From</p>
            <p className="text-base font-semibold text-gray-900">{t.sender.name}</p>
            <p className="text-sm text-gray-600">{t.sender.role}</p>
            <a href={`mailto:${t.sender.email}`} className="block break-all text-sm text-primary-700 hover:underline">{t.sender.email}</a>
          </div>
          <div className={`${kit.card} space-y-4`}>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Assigned to</p>
              <p className="text-base text-gray-900">{t.assignee ? t.assignee.name : 'Nobody yet'}</p>
              {t.assignedAt && <p className="text-sm text-gray-600">since {fmtWhen(t.assignedAt)}</p>}
            </div>
            {admin && <AssignBox messageId={t.id} current={t.assignee} people={people} />}
            {t.canAct && <StatusBox messageId={t.id} status={t.status} hasAssignee={!!t.assignee} />}
          </div>
        </aside>
      </div>
    </div>
  )
}
