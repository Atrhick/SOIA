'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Search } from 'lucide-react'
import { ClientPager, usePaged } from '@/components/ui/client-pager'
import { reshuffleOutreachGroups, sendOutreachCheckIn, sendOutreachCheckInBulk } from '@/lib/actions/outreach-admin'
import type { AdminGroupMember, AdminGroupsData } from '@/lib/get-involved/outreach-stats'

const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const btnSecondary = `inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 ${focus}`

function Banner({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{notice}</p>}
    </>
  )
}

function SearchBox({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
    </div>
  )
}

type Who = 'all' | 'quiet' | 'never'
const PAGE = 10

/**
 * "Who could use a nudge": members with no invite in NEEDS_HELP_DAYS+ days. Search, filter
 * (gone quiet / never started), page through, and check in on one person or everyone shown.
 */
export function NudgeList({ data, canAct, needsHelpDays }: { data: AdminGroupsData; canAct: boolean; needsHelpDays: number }) {
  const NEEDS_HELP_DAYS = needsHelpDays
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [who, setWho] = useState<Who>('all')
  const [confirmAll, setConfirmAll] = useState(false)

  const everyone = useMemo(() => data.groups.flatMap((g) => g.members).filter((m) => m.needsHelp)
    .sort((a, b) => (a.daysQuiet === null ? 1 : 0) - (b.daysQuiet === null ? 1 : 0) || (b.daysQuiet ?? 0) - (a.daysQuiet ?? 0) || a.name.localeCompare(b.name)), [data])
  const counts = { all: everyone.length, quiet: everyone.filter((m) => m.daysQuiet !== null).length, never: everyone.filter((m) => m.daysQuiet === null).length }
  const shown = everyone
    .filter((m) => who === 'all' || (who === 'quiet' ? m.daysQuiet !== null : m.daysQuiet === null))
    .filter((m) => !q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase()))
  const pending = shown.filter((m) => !sent.has(m.userId))
  const paged = usePaged(shown, PAGE)

  if (!data.current) return null

  async function checkIn(m: AdminGroupMember) {
    setBusy(m.userId); setError(null); setNotice(null)
    try {
      const r = await sendOutreachCheckIn(m.userId)
      if ('error' in r) setError(r.error)
      else { setNotice(r.message); setSent((s) => new Set(s).add(m.userId)) }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function checkInAll() {
    setBusy('all'); setError(null); setNotice(null)
    try {
      const r = await sendOutreachCheckInBulk(pending.map((m) => m.userId))
      if ('error' in r) setError(r.error)
      else { setNotice(r.message); setSent((s) => { const n = new Set(s); r.sentIds.forEach((id) => n.add(id)); return n }); if (!r.remaining) setConfirmAll(false) }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const tab = (k: Who, label: string) => (
    <button type="button" onClick={() => { setWho(k); paged.setPage(1) }} aria-pressed={who === k}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${focus} ${who === k ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}>
      {label}<span className={`rounded-full px-1.5 text-xs ${who === k ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>{counts[k]}</span>
    </button>
  )

  return (
    <section aria-labelledby="nudge-h" className="bg-white border border-gray-200 rounded-xl p-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h2 id="nudge-h" className="text-lg font-bold text-gray-900">Who could use a nudge</h2>
          <p className="text-sm text-gray-600 mt-1">
            Coaches and ambassadors with no invite in {NEEDS_HELP_DAYS}+ days. A check-in is a short, friendly email from the team with a link to their share kit; each person gets at most one every 3 days.
          </p>
        </div>
        {canAct && pending.length > 0 && !confirmAll && (
          <button type="button" onClick={() => { setConfirmAll(true); setError(null); setNotice(null) }} className={btnSecondary}>
            <Mail className="h-4 w-4" aria-hidden />Check in on all {pending.length}
          </button>
        )}
      </div>

      {confirmAll && (
        <div role="group" aria-labelledby="all-h" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p id="all-h" className="text-sm text-amber-900">
            Email a check-in to the {pending.length} {pending.length === 1 ? 'person' : 'people'} in this list{q || who !== 'all' ? ' (your search and filter apply)' : ''}? Anyone checked in on in the last 3 days is skipped. Up to 50 go out per click.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={checkInAll} disabled={busy !== null}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white disabled:opacity-60 ${focus}`}>
              {busy === 'all' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy === 'all' ? 'Sending…' : 'Yes, send'}
            </button>
            <button type="button" onClick={() => setConfirmAll(false)} disabled={busy === 'all'} className={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}
      <Banner error={error} notice={notice} />

      {counts.all === 0 ? (
        <p className="mt-3 text-sm text-gray-700">Everyone has sent an invite in the last {NEEDS_HELP_DAYS} days. Nice.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">{tab('all', 'All')}{tab('quiet', 'Gone quiet')}{tab('never', "Haven't started")}</div>
            <SearchBox id="nudge-q" value={q} onChange={(v) => { setQ(v); paged.setPage(1) }} placeholder="Search by name" />
          </div>
          {shown.length === 0 ? <p className="mt-3 text-sm text-gray-600">No one matches.</p> : (
            <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
              {paged.slice.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{m.name}</span>
                    <span className="block text-xs text-gray-500">{m.daysQuiet === null ? 'Hasn’t sent an invite yet' : `Last invite ${m.daysQuiet} days ago`}</span>
                  </span>
                  {canAct && (sent.has(m.userId)
                    ? <span className="flex-none text-sm font-semibold text-green-700">Check-in sent</span>
                    : (
                      <button type="button" onClick={() => checkIn(m)} disabled={busy !== null}
                        className={`flex-none inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-60 ${focus}`}>
                        {busy === m.userId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
                        Check in<span className="sr-only"> on {m.name}</span>
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
          <ClientPager paged={paged} noun="people" />
        </>
      )}
    </section>
  )
}

/** "Groups of 5": a summary, search by member to find their group, and setting next month's groups. */
export function GroupsClient({ data, canAct }: { data: AdminGroupsData; canAct: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [q, setQ] = useState('')
  const nextName = data.nextMonthLabel.split(' ')[0]

  const groups = data.groups.filter((g) => !q.trim() || g.members.some((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())))
  const paged = usePaged(groups, 8)
  const members = data.groups.reduce((s, g) => s + g.members.length, 0)
  const started = data.groups.reduce((s, g) => s + g.active, 0)
  const allQuiet = data.groups.filter((g) => g.active === 0).length

  async function reshuffle() {
    setBusy(true); setError(null); setNotice(null)
    try {
      const r = await reshuffleOutreachGroups(data.nextMonth)
      if ('error' in r) setError(r.error)
      else { setNotice(r.message); setConfirming(false); router.refresh() }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="groups-h" className="bg-white border border-gray-200 rounded-xl p-5 min-w-0">
      <h2 id="groups-h" className="font-bold text-gray-900">Groups of 5 · {data.monthLabel}</h2>
      <p className="text-sm text-gray-600 mt-1">
        Each month every coach and ambassador is put in a small group. On their My results page they see only their own group, as friendly encouragement. Groups are made automatically on the 1st; nothing to do here.
      </p>
      {data.groups.length > 0 && (
        <p className="mt-3 text-sm text-gray-800">
          <strong>{data.groups.length}</strong> group{data.groups.length === 1 ? '' : 's'} · <strong>{started} of {members}</strong> members started{allQuiet ? <> · <strong>{allQuiet}</strong> group{allQuiet === 1 ? '' : 's'} where no one has started</> : null}
        </p>
      )}

      <Banner error={error} notice={notice} />

      {data.groups.length === 0 ? (
        <p className="text-sm text-gray-600 mt-3">{data.current ? 'No active coaches or ambassadors to group yet.' : `No groups were set for ${data.monthLabel}.`}</p>
      ) : (
        <>
          <div className="mt-3"><SearchBox id="group-q" value={q} onChange={(v) => { setQ(v); paged.setPage(1) }} placeholder="Find someone's group" /></div>
          {groups.length === 0 ? <p className="mt-3 text-sm text-gray-600">No one by that name.</p> : (
            <ul className="mt-3 space-y-2">
              {paged.slice.map((g) => (
                <li key={g.groupNo} className="rounded-lg border border-gray-200 px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-semibold text-gray-900">Group {g.groupNo}</span>
                    <span className="text-xs text-gray-500">{g.active} of {g.members.length} started · {g.callsBooked} call{g.callsBooked === 1 ? '' : 's'} booked</span>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-700">
                    {g.members.map((m) => (
                      <span key={m.userId} className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${m.active ? 'bg-green-500' : 'bg-gray-300'}`} aria-hidden="true" />
                        {m.name}<span className="sr-only">{m.active ? ' (started)' : ' (not started)'}</span>
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <ClientPager paged={paged} noun="groups" />
          <p className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />invited someone this month</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300" aria-hidden="true" />not yet</span>
          </p>
        </>
      )}

      {canAct && data.current && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          {!confirming ? (
            <button type="button" onClick={() => { setConfirming(true); setError(null); setNotice(null) }}
              className={`text-sm font-semibold text-primary-700 hover:underline ${focus}`}>
              {data.nextMonthHasGroups ? `Reshuffle ${nextName}'s groups` : `Make ${nextName}'s groups now`} (optional)
            </button>
          ) : (
            <div role="group" aria-labelledby="confirm-h" className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p id="confirm-h" className="text-sm text-amber-900">
                {data.nextMonthHasGroups ? `Replace the groups already set for ${data.nextMonthLabel}?` : `Make the groups for ${data.nextMonthLabel} now instead of on the 1st?`} This month&apos;s groups don&apos;t change.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button type="button" onClick={reshuffle} disabled={busy}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white disabled:opacity-60 ${focus}`}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Yes, {data.nextMonthHasGroups ? 'reshuffle' : 'make them'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
