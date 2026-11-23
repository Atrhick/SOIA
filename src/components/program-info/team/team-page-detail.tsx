'use client'

/**
 * Team screen: one page (admin /admin/program-pages/[id], and the selected page beside the queue on
 * wide screens). Data: PageDetail from src/lib/program-info/server.ts. Every change goes through the
 * team actions in src/lib/actions/program-info.ts, then router.refresh().
 */
import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  addGroupPage,
  adminPutBackOnline,
  adminTakeOffline,
  askQuestion,
  exportAnswersText,
  publishOnBehalf,
  saveDraft,
  sendToCoach,
} from '@/lib/actions/program-info'
import { FLYER_QUESTION, INFO_SECTIONS } from '@/lib/program-info/questions'
import type { PageDetail, VersionItem } from '@/lib/program-info/server'
import type { AnswerChange } from '@/lib/program-info/progress'
import { teamPagePath } from '@/lib/program-info/paths'
import { kit } from '@/components/ui/kit/styles'
import { useToast } from '@/components/ui/kit/toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BUCKET_PILL, VERSION_STATUS, answerToText, day, endSentence, eventSentence, waitingText, when } from './format'

type Result = { ok: true } | { ok: false; error: string; needsConfirm?: boolean }

const box = 'rounded-2xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5'
const h3 = 'm-0 text-lg font-bold text-gray-900'
const part = 'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 px-3.5 py-3 text-base'
const smallBtn = `inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-primary-600 bg-white px-4 text-sm font-semibold text-primary-700 shadow-sm hover:bg-primary-50 disabled:border-gray-300 disabled:text-gray-500 disabled:shadow-none ${kit.ring}`
/** A fold-out section header: looks like a bar you can tap, with a chevron and "Show". */
const foldSummary = 'flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-gray-100 px-3.5 text-base font-bold text-gray-900 hover:bg-gray-200 [&::-webkit-details-marker]:hidden'
const Fold = () => <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700">Show <span aria-hidden>▾</span></span>

function ErrorBanner({ text }: { text: string | null }) {
  if (!text) return null
  return <p role="alert" className="m-0 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800">{text}</p>
}

function Changes({ title, items, tone }: { title: string; items: AnswerChange[]; tone: 'amber' | 'violet' }) {
  if (items.length === 0) return null
  const c = tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-violet-200 bg-violet-50'
  return (
    <section aria-label={title} className={`rounded-2xl border p-4 ${c}`}>
      <h3 className={h3}>{title} · {items.length} answer{items.length === 1 ? '' : 's'}</h3>
      <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
        {items.map((ch) => (
          <li key={ch.key} className="text-sm leading-relaxed text-gray-900">
            <p className="m-0 font-semibold">{ch.label}</p>
            <p className="m-0 whitespace-pre-line"><span className="font-semibold text-gray-700">Before: </span>{answerToText(ch.key, ch.before) || <em>empty</em>}</p>
            <p className="m-0 whitespace-pre-line"><span className="font-semibold text-gray-700">Now: </span>{answerToText(ch.key, ch.after) || <em>empty</em>}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The version the team is working on: the draft, else the one sent to check, else the latest. */
function workingVersion(versions: VersionItem[]): VersionItem | null {
  return versions.find((v) => v.status === 'DRAFT') ?? versions.find((v) => v.status === 'SENT') ?? null
}

export function TeamPageDetail({ detail: d, preview }: { detail: PageDetail; preview: ReactNode }) {
  const router = useRouter()
  const toast = useToast()
  const [pending, start] = useTransition()
  const [copied, setCopied] = useState('')
  const [err, setErr] = useState<{ at: string; text: string } | null>(null)

  const first = d.ownerFirstName ?? 'the owner'
  const ownerNoun = d.ownerRole === 'AMBASSADOR' ? 'ambassador' : 'coach'
  const title = `${d.programName}${d.audienceLabel ? ` · ${d.audienceLabel}` : ''}`
  const draft = d.versions.find((v) => v.status === 'DRAFT') ?? null
  const working = workingVersion(d.versions)
  const workingPage = working ? working.offerPage ?? null : null
  const publishable = draft ?? d.versions.find((v) => v.status === 'SENT' || v.status === 'CHANGES_ASKED') ?? null
  const answered = d.questions.filter((q) => q.answeredAt)
  const latestChange = d.events.find((e) => e.kind === 'CHANGES_ASKED')
  const changeText = (() => {
    const x = latestChange?.detail as { text?: unknown } | undefined
    return typeof x?.text === 'string' ? x.text : null
  })()
  const hasOwner = !!d.ownerUserId

  const run = (at: string, fn: () => Promise<Result>, ok: string, after?: () => void) => {
    setErr(null)
    start(async () => {
      const r = await fn()
      if (!r.ok) {
        setErr({ at, text: r.error })
        return
      }
      after?.()
      toast.success(ok)
      router.refresh()
    })
  }
  const errAt = (at: string) => (err?.at === at ? err.text : null)

  // ---------- copy all answers ----------
  const copyAll = () => {
    setCopied('')
    start(async () => {
      const r = await exportAnswersText(d.id)
      if (!r.ok) {
        setErr({ at: 'copy', text: r.error })
        return
      }
      try {
        await navigator.clipboard.writeText(r.text)
        setCopied('Copied all answers.')
      } catch {
        setErr({ at: 'copy', text: "Couldn't copy. Your browser blocked the clipboard." })
      }
    })
  }

  // ---------- draft text ----------
  const [editWelcome, setEditWelcome] = useState(false)
  const [welcome, setWelcome] = useState(working?.welcomeNote ?? '')
  const [editLine, setEditLine] = useState(false)
  const [line, setLine] = useState(working?.messageLine ?? '')

  // ---------- send ----------
  const [confirmSend, setConfirmSend] = useState(false)
  const canSend = !!draft && hasOwner && (draft.offerPage != null || d.current.offerPage != null)
  const send = (confirmOpenQuestions: boolean) => {
    if (!draft) return
    setErr(null)
    start(async () => {
      const r = await sendToCoach(draft.id, { confirmOpenQuestions })
      if (!r.ok) {
        if (r.needsConfirm) setConfirmSend(true)
        else setErr({ at: 'send', text: r.error })
        return
      }
      setConfirmSend(false)
      toast.success(`Sent to ${first} to check.`)
      router.refresh()
    })
  }

  // ---------- ask ----------
  const [asking, setAsking] = useState(false)
  const [question, setQuestion] = useState('')
  const [answerKey, setAnswerKey] = useState('')
  const canAsk = d.stage !== 'ANSWERING'

  // ---------- owner actions ----------
  const [publishing, setPublishing] = useState(false)
  const [publishReason, setPublishReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [groupLabel, setGroupLabel] = useState('')
  const [offlining, setOfflining] = useState(false)
  const [offlineReason, setOfflineReason] = useState('')
  const [onlining, setOnlining] = useState(false)
  const [onlineReason, setOnlineReason] = useState('')

  return (
    <section aria-labelledby="page-title" className="flex min-w-0 flex-col gap-4">
      {/* Who and what */}
      <div className={`${box} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="page-title" className="m-0 text-xl font-extrabold text-gray-900 sm:text-[21px]">{title}</h2>
            <p className="m-0 mt-1 text-sm text-gray-700">
              {hasOwner ? `${d.ownerName} (${ownerNoun})` : <span className="font-semibold">No owner</span>}
              {d.companyName ? ` · ${d.companyName}` : ''}
              {d.groups.length > 1 ? ` · ${d.groups.length} group pages` : ''}
            </p>
            <p className="m-0 mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${BUCKET_PILL[d.teamBucket]}`}>{d.teamLabel}</span>
              {d.isLive && d.teamBucket !== 'LIVE' && <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-900">Live</span>}
              {d.teamBucket !== 'LIVE' && <span>{waitingText(d.waitingDays)}</span>}
              {d.liveUrl && d.isLive && <a href={d.liveUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary-700 underline">Open the live page</a>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button type="button" onClick={copyAll} disabled={pending} className={smallBtn}>Copy all answers</button>
            <span role="status" aria-live="polite" className="min-h-[1.25rem] text-sm font-semibold text-green-800">{copied}</span>
          </div>
        </div>
        <ErrorBanner text={errAt('copy')} />
        {!hasOwner && <p className="m-0 text-sm text-gray-700">Nothing is sent while the page has no owner. Assign one on <Link href="/admin/programs" className="font-semibold text-primary-700 underline">Program Pages</Link>.</p>}
        {d.offlineInfo && (
          <p className="m-0 rounded-xl border border-gray-300 bg-gray-100 px-3.5 py-2.5 text-sm text-gray-900">
            <b>Offline since {day(d.offlineInfo.at)}</b> ({d.offlineInfo.byTeam ? 'taken down by the team' : `taken down by ${first}`}){d.offlineInfo.reason ? `. Reason: ${d.offlineInfo.reason}` : ''}
          </p>
        )}
      </div>

      {/* Changes asked for */}
      {(d.stage === 'CHANGES_ASKED' || d.changeRound > 0) && changeText && (
        <section aria-label="Changes asked for" className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <h3 className={`${h3} text-red-900`}>Changes asked for{d.changeRound > 0 ? ` · round ${d.changeRound}` : ''}{latestChange ? ` · ${when(latestChange.createdAt)}` : ''}</h3>
          <p className="m-0 mt-1.5 whitespace-pre-line text-base leading-relaxed text-gray-900">{changeText}</p>
        </section>
      )}

      {/* Note sent with the answers */}
      {d.lastSentNote && (
        <section aria-label={`Note from ${first}`} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <h3 className={`${h3} text-blue-900`}>Note from {first}{d.lastSentAt ? ` · ${when(d.lastSentAt)}` : ''}</h3>
          <p className="m-0 mt-1.5 whitespace-pre-line text-base leading-relaxed text-gray-900">{d.lastSentNote}</p>
        </section>
      )}

      {/* Questions */}
      {d.openQuestions.length > 0 && (
        <section aria-label="Open questions" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 className={`${h3} text-amber-900`}>Waiting for {first}&apos;s answer</h3>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            {d.openQuestions.map((q) => (
              <li key={q.id} className="text-base leading-relaxed text-gray-900">
                “{q.question}”<span className="text-sm text-gray-700"> · asked by {q.askedByName}, {when(q.createdAt)}{q.answerKeyLabel ? ` · fills: ${q.answerKeyLabel}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {answered.length > 0 && (
        <section aria-label="Answered questions" className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <h3 className={`${h3} text-green-900`}>Questions answered</h3>
          <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
            {answered.map((q) => (
              <li key={q.id} className="text-base leading-relaxed text-gray-900">
                <span className="block"><b>Asked:</b> {q.question}</span>
                <span className="block whitespace-pre-line"><b>{first}:</b> {q.answerText || <em>no text</em>}</span>
                <span className="block text-sm text-gray-700">{q.answerKeyLabel ? `${endSentence(`Answered ${when(q.answeredAt)}`)} Saved into the answer “${q.answerKeyLabel}”.` : `Answered ${when(q.answeredAt)}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Changes title="Changed since sent" items={d.changedSinceSent} tone="amber" />
      <Changes title="Changed since live" items={d.changedSinceLive} tone="violet" />

      {d.missing.length > 0 && (
        <p className="m-0 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-800"><b>Still empty:</b> {d.missingText}. {d.sectionsDone} of {d.sectionsTotal} sections done.</p>
      )}

      {/* Every answer */}
      <details className={box}>
        <summary className={foldSummary}>All answers <Fold /></summary>
        <div className="mt-2 flex flex-col gap-4">
          {INFO_SECTIONS.map((s) => (
            <div key={s.id}>
              <h4 className="m-0 text-sm font-bold uppercase tracking-wide text-gray-700">{s.number}. {s.title}{s.shared && d.groups.length > 1 ? ' (shared by every group page)' : ''}</h4>
              <dl className="m-0 mt-1.5 flex flex-col gap-2">
                {s.questions.map((q) => (
                  <div key={q.id}>
                    <dt className="text-sm font-semibold text-gray-900">{q.label}{q.required ? '' : ' (optional)'}</dt>
                    <dd className="m-0 whitespace-pre-line text-base text-gray-800">{answerToText(q.id, d.answers[q.id]) || <span className="text-gray-500">Not answered</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <div>
            <dt className="text-sm font-semibold text-gray-900">{FLYER_QUESTION.label} (optional)</dt>
            <dd className="m-0 text-base text-gray-800">{answerToText('flyerLink', d.answers.flyerLink) || <span className="text-gray-500">Not answered</span>}</dd>
          </div>
        </div>
      </details>

      {/* Draft parts */}
      <section aria-labelledby="draft-h" className={`${box} flex flex-col gap-3`}>
        <h3 id="draft-h" className={h3}>
          {draft
            ? `Draft for ${first} to check · version ${draft.number} · not live`
            : working
              ? `Version ${working.number} sent to ${first} to check${working.sentAt ? ` · ${when(working.sentAt)}` : ''}`
              : 'No draft yet'}
        </h3>
        {!draft && working && <p className="m-0 text-sm text-gray-700">Editing anything below starts a new draft from this version.</p>}

        <div className={part}>
          <span>
            <b>Page</b>
            {workingPage ? ` · saved ${when(working?.updatedAt)}` : d.current.offerPage ? ' · same as the live page' : ' · not loaded yet'}
          </span>
          {working && !!(workingPage || d.current.offerPage) && (
            <Link href={`${teamPagePath(d.id)}/version/${working.number}`} className={smallBtn}>Preview full size</Link>
          )}
        </div>
        {!workingPage && (
          <p className="m-0 rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800">
            Load the page with the save-draft script:{' '}
            <code className="break-all rounded bg-white px-1 py-0.5 text-[13px]">npx tsx scripts/program-info/save-draft.ts {d.slug} page.json --apply</code>
          </p>
        )}
        {preview && (
          <details>
            <summary className={foldSummary}>See the page here <Fold /></summary>
            <div className="mt-2">{preview}</div>
          </details>
        )}

        {/* Welcome email paragraph */}
        <div className={`${part} flex-col items-stretch`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><b>Welcome email paragraph</b> · {working?.welcomeNote ? 'written' : 'not written yet'}</span>
            {!editWelcome && <button type="button" className={smallBtn} onClick={() => { setWelcome(working?.welcomeNote ?? ''); setEditWelcome(true) }}>{working?.welcomeNote ? 'Edit' : 'Write'}<span className="sr-only"> the welcome email paragraph</span></button>}
          </div>
          {!editWelcome && working?.welcomeNote && <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-gray-800">{working.welcomeNote}</p>}
          {editWelcome && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                run('welcome', () => saveDraft(d.id, { welcomeNote: welcome }), 'Welcome paragraph saved to the draft.', () => setEditWelcome(false))
              }}
            >
              <label htmlFor="welcome-note" className={kit.label}>Welcome email paragraph</label>
              <textarea id="welcome-note" aria-describedby="welcome-hint" rows={6} value={welcome} onChange={(e) => setWelcome(e.target.value)} className={kit.textarea} />
              <p id="welcome-hint" className={kit.hint}>Goes in the welcome email new sign-ups get. 40 to 700 characters ({welcome.trim().length} now).</p>
              <ErrorBanner text={errAt('welcome')} />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className={kit.primary}>Save to the draft</button>
                <button type="button" className={kit.secondary} onClick={() => { setEditWelcome(false); setErr(null) }}>Cancel</button>
              </div>
            </form>
          )}
        </div>

        {/* Invitation line */}
        <div className={`${part} flex-col items-stretch`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><b>Invitation line</b> · {working?.messageLine ? 'written' : 'not written yet'}</span>
            {!editLine && <button type="button" className={smallBtn} onClick={() => { setLine(working?.messageLine ?? ''); setEditLine(true) }}>{working?.messageLine ? 'Edit' : 'Write'}<span className="sr-only"> the invitation line</span></button>}
          </div>
          {!editLine && working?.messageLine && <p className="m-0 text-sm leading-relaxed text-gray-800">{working.messageLine}</p>}
          {editLine && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                run('line', () => saveDraft(d.id, { messageLine: line }), 'Invitation line saved to the draft.', () => setEditLine(false))
              }}
            >
              <label htmlFor="message-line" className={kit.label}>Invitation line</label>
              <input id="message-line" aria-describedby="line-hint" value={line} maxLength={200} onChange={(e) => setLine(e.target.value)} className={kit.input} />
              <p id="line-hint" className={kit.hint}>The one line about this program in the invite messages. Up to 160 characters ({line.trim().length} now).</p>
              <ErrorBanner text={errAt('line')} />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className={kit.primary}>Save to the draft</button>
                <button type="button" className={kit.secondary} onClick={() => { setEditLine(false); setErr(null) }}>Cancel</button>
              </div>
            </form>
          )}
        </div>

        <p className="m-0 text-sm leading-relaxed text-gray-700">
          <b>For now:</b> tell Claude “write {first}&apos;s {d.audienceLabel ?? d.programName} page”. Use <b>Copy all answers</b> to give it everything {first} wrote. Claude writes all three, runs the copy check and saves them here as a draft with the save-draft script.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!canSend || pending}
            onClick={() => (d.openQuestions.length > 0 ? setConfirmSend(true) : send(false))}
            className={kit.primary}
          >
            Send to {first} to check
          </button>
          <button type="button" className={kit.secondary} disabled={!canAsk || !hasOwner} aria-expanded={asking} onClick={() => setAsking((x) => !x)}>Ask {first} a question</button>
          <button type="button" disabled className="inline-flex h-12 items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 text-base font-semibold text-gray-600">Write with AI · coming later</button>
        </div>
        <ErrorBanner text={errAt('send')} />
        <p className="m-0 text-sm text-gray-700">
          {!draft
            ? 'Sending needs a draft. Save the page with the script, or edit the welcome paragraph or invitation line.'
            : !hasOwner
              ? 'Assign an owner before sending.'
              : `If a question is still waiting for ${first}'s answer, sending asks you to confirm first.`}
        </p>
        {!canAsk && <p className="m-0 text-sm text-gray-700">You can ask questions once {first} sends the answers. Missing answers are caught when they send.</p>}

        {asking && canAsk && (
          <form
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3.5"
            onSubmit={(e) => {
              e.preventDefault()
              run('ask', () => askQuestion(d.id, question, answerKey || null), `Question sent to ${first}.`, () => { setAsking(false); setQuestion(''); setAnswerKey('') })
            }}
          >
            <div>
              <label htmlFor="ask-q" className={kit.label}>Your question for {first}</label>
              <textarea id="ask-q" aria-describedby="ask-hint" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} className={kit.textarea} />
              <p id="ask-hint" className={kit.hint}>Example: What does a family usually pay, roughly?</p>
            </div>
            <div>
              <label htmlFor="ask-key" className={kit.label}>Which answer does it fill? (optional)</label>
              <select id="ask-key" aria-describedby="ask-key-hint" value={answerKey} onChange={(e) => setAnswerKey(e.target.value)} className={kit.input}>
                <option value="">None, just a written reply</option>
                {INFO_SECTIONS.map((s) => (
                  <optgroup key={s.id} label={s.title}>
                    {s.questions.filter((q) => !q.extraOf).map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
                  </optgroup>
                ))}
                <option value={FLYER_QUESTION.id}>{FLYER_QUESTION.label}</option>
              </select>
              <p id="ask-key-hint" className={kit.hint}>{first} then sees that question&apos;s own field, and the reply goes straight into those answers.</p>
            </div>
            <ErrorBanner text={errAt('ask')} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={pending || !question.trim()} className={kit.primary}>Send the question</button>
              <button type="button" className={kit.secondary} onClick={() => setAsking(false)}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      {/* Owner actions */}
      <section aria-labelledby="owner-actions-h" className={box}>
        <h3 id="owner-actions-h" className={h3}>Publish, groups, offline</h3>
        <p className="m-0 mt-1 text-sm text-gray-700">Use these when {first} can&apos;t do it. Each one is logged.</p>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={kit.primary} disabled={!publishable} aria-expanded={publishing} onClick={() => setPublishing((x) => !x)}>Publish for {first}</button>
            <button type="button" className={smallBtn} aria-expanded={adding} onClick={() => setAdding((x) => !x)}>Add a group page</button>
            {d.isLive && <button type="button" className={`${smallBtn} text-red-700`} aria-expanded={offlining} onClick={() => setOfflining((x) => !x)}>Take offline</button>}
            {d.offlineInfo && (
              <button type="button" className={smallBtn} disabled={pending || !d.lastApproved} aria-expanded={onlining} onClick={() => setOnlining((x) => !x)}>Put back online</button>
            )}
          </div>
          {!publishable && <p className="m-0 text-sm text-gray-700">Publishing for the {ownerNoun} needs a draft or a version sent to check.</p>}
          {!onlining && <ErrorBanner text={errAt('online')} />}

          {onlining && d.offlineInfo && (
            <form className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3.5" onSubmit={(e) => { e.preventDefault(); run('online', () => adminPutBackOnline(d.id, onlineReason), 'The page is back online.', () => { setOnlining(false); setOnlineReason('') }) }}>
              <p className="m-0 text-sm text-gray-800">Puts the last approved version back live. {first} is told it is back online.</p>
              <label htmlFor="online-reason" className={kit.label}>Reason (optional)</label>
              <textarea id="online-reason" aria-describedby="online-hint" rows={2} value={onlineReason} onChange={(e) => setOnlineReason(e.target.value)} className={kit.textarea} />
              <p id="online-hint" className={kit.hint}>Example: The price is fixed now. {first} sees this, and it is logged.</p>
              <ErrorBanner text={errAt('online')} />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className={kit.primary}>Put the page back online</button>
                <button type="button" className={kit.secondary} onClick={() => setOnlining(false)}>Cancel</button>
              </div>
            </form>
          )}

          {publishing && publishable && (
            <form className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3.5" onSubmit={(e) => { e.preventDefault(); run('publish', () => publishOnBehalf(publishable.id, publishReason), `Version ${publishable.number} is live.`, () => { setPublishing(false); setPublishReason('') }) }}>
              <p className="m-0 text-sm text-gray-800">Puts version {publishable.number} live without {first}&apos;s OK. {first} gets an email with your reason, and it is logged.</p>
              <label htmlFor="publish-reason" className={kit.label}>Reason</label>
              <textarea id="publish-reason" aria-describedby="publish-hint" rows={3} value={publishReason} onChange={(e) => setPublishReason(e.target.value)} className={kit.textarea} />
              <p id="publish-hint" className={kit.hint}>Example: {first} said yes on a call and can&apos;t get online this week.</p>
              <ErrorBanner text={errAt('publish')} />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending || !publishReason.trim()} className={kit.primary}>Put version {publishable.number} live</button>
                <button type="button" className={kit.secondary} onClick={() => setPublishing(false)}>Cancel</button>
              </div>
            </form>
          )}

          {adding && (
            <form className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3.5" onSubmit={(e) => { e.preventDefault(); run('group', () => addGroupPage(d.rootId, groupLabel), `Group page added. ${hasOwner ? `${first} is asked to fill it in.` : ''}`.trim(), () => { setAdding(false); setGroupLabel('') }) }}>
              <label htmlFor="group-label" className={kit.label}>Who is the new page for?</label>
              <input id="group-label" aria-describedby="group-hint" value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} className={kit.input} />
              <p id="group-hint" className={kit.hint}>Example: Business owners. It gets its own page and link under {d.programName}.</p>
              <ErrorBanner text={errAt('group')} />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending || !groupLabel.trim()} className={kit.primary}>Add the page</button>
                <button type="button" className={kit.secondary} onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </form>
          )}

          {offlining && d.isLive && (
            <form className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5" onSubmit={(e) => { e.preventDefault(); run('offline', () => adminTakeOffline(d.id, offlineReason), 'The page is offline.', () => { setOfflining(false); setOfflineReason('') }) }}>
              <p className="m-0 text-sm text-gray-800">Visitors see the plain sign-up page instead. {first} is told why and can&apos;t put it back; you can.</p>
              <label htmlFor="offline-reason" className={kit.label}>Reason</label>
              <textarea id="offline-reason" aria-describedby="offline-hint" rows={3} value={offlineReason} onChange={(e) => setOfflineReason(e.target.value)} className={kit.textarea} />
              <p id="offline-hint" className={kit.hint}>Example: The price on the page is out of date.</p>
              <ErrorBanner text={errAt('offline')} />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending || !offlineReason.trim()} className={kit.danger}>Take the page offline</button>
                <button type="button" className={kit.secondary} onClick={() => setOfflining(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </section>

      <details className={box}>
        <summary className={foldSummary}>Program goals and grant details (admins only) <Fold /></summary>
        <p className="m-0 mt-1 text-sm leading-relaxed text-gray-800">
          Monthly growth and impact goals, weekly engagements, internship offering. Set on the main program, not per page. Coaches no longer see these.{' '}
          <Link href="/admin/programs" className="font-semibold text-primary-700 underline">Open Program Pages</Link>
        </p>
      </details>

      {/* Versions */}
      <section aria-labelledby="versions-h" className={box}>
        <h3 id="versions-h" className={h3}>Versions</h3>
        {d.versions.length === 0 ? (
          <p className="m-0 mt-1.5 text-sm text-gray-700">No versions yet.</p>
        ) : (
          <ul className="m-0 mt-1.5 flex list-none flex-col divide-y divide-gray-100 p-0">
            {d.versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-gray-800">
                <span>
                  <b>Version {v.number}</b> · {VERSION_STATUS[v.status] ?? v.status}
                  {v.approvedAt ? ` ${day(v.approvedAt)}${v.approvedOnBehalf ? ' by the team' : ''}` : v.sentAt ? ` · sent ${day(v.sentAt)}` : ` · saved ${day(v.updatedAt)}`}
                </span>
                <Link href={`${teamPagePath(d.id)}/version/${v.number}`} className={smallBtn}>View<span className="sr-only"> version {v.number}</span></Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* History */}
      <section aria-labelledby="history-h" className={box}>
        <h3 id="history-h" className={h3}>History</h3>
        {d.events.length === 0 ? (
          <p className="m-0 mt-1.5 text-sm text-gray-700">Nothing has happened yet.</p>
        ) : (
          <ol className="m-0 mt-1.5 flex list-none flex-col gap-1.5 p-0 text-sm leading-relaxed text-gray-800">
            {d.events.map((e) => (
              <li key={e.id}><span className="text-gray-600">{when(e.createdAt)} · </span>{eventSentence(e, first)}</li>
            ))}
          </ol>
        )}
      </section>

      <Dialog open={confirmSend} onOpenChange={setConfirmSend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send before {first} answers?</DialogTitle>
            <DialogDescription className="text-base text-gray-700">
              {d.openQuestions.length === 1 ? 'A question is' : `${d.openQuestions.length} questions are`} still waiting for {first}&apos;s answer. The draft goes to {first} to check anyway, and the question stays open.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" className={kit.secondary} onClick={() => setConfirmSend(false)}>Wait for the answer</button>
            <button type="button" className={kit.primary} disabled={pending} onClick={() => send(true)}>Send anyway</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

