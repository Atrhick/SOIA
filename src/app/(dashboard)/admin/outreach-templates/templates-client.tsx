'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { resetOutreachTemplate, saveOutreachTemplate } from '@/lib/actions/outreach-templates'
import {
  AFTER_KEYS, AUDIENCES, AUDIENCE_LABELS, DEFAULT_TEMPLATES, FILL_INS, FIRST_KEYS, TEMPLATE_LABELS, checksPass, disclosureLine,
  renderTemplate, resolveTemplate, templateChecks, type TemplateAudience, type TemplateKey, type TemplateRow,
} from '@/lib/get-involved/outreach-templates'

export type TemplateStats = Partial<Record<TemplateKey, { used: number; yesPct: number | null }>>

const SAMPLE = {
  firstName: 'Sarah',
  personalLine: 'You mentioned wanting to give back more, so I thought of you.',
  program: 'Health & Stress Management',
  description: 'a small group for busy people who want simpler ways to handle stress',
  link: 'https://example.org/join/maya/health-stress?via=text',
  seatsLeft: 3,
}
const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'

export function TemplatesClient({ rows, stats }: { rows: TemplateRow[]; stats: TemplateStats }) {
  const router = useRouter()
  const [key, setKey] = useState<TemplateKey>('TEXT')
  const [audience, setAudience] = useState<TemplateAudience>('ALL')
  const row = rows.find((r) => r.key === key && r.audience === audience) ?? null
  // Without a row for this audience, start from what that audience sees today.
  const start = row ?? (audience === 'ALL' ? { ...DEFAULT_TEMPLATES[key] } : resolveTemplate(rows, key, audience))
  const [subject, setSubject] = useState(start.subject ?? '')
  const [body, setBody] = useState(start.body)
  const [busy, setBusy] = useState<null | 'LIVE' | 'DRAFT' | 'RESET'>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  function select(k: TemplateKey, a: TemplateAudience) {
    const r = rows.find((x) => x.key === k && x.audience === a) ?? null
    const s = r ?? (a === 'ALL' ? { ...DEFAULT_TEMPLATES[k] } : resolveTemplate(rows, k, a))
    setKey(k); setAudience(a); setSubject(s.subject ?? ''); setBody(s.body); setMsg(null); setConfirmReset(false)
  }

  const checks = useMemo(() => templateChecks(key, { subject, body }), [key, subject, body])
  const ok = checksPass(checks)

  async function save(status: 'LIVE' | 'DRAFT') {
    setBusy(status); setMsg(null)
    const r = await saveOutreachTemplate({ key, audience, subject: key === 'EMAIL' ? subject : null, body, status })
    setBusy(null)
    if (!r.ok) setMsg({ ok: false, text: r.error })
    else { setMsg({ ok: true, text: status === 'LIVE' ? 'Saved. It is live now.' : 'Saved as a draft. Members still see the live text.' }); router.refresh() }
  }
  async function reset() {
    setBusy('RESET'); setMsg(null)
    const r = await resetOutreachTemplate({ key, audience })
    setBusy(null); setConfirmReset(false)
    if (!r.ok) setMsg({ ok: false, text: r.error })
    else {
      const rest = rows.filter((x) => !(x.key === key && x.audience === audience))
      const s = audience === 'ALL' ? DEFAULT_TEMPLATES[key] : resolveTemplate(rest, key, audience)
      setSubject(s.subject ?? ''); setBody(s.body)
      setMsg({ ok: true, text: audience === 'ALL' ? 'Back to the default.' : 'Removed. This audience uses the template for everyone again.' })
      router.refresh()
    }
  }

  const statusOf = (k: TemplateKey) => {
    const r = rows.find((x) => x.key === k && x.audience === 'ALL')
    return r ? (r.status === 'LIVE' ? 'Live' : 'Draft') : 'Live'
  }
  const st = stats[key]
  const previewText = renderTemplate(body, key, SAMPLE)
  const previewSubject = key === 'EMAIL' ? renderTemplate(subject, key, SAMPLE) : null
  const firstMessage = (FIRST_KEYS as readonly string[]).includes(key)

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr] items-start">
      <nav aria-label="Templates" className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {[['FIRST MESSAGE', FIRST_KEYS], ['AFTER', AFTER_KEYS]].map(([title, keys]) => (
          <div key={title as string}>
            <p className="px-4 pt-4 pb-2 text-xs font-bold tracking-wide text-gray-500">{title as string}</p>
            <ul>
              {(keys as readonly TemplateKey[]).map((k) => {
                const s = statusOf(k)
                return (
                  <li key={k}>
                    <button type="button" onClick={() => select(k, 'ALL')} aria-current={key === k ? 'true' : undefined}
                      className={`w-full min-h-[44px] px-4 py-2.5 flex items-center justify-between gap-2 text-left text-sm border-t border-gray-100 ${focusRing} ${key === k ? 'bg-sky-50 text-primary-800 font-semibold' : 'text-gray-900 hover:bg-gray-50'}`}>
                      {TEMPLATE_LABELS[k]}
                      <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${s === 'Live' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{s}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 min-w-0" aria-labelledby="tpl-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="tpl-title" className="text-lg font-bold text-gray-900">{TEMPLATE_LABELS[key]} · {firstMessage ? 'first message' : 'follow-up'}</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {row ? `Saved for ${AUDIENCE_LABELS[audience].toLowerCase()} · ${row.status === 'LIVE' ? 'live' : 'draft (not in use)'}` : audience === 'ALL' ? 'Using the built-in default' : 'Not set for this audience: it uses the template for everyone'}
            </p>
          </div>
          <label className="text-sm font-semibold text-gray-800 flex flex-col gap-1">
            For
            <select value={audience} onChange={(e) => select(key, e.target.value as TemplateAudience)} className="h-11 rounded-lg border border-gray-400 px-3 text-sm font-normal">
              {AUDIENCES.map((a) => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
            </select>
          </label>
        </div>

        {key === 'EMAIL' && (
          <div className="space-y-1">
            <label htmlFor="tpl-subject" className="text-sm font-semibold text-gray-800">Subject</label>
            <input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className="w-full h-11 rounded-lg border border-gray-400 px-3 text-sm" />
          </div>
        )}
        <div className="space-y-1">
          <label htmlFor="tpl-body" className="text-sm font-semibold text-gray-800">Message</label>
          <textarea id="tpl-body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} maxLength={2000} className="w-full rounded-lg border border-gray-400 px-3 py-2.5 text-[15px] leading-relaxed" />
          <p className="text-sm text-gray-600 flex flex-wrap gap-1.5 items-center">Fill-ins:
            {FILL_INS.map((t) => <code key={t} className="bg-sky-100 text-primary-800 rounded px-1.5 text-xs font-semibold">{t}</code>)}
          </p>
          <p className="text-xs text-gray-600">{'{seat line}'} becomes &quot;NowTransformed, a nonprofit, is sponsoring a few seats this month.&quot; (posts: the real number left) and disappears when the program has no sponsored seats.</p>
        </div>

        {firstMessage && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">Added automatically only when someone shares a program that isn&apos;t theirs</p>
            <p className="mt-1">&quot;{disclosureLine('AMBASSADOR', false)}&quot; (coaches: &quot;{disclosureLine('COACH', false)}&quot;). Sharing your own program adds nothing: it&apos;s clear you benefit.</p>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-gray-900">Checks before saving <span className="font-normal text-gray-600">(they differ by template: posts, &quot;After a yes&quot; and &quot;Form but no call&quot; may include the link)</span></p>
          <ul className="mt-2 space-y-1" aria-live="polite">
            {checks.map((c) => (
              <li key={c.id} className={`text-sm flex items-start gap-2 ${c.ok ? 'text-green-800' : 'text-red-700'}`}>
                {c.ok ? <Check className="h-4 w-4 mt-0.5 flex-none" aria-hidden /> : <X className="h-4 w-4 mt-0.5 flex-none" aria-hidden />}
                <span><span className="sr-only">{c.ok ? 'Passes: ' : 'Fails: '}</span>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => save('LIVE')} disabled={!!busy || !ok} className={`h-11 px-4 rounded-lg bg-primary-700 hover:bg-primary-800 text-white font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50 ${focusRing}`}>
            {busy === 'LIVE' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save and make live
          </button>
          <button type="button" onClick={() => save('DRAFT')} disabled={!!busy} className={`h-11 px-4 rounded-lg border border-gray-300 text-gray-800 font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50 ${focusRing}`}>
            {busy === 'DRAFT' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save as draft
          </button>
          <button type="button" onClick={() => setPreview((p) => !p)} aria-expanded={preview} className={`h-11 px-4 rounded-lg border border-gray-300 text-gray-800 font-semibold text-sm ${focusRing}`}>
            {preview ? 'Hide preview' : 'Preview as a coach'}
          </button>
          {row && !confirmReset && (
            <button type="button" onClick={() => setConfirmReset(true)} disabled={!!busy} className={`h-11 px-4 rounded-lg border border-red-200 text-red-700 font-semibold text-sm ${focusRing}`}>Reset to default</button>
          )}
          {row && confirmReset && (
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="text-gray-800">Delete this saved text?</span>
              <button type="button" onClick={reset} disabled={!!busy} className={`h-11 px-3 rounded-lg bg-red-600 text-white font-semibold ${focusRing}`}>{busy === 'RESET' ? 'Resetting…' : 'Yes, reset'}</button>
              <button type="button" onClick={() => setConfirmReset(false)} className={`h-11 px-3 rounded-lg border border-gray-300 font-semibold ${focusRing}`}>Cancel</button>
            </span>
          )}
          {!ok && <span className="text-sm text-red-700">Fix the checks to make it live, or save it as a draft.</span>}
          {st && st.used > 0 && (
            <span className="text-sm text-gray-600 lg:ml-auto">Used {st.used} {st.used === 1 ? 'time' : 'times'}{st.yesPct != null ? ` · ${st.yesPct}% got a yes` : ''}</span>
          )}
        </div>

        {preview && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-2">
            <p className="text-xs font-bold tracking-wide text-gray-600">PREVIEW AS A COACH (sample name, program, 3 seats left)</p>
            {previewSubject && <p className="text-sm"><span className="text-gray-600">Subject:</span> <strong>{previewSubject}</strong></p>}
            <p className="text-[15px] leading-relaxed whitespace-pre-line text-gray-900">{previewText}</p>
            {firstMessage && <p className="text-xs text-gray-600">Coaches sharing their own program get nothing added. Sharing someone else&apos;s program adds: &quot;{disclosureLine('COACH', false)}&quot;</p>}
          </div>
        )}
      </section>
    </div>
  )
}
