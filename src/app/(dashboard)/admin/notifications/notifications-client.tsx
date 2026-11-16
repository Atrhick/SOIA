'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Loader2, Mail, Search, Send, X } from 'lucide-react'
import { kit } from '@/components/ui/kit/styles'
import { BODY_MAX, PUSH_BODY_MAX, TITLE_MAX, pushBody, type BroadcastCounts } from '@/lib/broadcast/core'
import { continueBroadcast, createBroadcast, previewBroadcastAudience, searchBroadcastPeople, type PersonHit } from '@/lib/actions/broadcasts'

export type SentRow = { id: string; title: string; body: string; createdAt: string; finished: boolean; sender: string; emailFallback: boolean; counts: BroadcastCounts }

type Banner = { ok: boolean; text: string } | null
type Mode = 'groups' | 'people'
type LinkChoice = 'home' | 'one-a-day' | 'custom'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const fmt = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))

function countsLine(c: BroadcastCounts): string {
  const parts = [
    c.push && `${plural(c.push, 'phone or computer', 'phones or computers')}`,
    c.email && `${plural(c.email, 'email', 'emails')}`,
    c.noDevice && `${c.noDevice} not reached (no notifications, email off)`,
    c.failed && `${c.failed} failed`,
    c.pending && `${c.pending} still to send`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Nobody'
}

export function NotificationsClient({ groups, sent }: { groups: { key: string; label: string }[]; sent: SentRow[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('groups')
  const [picked, setPicked] = useState<string[]>(['COACH', 'AMBASSADOR'])
  const [people, setPeople] = useState<PersonHit[]>([])
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PersonHit[]>([])
  const [searching, setSearching] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState<LinkChoice>('home')
  const [customLink, setCustomLink] = useState('')
  const [emailFallback, setEmailFallback] = useState(true)
  const [reach, setReach] = useState<{ people: number; withDevice: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [banner, setBanner] = useState<Banner>(null)

  const audience = mode === 'groups' ? { groups: picked } : { userIds: people.map((p) => p.id) }
  const audienceKey = JSON.stringify(audience)

  // Live "who it reaches" count.
  useEffect(() => {
    let live = true
    const empty = mode === 'groups' ? picked.length === 0 : people.length === 0
    if (empty) { setReach({ people: 0, withDevice: 0 }); return }
    previewBroadcastAudience(JSON.parse(audienceKey)).then((r) => { if (live && !('error' in r)) setReach(r) }).catch(() => {})
    return () => { live = false }
  }, [audienceKey, mode, picked.length, people.length])

  // Name search for "Specific people".
  const searchSeq = useRef(0)
  useEffect(() => {
    if (mode !== 'people' || q.trim().length < 2) { setHits([]); return }
    const seq = ++searchSeq.current
    setSearching(true)
    const t = setTimeout(() => {
      searchBroadcastPeople(q).then((r) => {
        if (seq !== searchSeq.current) return
        setHits(Array.isArray(r) ? r : [])
        setSearching(false)
      }).catch(() => setSearching(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q, mode])

  const toggleGroup = (k: string) => setPicked((g) => (g.includes(k) ? g.filter((x) => x !== k) : [...g, k]))
  const addPerson = (p: PersonHit) => { setPeople((list) => (list.some((x) => x.id === p.id) ? list : [...list, p])); setQ(''); setHits([]) }
  const removePerson = (id: string) => setPeople((list) => list.filter((x) => x.id !== id))

  const total = reach?.people ?? 0
  const byPush = reach?.withDevice ?? 0
  const byEmail = Math.max(0, total - byPush)
  const ready = title.trim() && body.trim() && total > 0 && (link !== 'custom' || customLink.trim())

  async function sendAll(id: string, startTotal: number) {
    setProgress({ done: 0, total: startTotal })
    for (let i = 0; i < 500; i++) {
      const r = await continueBroadcast(id)
      if ('error' in r) { setBanner({ ok: false, text: `${r.error} Use "Continue sending" below to try again.` }); break }
      const c = r.counts
      setProgress({ done: c.total - c.pending, total: c.total })
      if (c.pending === 0) {
        setBanner({ ok: true, text: `Sent. ${countsLine(c)}.` })
        break
      }
    }
    setProgress(null)
    router.refresh()
  }

  async function onSend() {
    setBusy(true)
    setBanner(null)
    const r = await createBroadcast({ title, body, link, customLink, emailFallback, audience })
    if ('error' in r) { setBanner({ ok: false, text: r.error }); setBusy(false); setConfirming(false); return }
    setConfirming(false)
    await sendAll(r.id, r.total)
    setTitle(''); setBody(''); setCustomLink('')
    setBusy(false)
  }

  async function onContinue(row: SentRow) {
    setBusy(true)
    setBanner(null)
    await sendAll(row.id, row.counts.total)
    setBusy(false)
  }

  const radio = 'h-5 w-5 shrink-0 accent-primary-700'
  const opt = 'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50'

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        {banner && (
          <div role={banner.ok ? 'status' : 'alert'} className={`rounded-xl border px-4 py-3 text-base ${banner.ok ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-900'}`}>{banner.text}</div>
        )}

        <section className={kit.card} aria-labelledby="who-h">
          <h2 id="who-h" className="text-lg font-bold text-gray-900">1. Who gets it</h2>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Choose by">
            {(['groups', 'people'] as Mode[]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`h-11 rounded-full border px-4 text-base font-semibold ${kit.ring} ${mode === m ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400'}`}>
                {m === 'groups' ? 'Groups' : 'Specific people'}
              </button>
            ))}
          </div>

          {mode === 'groups' ? (
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Groups</legend>
              {groups.map((g) => (
                <label key={g.key} className={opt}>
                  <input type="checkbox" className={`${radio} mt-0.5`} checked={picked.includes(g.key)} onChange={() => toggleGroup(g.key)} />
                  <span className="min-w-0">{g.label}</span>
                </label>
              ))}
              <p className={kit.hint}>Active logins only. Someone with two roles (say, Admin and Coach) gets it once.</p>
            </fieldset>
          ) : (
            <div className="mt-4 space-y-3">
              <label htmlFor="people-q" className={kit.label}>Find someone by name or email</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input id="people-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type at least 2 letters" autoComplete="off" className={`${kit.input} pl-11`} />
                {searching && <Loader2 className="absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-gray-400" aria-label="Searching" />}
              </div>
              {hits.length > 0 && (
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200" aria-label="Matches">
                  {hits.map((h) => {
                    const added = people.some((p) => p.id === h.id)
                    return (
                      <li key={h.id}>
                        <button type="button" disabled={added} onClick={() => addPerson(h)} className={`flex w-full min-w-0 items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60 ${kit.ring}`}>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-gray-900">{h.name}</span>
                            <span className="block truncate text-sm text-gray-600">{h.email} · {h.roles}</span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-primary-700">{added ? 'Added' : 'Add'}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {q.trim().length >= 2 && !searching && hits.length === 0 && <p className={kit.hint}>Nobody matches &quot;{q.trim()}&quot;.</p>}
              {people.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Chosen people">
                  {people.map((p) => (
                    <li key={p.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-50 py-1 pl-3 pr-1 text-sm font-semibold text-primary-900">
                      {p.hasDevice ? <Bell className="h-4 w-4 shrink-0" aria-label="Has notifications on" /> : <Mail className="h-4 w-4 shrink-0" aria-label="Gets email" />}
                      <span className="truncate">{p.name}</span>
                      <button type="button" onClick={() => removePerson(p.id)} aria-label={`Remove ${p.name}`} className={`inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-primary-100 ${kit.ring}`}><X className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="mt-4 rounded-xl bg-gray-50 px-3.5 py-2.5 text-base text-gray-800" aria-live="polite">
            {reach === null ? 'Counting…' : total === 0 ? 'Nobody chosen yet.' : (
              <>Reaches <strong>{plural(total, 'person', 'people')}</strong>: {byPush} by notification, {emailFallback ? `${byEmail} by email` : `${byEmail} not reached (email is off)`}.</>
            )}
          </p>
        </section>

        <section className={kit.card} aria-labelledby="what-h">
          <h2 id="what-h" className="text-lg font-bold text-gray-900">2. The message</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="bc-title" className={kit.label}>Title</label>
              <input id="bc-title" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Team call moved to Thursday" className={kit.input} />
              <p className={kit.hint}>{title.length}/{TITLE_MAX}. This is also the email subject.</p>
            </div>
            <div>
              <label htmlFor="bc-body" className={kit.label}>Message</label>
              <textarea id="bc-body" value={body} maxLength={BODY_MAX} rows={5} onChange={(e) => setBody(e.target.value)} placeholder="This week's team call is Thursday at 6 p.m. Central, same Zoom link." className={kit.textarea} />
              <p className={kit.hint}>{body.length}/{BODY_MAX}. Phones show about the first {PUSH_BODY_MAX} characters; the email has all of it.</p>
            </div>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
              Notifications show on lock screens. Leave out prospects&apos; names, ages and contact details; link to the page that has them instead.
            </p>
          </div>
        </section>

        <section className={kit.card} aria-labelledby="where-h">
          <h2 id="where-h" className="text-lg font-bold text-gray-900">3. When they tap it, open</h2>
          <fieldset className="mt-3 space-y-2">
            <legend className="sr-only">Page to open</legend>
            {([
              ['home', 'Their home page'],
              ['one-a-day', 'One-A-Day (coaches and ambassadors; anyone else gets their home page)'],
              ['custom', 'A page I choose'],
            ] as [LinkChoice, string][]).map(([k, label]) => (
              <label key={k} className={opt}>
                <input type="radio" name="bc-link" className={`${radio} mt-0.5`} checked={link === k} onChange={() => setLink(k)} />
                <span className="min-w-0">{label}</span>
              </label>
            ))}
            {link === 'custom' && (
              <div className="pt-1">
                <label htmlFor="bc-custom" className={kit.label}>Page link</label>
                <input id="bc-custom" value={customLink} onChange={(e) => setCustomLink(e.target.value)} placeholder="/coach/learning" className={kit.input} />
                <p className={kit.hint}>Copy it from the address bar while you&apos;re on the page. Pages in this app only. A coach page works for coaches; pick a page everyone you chose can open.</p>
              </div>
            )}
          </fieldset>
          <label className={`${opt} mt-4`}>
            <input type="checkbox" className={`${radio} mt-0.5`} checked={emailFallback} onChange={(e) => setEmailFallback(e.target.checked)} />
            <span className="min-w-0">Email anyone who doesn&apos;t have notifications on<span className="block text-sm text-gray-600">Also used when a phone can&apos;t be reached (app removed, new phone).</span></span>
          </label>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          {!confirming ? (
            <button type="button" className={kit.primary} disabled={!ready || busy} onClick={() => setConfirming(true)}>
              <Send className="h-5 w-5" aria-hidden="true" />Send
            </button>
          ) : (
            <div role="alertdialog" aria-labelledby="confirm-t" className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3">
              <p id="confirm-t" className="min-w-0 flex-1 text-base text-gray-900">Send &quot;{title.trim()}&quot; to {plural(total, 'person', 'people')}? It can&apos;t be taken back.</p>
              <button type="button" className={kit.primary} disabled={busy} onClick={onSend}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Send className="h-5 w-5" aria-hidden="true" />}Yes, send it
              </button>
              <button type="button" className={kit.secondary} disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          )}
          {progress && (
            <p className="text-base text-gray-700" aria-live="polite">
              Sending… {progress.done} of {progress.total}. Keep this page open; emails go out a few a second.
            </p>
          )}
        </div>
      </div>

      <aside className="min-w-0 space-y-6">
        <section className={kit.card} aria-labelledby="pv-h">
          <h2 id="pv-h" className="text-lg font-bold text-gray-900">Preview</h2>
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-gray-500">On a phone</p>
          <div className="mt-1.5 rounded-2xl bg-gray-800 p-3 text-white">
            <div className="flex items-center gap-2 text-xs text-gray-300"><Bell className="h-3.5 w-3.5" aria-hidden="true" />NowTransformed · now</div>
            <p className="mt-1 break-words font-semibold">{title.trim() || 'Your title'}</p>
            <p className="break-words text-sm text-gray-100">{body.trim() ? pushBody(body) : 'Your message'}</p>
          </div>
          <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">By email</p>
          <div className="mt-1.5 rounded-xl border border-gray-200 p-3 text-sm text-gray-800">
            <p className="break-words"><span className="text-gray-500">Subject:</span> {title.trim() || 'Your title'}</p>
            <p className="mt-2">Hi Maria,</p>
            <p className="mt-1 whitespace-pre-line break-words">{body.trim() || 'Your message'}</p>
            <p className="mt-2 inline-block rounded-lg bg-primary-700 px-3 py-1.5 font-semibold text-white">{link === 'one-a-day' ? 'Open One-A-Day' : 'Open NowTransformed'}</p>
            <p className="mt-2 text-gray-500">Replies come to you.</p>
          </div>
        </section>

        <section className={kit.card} aria-labelledby="sent-h">
          <h2 id="sent-h" className="text-lg font-bold text-gray-900">Sent</h2>
          {sent.length === 0 ? <p className="mt-2 text-base text-gray-600">Nothing sent yet.</p> : (
            <ul className="mt-2 divide-y divide-gray-100">
              {sent.map((s) => (
                <li key={s.id} className="py-3">
                  <p className="break-words font-semibold text-gray-900">{s.title}</p>
                  <p className="text-sm text-gray-600">{fmt(s.createdAt)} · {s.sender}</p>
                  <p className="mt-1 text-sm text-gray-800">{countsLine(s.counts)}</p>
                  {!s.finished && s.counts.pending > 0 && (
                    <button type="button" className={`${kit.quiet} mt-1`} disabled={busy} onClick={() => onContinue(s)}>Continue sending ({s.counts.pending} left)</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}
