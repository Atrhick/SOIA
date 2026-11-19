import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ChevronRight, MessageSquare } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { loadSenderList, loadSenderThread } from '@/lib/support/server'
import { TEAM_NAME } from '@/lib/support/core'
import { StatusPill, fmtWhen } from './status-pill'
import { ThreadView } from './thread-view'
import { SendSupportForm, SenderReplyForm } from './sender-forms'

/** "Get help": the form plus the person's own messages. Shared by coach, ambassador and associate. */
export async function SenderSupportHome({ userId, base, impersonating }: { userId: string; base: string; impersonating: boolean }) {
  const rows = await loadSenderList(userId)
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Get help</h1>
        <p className="mt-1 text-base text-gray-600">
          Stuck on something? Send a message to {TEAM_NAME}. You&apos;ll see their reply here and get an email when they answer.
        </p>
      </div>

      <SendSupportForm impersonating={impersonating} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Your messages</h2>
        {rows.length === 0 ? (
          <p className="text-base text-gray-600">You haven&apos;t sent any messages yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`${base}/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <MessageSquare className="h-5 w-5 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-gray-900">{r.subject}</p>
                    <p className="text-sm text-gray-600">
                      {r.category} · {fmtWhen(r.lastActivityAt)}{r.replies ? ` · ${r.replies} ${r.replies === 1 ? 'reply' : 'replies'}` : ''}
                    </p>
                    <div className="mt-1 sm:hidden"><StatusPill status={r.status} audience="sender" /></div>
                  </div>
                  <span className="hidden sm:inline-flex"><StatusPill status={r.status} audience="sender" /></span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** One of the person's own messages. Someone else's message is a 404. */
export async function SenderSupportThread({ userId, id, base, impersonating }: { userId: string; id: string; base: string; impersonating: boolean }) {
  const t = await loadSenderThread(userId, id)
  if (!t) notFound()
  const items = [
    { id: 'first', author: 'You', body: t.body, createdAt: t.createdAt, fromTeam: false },
    ...t.replies,
  ]
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={base} className={kit.quiet}><ArrowLeft className="h-4 w-4" /> All my messages</Link>
      <div className={kit.card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold text-gray-900">{t.subject}</h1>
            <p className="mt-1 text-sm text-gray-600">{t.category} · sent {fmtWhen(t.createdAt)}</p>
          </div>
          <StatusPill status={t.status} audience="sender" />
        </div>
        {t.status === 'WAITING_ON_SENDER' && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-base text-amber-900">The team asked you something. Please reply below.</p>
        )}
      </div>
      <ThreadView items={items} teamSide="left" />
      <SenderReplyForm messageId={t.id} impersonating={impersonating} done={t.status === 'DONE'} />
    </div>
  )
}
