'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Mail, UserPlus, Users } from 'lucide-react'
import { addPersonAsInviter } from '@/lib/actions/get-involved'
import type { MyTeamData, TeamGroup, TeamMember } from '@/lib/get-involved/queries'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IntakeFields } from './intake-fields'

const FILTERS: { value: 'ALL' | TeamGroup; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'COACH', label: 'Coaches' },
  { value: 'AMBASSADOR', label: 'Ambassadors' },
  { value: 'OTHER', label: 'Other roles' },
]
const BADGE: Record<TeamGroup, string> = {
  COACH: 'bg-sky-100 text-sky-800',
  AMBASSADOR: 'bg-green-100 text-green-800',
  OTHER: 'bg-purple-100 text-purple-800',
}
const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
const dateLabel = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }).format(new Date(iso))
const NEW_DAYS = 7

function contact(m: TeamMember, isNew: boolean, myFirst: string) {
  const subject = isNew ? `Welcome to the team, ${m.firstName}!` : `Checking in, ${m.firstName}`
  const body = isNew
    ? `Hi ${m.firstName},\n\nWelcome to NowTransformed! I'm glad you're on the team. Here's how I do my One-A-Day: ...\n\n${myFirst}`
    : `Hi ${m.firstName},\n\n`
  return `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function MyTeamClient({ data, rankLabel, firstName, oneADayPath }: { data: MyTeamData; rankLabel: string; firstName: string; oneADayPath: string }) {
  const [filter, setFilter] = useState<'ALL' | TeamGroup>('ALL')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const nowMs = new Date(data.now).getTime()
  const shown = filter === 'ALL' ? data.members : data.members.filter((m) => m.group === filter)
  const count = (f: 'ALL' | TeamGroup) => (f === 'ALL' ? data.members.length : data.members.filter((m) => m.group === f).length)

  const stats: [string, string | number][] = [
    ['On your team', data.onTeam],
    ['Joined this month', data.joinedThisMonth],
    ['Invited by your team this month', data.invitedByTeamThisMonth],
    [`Leaderboard rank (${rankLabel})`, data.rank ? `#${data.rank}` : '–'],
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-900">My Team</h1>
          <p className="text-gray-600 mt-1">People who joined through you, and how they&apos;re building their own teams. Encourage them: community grows one person at a time.</p>
        </div>
        <button type="button" onClick={() => { setMsg(null); setAdding(true) }} className={`h-11 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white font-semibold text-sm inline-flex items-center gap-2 ${focus}`}>
          <UserPlus className="h-4 w-4" aria-hidden />Add someone I talked to
        </button>
      </div>

      {msg && <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg} They&apos;ll show on your <Link href={oneADayPath} className="font-semibold underline">One-A-Day</Link> page until they join.</p>}

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(([l, v]) => (
          <div key={l} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col-reverse justify-end">
            <dt className="text-sm text-gray-600">{l}</dt>
            <dd className="text-2xl font-bold text-gray-900">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="team-h" className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="team-h" className="font-bold text-gray-900 text-lg">Team members</h2>
          <div role="group" aria-label="Filter by role" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}
                className={`h-10 px-4 rounded-full text-sm font-semibold border ${focus} ${filter === f.value ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}>
                {f.label}<span className="sr-only"> ({count(f.value)})</span>
              </button>
            ))}
          </div>
        </div>

        {data.members.length === 0 ? (
          <div className="text-center py-10">
            <Users className="h-10 w-10 text-gray-300 mx-auto" aria-hidden />
            <p className="font-semibold text-gray-900 mt-3">No one on your team yet</p>
            <p className="text-sm text-gray-600 mt-1">When someone you invite finishes their journey and gets a login, they appear here.</p>
            <Link href={oneADayPath} className={`mt-4 h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold inline-flex items-center ${focus}`}>Go to One-A-Day</Link>
          </div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-gray-600 py-6">No one in this group yet.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block mt-4">
              <table className="w-full text-sm">
                <caption className="sr-only">Team members, {FILTERS.find((f) => f.value === filter)?.label}</caption>
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-100">
                    <th scope="col" className="py-2 pr-3 font-semibold">Name</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Role</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Joined</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Their invites (month)</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Their streak</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Their team</th>
                    <th scope="col" className="py-2 font-semibold"><span className="sr-only">Contact</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => {
                    const isNew = nowMs - new Date(m.joinedAt).getTime() < NEW_DAYS * 86400_000
                    return (
                      <tr key={m.id} className="border-b border-gray-100 last:border-0">
                        <th scope="row" className="py-3 pr-3 text-left font-semibold text-gray-900">{m.name}</th>
                        <td className="py-3 pr-3"><span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${BADGE[m.group]}`}>{m.roleLabel}</span></td>
                        <td className="py-3 pr-3 whitespace-nowrap">{dateLabel(m.joinedAt)}</td>
                        <td className="py-3 pr-3">{m.invitesThisMonth}</td>
                        <td className="py-3 pr-3 whitespace-nowrap">{m.streak > 0 ? `${m.streak} day${m.streak === 1 ? '' : 's'}` : '–'}</td>
                        <td className="py-3 pr-3">{m.theirTeam}</td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <a href={contact(m, isNew, firstName)} className={`font-semibold text-primary-700 underline hover:text-primary-800 rounded ${focus}`}>{isNew ? 'Say welcome' : 'Message'}<span className="sr-only"> to {m.name}</span></a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Phone list */}
            <ul className="md:hidden mt-3 divide-y divide-gray-100">
              {shown.map((m) => {
                const isNew = nowMs - new Date(m.joinedAt).getTime() < NEW_DAYS * 86400_000
                return (
                  <li key={m.id} className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 min-w-0 truncate">{m.name}</p>
                      <span className={`flex-none text-xs font-semibold rounded-full px-2.5 py-1 ${BADGE[m.group]}`}>{m.roleLabel}</span>
                    </div>
                    <p className="text-xs text-gray-600">Joined {dateLabel(m.joinedAt)} · {m.invitesThisMonth} invite{m.invitesThisMonth === 1 ? '' : 's'} this month · {m.streak > 0 ? `${m.streak}-day streak` : 'no streak'} · team of {m.theirTeam}</p>
                    <a href={contact(m, isNew, firstName)} className={`inline-flex items-center gap-1.5 min-h-10 text-sm font-semibold text-primary-700 ${focus} rounded`}><Mail className="h-4 w-4" aria-hidden />{isNew ? 'Say welcome' : 'Message'}<span className="sr-only"> to {m.name}</span></a>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-primary-800">
        Only people who finished the journey appear here. People still in progress are on the <Link href={oneADayPath} className="font-semibold underline">One-A-Day</Link> dashboard.
      </p>

      <AddSomeoneDialog open={adding} onOpenChange={setAdding} onAdded={(m) => { setAdding(false); setMsg(m) }} />
    </div>
  )
}

/** The One-A-Day "add someone I talked to" flow (same fields and action), in a dialog. */
function AddSomeoneDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: (m: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const r = await addPersonAsInviter(new FormData(e.currentTarget))
      if ('error' in r) setErr(r.error); else onAdded(r.message ?? 'Added.')
    } catch {
      setErr('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); setErr(null) } }}>
      <DialogContent className="max-w-2xl w-[calc(100%-1.5rem)] max-h-[90vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>Add someone I talked to</DialogTitle>
          <DialogDescription>Met someone in person or on the phone? Add them here. It counts toward your One-A-Day, just like a form from your link.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <IntakeFields forInviter />
          {err && <p role="alert" className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200">{err}</p>}
          <button type="submit" disabled={busy} className={`h-11 px-5 rounded-lg bg-primary-700 hover:bg-primary-800 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-60 ${focus}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Add and send the welcome email
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
