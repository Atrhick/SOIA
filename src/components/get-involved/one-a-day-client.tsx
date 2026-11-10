'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Flame, Loader2, Share2, Trophy, UserPlus, X } from 'lucide-react'
import { addPersonAsInviter } from '@/lib/actions/get-involved'
import { ageRangeLabel } from '@/lib/get-involved/core'
import { IntakeFields } from './intake-fields'

interface Person { id: string; name: string; ageRange: string | null; status: string; createdAt: string; added: boolean; nextCall: string | null }
interface Row { userId: string; name: string; role: string; forms: number; joined: number; streak: number; rank: number }
export interface OneADayData {
  shareUrl: string
  streak: number
  doneToday: boolean
  formsThisMonth: number
  joinedThisMonth: number
  myRank: number | null
  people: Person[]
  roleBoard: Row[]
  overallBoard: Row[]
}

const STAGE: Record<string, { label: string; cls: string }> = {
  FORM_SUBMITTED: { label: 'Form sent', cls: 'bg-gray-100 text-gray-700' },
  AWAITING_PARENT_CONSENT: { label: 'Waiting on parent', cls: 'bg-amber-100 text-amber-800' },
  DISCOVERY_BOOKED: { label: 'Call booked', cls: 'bg-sky-100 text-sky-800' },
  DISCOVERY_COMPLETED: { label: 'Call kept', cls: 'bg-blue-100 text-blue-800' },
  PAUSED: { label: 'Paused', cls: 'bg-red-100 text-red-800' },
  NOT_A_FIT: { label: 'Not a fit', cls: 'bg-gray-100 text-gray-600' },
  ACCOUNT_CREATED: { label: 'Joined', cls: 'bg-green-100 text-green-800' },
}
const stage = (s: string) => STAGE[s] ?? { label: 'In progress', cls: 'bg-purple-100 text-purple-800' }
const when = (iso: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))

export function OneADayClient({ data, roleLabel, firstName, meId }: { data: OneADayData; roleLabel: string; firstName: string; meId: string }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [tab, setTab] = useState<'role' | 'all'>('role')
  const [formKey, setFormKey] = useState(0)
  const board = tab === 'role' ? data.roleBoard : data.overallBoard
  const team = data.people.filter((p) => p.status === 'ACCOUNT_CREATED')
  const inProgress = data.people.filter((p) => p.status !== 'ACCOUNT_CREATED')

  async function copy() {
    try { await navigator.clipboard.writeText(data.shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked */ }
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: 'Get Involved with NowTransformed', url: data.shareUrl }) } catch { /* cancelled */ } } else copy()
  }
  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const r = await addPersonAsInviter(new FormData(e.currentTarget))
    setBusy(false)
    if ('error' in r) setMsg({ ok: false, text: r.error })
    else { setMsg({ ok: true, text: r.message ?? 'Added.' }); setFormKey((k) => k + 1); setAdding(false); router.refresh() }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-primary-700 text-white p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-primary-100">Hi {firstName} · today</p>
          <p className="text-2xl font-bold mt-1">{data.doneToday ? "You've done today's one ✓" : 'Invite one person today'}</p>
          <p className="text-sm text-primary-100 mt-1">Every person you invite helps build our community.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3"><Flame className="h-6 w-6" aria-hidden /><span className="text-2xl font-bold">{data.streak}</span><span className="text-sm">day streak</span></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[['Forms this month', data.formsThisMonth], ['Joined this month', data.joinedThisMonth], ['On your team', team.length], ['Your rank (overall)', data.myRank ? `#${data.myRank}` : '–']].map(([l, v]) => (
          <div key={l as string} className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-2xl font-bold text-gray-900">{v}</p><p className="text-sm text-gray-600">{l}</p></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
        <div className="space-y-6 min-w-0">
          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="font-bold text-gray-900">Your Get Involved link</h2>
            <p className="text-sm text-gray-600">Share it with one person a day. When they fill it out, you get credit and they join your team when they sign up.</p>
            <div className="flex flex-wrap gap-2">
              <input readOnly value={data.shareUrl} aria-label="Your link" className="flex-1 min-w-0 h-11 rounded-lg border border-gray-300 px-3 text-sm bg-gray-50" onFocus={(e) => e.currentTarget.select()} />
              <button onClick={copy} className="h-11 px-4 rounded-lg border border-sky-300 text-primary-700 font-semibold text-sm inline-flex items-center gap-2">{copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? 'Copied' : 'Copy'}</button>
              <button onClick={share} className="h-11 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white font-semibold text-sm inline-flex items-center gap-2"><Share2 className="h-4 w-4" aria-hidden />Share</button>
            </div>
            <button onClick={() => { setAdding((a) => !a); setMsg(null) }} aria-expanded={adding} className="h-11 px-4 rounded-lg border border-gray-300 text-gray-800 font-semibold text-sm inline-flex items-center gap-2">
              {adding ? <X className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}{adding ? 'Close' : 'Add someone I talked to'}
            </button>
            {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</p>}
            {adding && (
              <form key={formKey} onSubmit={onAdd} className="border-t border-gray-100 pt-4 space-y-4" noValidate>
                <p className="text-sm text-gray-600">Met someone in person or on the phone? Add them here. It counts toward your One-A-Day, just like a form from your link.</p>
                <IntakeFields forInviter />
                <button type="submit" disabled={busy} className="h-11 px-5 rounded-lg bg-primary-700 hover:bg-primary-800 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Add and send the welcome email</button>
              </form>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-bold text-gray-900">My people</h2>
            {inProgress.length === 0 ? <p className="text-sm text-gray-600 mt-2">No one yet. Share your link to get started.</p> : (
              <ul className="mt-2 divide-y divide-gray-100">
                {inProgress.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <span className="flex-none w-9 h-9 rounded-full bg-primary-50 text-primary-800 text-xs font-bold flex items-center justify-center">{p.name.split(' ').map((x) => (x?.[0] || '?').toUpperCase()).slice(0, 2).join('')}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                      <p className="text-xs text-gray-600">{ageRangeLabel(p.ageRange)} · {p.nextCall ? `Call ${when(p.nextCall)}` : `${p.added ? 'Added' : 'Signed up'} ${new Date(p.createdAt).toLocaleDateString()}`}</p>
                    </div>
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${stage(p.status).cls}`}>{stage(p.status).label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-bold text-gray-900">My team</h2>
            {team.length === 0 ? <p className="text-sm text-gray-600 mt-2">People you invite appear here once they join.</p> : (
              <ul className="mt-2 divide-y divide-gray-100">{team.map((p) => <li key={p.id} className="py-2.5 text-sm font-semibold text-gray-900">{p.name}</li>)}</ul>
            )}
          </section>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-bold text-gray-900 flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-600" aria-hidden />Leaderboard</h2><span className="text-xs text-gray-600">This month</span></div>
          <div className="flex gap-2" role="tablist">
            {(['role', 'all'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-9 px-3.5 rounded-full text-sm font-semibold border ${tab === t ? 'bg-primary-700 border-primary-700 text-white' : 'border-gray-300 text-gray-700'}`}>{t === 'role' ? roleLabel : 'Overall'}</button>
            ))}
          </div>
          {board.length === 0 ? <p className="text-sm text-gray-600">No activity yet this month. Be the first!</p> : (
            <ol className="divide-y divide-gray-100">
              {board.map((r) => (
                <li key={r.userId} className={`flex items-center gap-3 py-2.5 ${r.userId === meId ? 'bg-sky-50 -mx-2 px-2 rounded-lg' : ''}`}>
                  <span className="w-6 font-bold text-primary-800">{r.rank}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{r.name}{r.userId === meId ? ' (you)' : ''}</p><p className="text-xs text-gray-600">{r.joined} joined · {r.forms} forms{r.streak > 1 ? ` · ${r.streak}-day streak` : ''}</p></div>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-gray-500">Ranked by people who joined, then by forms.</p>
        </section>
      </div>
    </div>
  )
}
