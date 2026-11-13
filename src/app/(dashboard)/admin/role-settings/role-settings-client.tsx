'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Info, Loader2, Plus, Trash2 } from 'lucide-react'
import { saveRoleSettings } from '@/lib/actions/role-settings'
import {
  AGE_RANGES, ANSWER_TYPES, AnswerTypeValue, GetInvolvedRoleValue, ROLE_BILLINGS, RoleBillingValue, RoleConfig, priceLabel,
} from '@/lib/get-involved/core'
import {
  MAX_CHOICES, MAX_POINTS, RoleForm, fid, formToConfig, isFreeBilling, minorsBlocked, toForm, toInput, validateForm,
} from './role-form'
import { RolePreview } from './role-preview'

export interface LiveTermsRow { role: GetInvolvedRoleValue; id: string | null; version: number; body: string; createdAt: string | null }
export interface TermsVersionRow { id: string; role: string; version: number; body: string; createdAt: string; createdBy: string | null; acceptedCount: number }

interface Props {
  configs: RoleConfig[]
  liveTerms: LiveTermsRow[]
  history: TermsVersionRow[]
  /** role -> prospects mid-journey with that role */
  inProgress: Record<string, number>
  initialRole: GetInvolvedRoleValue
}

type Saved = Record<string, { config: RoleConfig; terms: LiveTermsRow }>

const inp = 'w-full h-11 rounded-lg border px-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 disabled:bg-gray-100 disabled:text-gray-500'
const lbl = 'block text-sm font-semibold text-gray-700 mb-1'
const card = 'bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4'
const btnPrimary = 'h-11 px-5 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const btnSecondary = 'h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2'
const chip = 'inline-flex items-center h-10 px-3 rounded-lg border text-sm cursor-pointer select-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary-600 peer-focus-visible:ring-offset-1'

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

export function RoleSettingsClient({ configs, liveTerms, history, inProgress, initialRole }: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState<Saved>(() => Object.fromEntries(configs.map((c) => [c.role, { config: c, terms: liveTerms.find((t) => t.role === c.role)! }])))
  const [role, setRole] = useState<GetInvolvedRoleValue>(initialRole)
  const baseline = useMemo(() => toForm(saved[role].config, saved[role].terms.body), [saved, role])
  const [form, setForm] = useState<RoleForm>(baseline)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  /** Where to go if the admin confirms leaving with unsaved changes. */
  const [pending, setPending] = useState<{ role?: GetInvolvedRoleValue; href?: string } | null>(null)

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)
  const termsDirty = form.terms.replace(/\r\n/g, '\n').trim() !== baseline.terms.trim()
  const live = saved[role].terms
  const sponsor = role === 'SPONSOR'
  const free = isFreeBilling(form.billing)
  const roleHistory = history.filter((h) => h.role === role)

  // Warn before closing the tab or following a link with unsaved changes.
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = '' } }
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return
      e.preventDefault(); e.stopPropagation()
      setPending({ href: url.pathname + url.search + url.hash })
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => { window.removeEventListener('beforeunload', onUnload); document.removeEventListener('click', onClick, true) }
  }, [])

  const goToRole = useCallback((r: GetInvolvedRoleValue) => {
    setRole(r)
    setForm(toForm(saved[r].config, saved[r].terms.body))
    setErrors({}); setBanner(null)
    try { window.history.replaceState(null, '', `/admin/role-settings?role=${r}`) } catch { /* ignore */ }
  }, [saved])

  // Stable so the dialogs' focus effects run once, not on every keystroke.
  const closePreview = useCallback(() => setPreview(false), [])
  const stay = useCallback(() => setPending(null), [])

  function pickRole(r: GetInvolvedRoleValue) {
    if (r === role) return
    if (dirty) setPending({ role: r })
    else goToRole(r)
  }

  function set<K extends keyof RoleForm>(key: K, value: RoleForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setBanner((b) => (b?.ok ? null : b))
  }
  function setQuestion(i: number, patch: Partial<RoleForm['questions'][number]>) {
    setForm((f) => ({ ...f, questions: f.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }))
  }
  function clearError(...keys: string[]) {
    if (keys.some((k) => errors[k])) setErrors((e) => { const n = { ...e }; keys.forEach((k) => delete n[k]); return n })
  }

  function focusFirst(errs: Record<string, string>) {
    const order = ['label', 'whoFor', 'ageRanges', 'priceCents', 'priceNote', 'billing', 'handoffUrl',
      ...[0, 1, 2].flatMap((i) => [`questions.${i}.text`, `questions.${i}.choices`]),
      'orientationUrl', 'orientationMinutes', 'orientationPoints', 'comprehensionQuestion', 'terms']
    const key = order.find((k) => errs[k]) ?? Object.keys(errs)[0]
    if (!key) return
    const el = document.getElementById(fid(key)) as HTMLElement | null
    el?.focus()
    el?.scrollIntoView({ block: 'center' })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null)
    const errs = validateForm(form)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setBanner({ ok: false, text: `Please fix ${Object.keys(errs).length === 1 ? 'the highlighted field' : `the ${Object.keys(errs).length} highlighted fields`} before saving.` })
      setTimeout(() => focusFirst(errs), 0)
      return
    }
    setBusy(true)
    try {
      const r = await saveRoleSettings(toInput(role, form))
      if (!r.ok) {
        // Server paths can be deeper ("questions.1.choices.0"); show them on the nearest field.
        const mapped: Record<string, string> = {}
        for (const [k, v] of Object.entries(r.fieldErrors)) {
          const key = k.replace(/^(questions\.\d\.choices)\.\d+$/, '$1')
          if (!mapped[key]) mapped[key] = v
        }
        setErrors(mapped)
        setBanner({ ok: false, text: r.error })
        setTimeout(() => focusFirst(mapped), 0)
        return
      }
      const terms: LiveTermsRow = { role, id: r.terms.id, version: r.terms.version, body: r.terms.body, createdAt: r.terms.createdAt }
      setSaved((s) => ({ ...s, [role]: { config: r.config, terms } }))
      setForm(toForm(r.config, terms.body))
      setErrors({})
      const published = terms.version !== live.version
      setBanner({ ok: true, text: published ? `Saved. Terms version ${terms.version} is now live for new prospects.` : 'Saved. New prospects will get these settings.' })
      router.refresh()
    } catch {
      setBanner({ ok: false, text: 'Could not save. Check your connection and try again.' })
    } finally {
      setBusy(false)
    }
  }

  const err = (k: string) => errors[k]
  const described = (k: string, hint?: boolean) => [hint ? `${fid(k)}-hint` : '', errors[k] ? `${fid(k)}-err` : ''].filter(Boolean).join(' ') || undefined
  const border = (k: string) => (errors[k] ? 'border-red-500' : 'border-gray-300')
  const ErrorText = ({ k }: { k: string }) => (errors[k] ? <p id={`${fid(k)}-err`} className="mt-1 text-sm text-red-700">{errors[k]}</p> : null)
  const termsLine = live.version === 0
    ? 'Not published yet. Prospects see this placeholder until you save; saving publishes version 1.'
    : `Version ${live.version}${live.createdAt ? ` · published ${fmtDate(live.createdAt)}` : ''} · prospects see the version that was live when they accepted.`
  const previewVersion = termsDirty ? `Version ${live.version + 1} (after you save)` : live.version === 0 ? 'Version 1 (after you save)' : `Version ${live.version}`
  const waiting = inProgress[role] ?? 0

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Role Settings</h1>
        <p className="text-gray-600 mt-1 max-w-3xl">Each role&apos;s assessment questions, orientation, terms and price.</p>
      </div>
      <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 max-w-3xl">
        <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
        <span><strong>Changes apply to new prospects only.</strong> People who already have a role keep the settings from when it was chosen, and the terms version they accepted.</span>
      </p>

      <div className="flex flex-col lg:flex-row lg:items-start gap-5">
        {/* Phone and tablet: a select. Desktop: the list with prices. */}
        <div className="lg:hidden">
          <label htmlFor="rs-role-select" className={lbl}>Role</label>
          <select id="rs-role-select" value={role} onChange={(e) => pickRole(e.target.value as GetInvolvedRoleValue)} className={`${inp} border-gray-300`}>
            {configs.map((c) => { const s = saved[c.role].config; return <option key={c.role} value={c.role}>{s.label} · {priceLabel(s)}{s.active ? '' : ' · not offered'}</option> })}
          </select>
        </div>
        <nav aria-label="Roles" className="hidden lg:block lg:w-64 shrink-0 bg-white border border-gray-200 rounded-xl p-2 lg:sticky lg:top-4">
          <ul className="space-y-0.5">
            {configs.map((c) => {
              const s = saved[c.role].config
              const on = c.role === role
              return (
                <li key={c.role}>
                  <button type="button" onClick={() => pickRole(c.role)} aria-current={on ? 'true' : undefined}
                    className={`w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${on ? 'bg-sky-100 text-sky-900 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                    <span className="min-w-0 break-words">{s.label}{!s.active && <span className="block text-xs font-normal text-gray-500">Not offered</span>}</span>
                    <span className={`shrink-0 text-xs ${on ? 'text-sky-900' : 'text-gray-600'} font-normal`}>{priceLabel(s)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <form onSubmit={save} noValidate autoComplete="off" className="flex-1 min-w-0 space-y-5" aria-labelledby="rs-role-heading">
          {banner && !banner.ok && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{banner.text}</div>}

          {/* ---- The role ---- */}
          <section className={card} aria-labelledby="rs-role-heading">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="rs-role-heading" className="text-lg font-bold text-gray-900 break-words">{saved[role].config.label}</h2>
                <p className="text-xs text-gray-600">{saved[role].config.saved ? 'Saved settings' : 'Built-in defaults: not saved yet'}{waiting > 0 ? ` · ${waiting} ${waiting === 1 ? 'person is' : 'people are'} mid-journey with this role and keep their current settings` : ''}</p>
              </div>
              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${form.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{form.active ? 'Offered on calls' : 'Not offered'}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor={fid('label')} className={lbl}>Role name</label>
                <input id={fid('label')} value={form.label} maxLength={80} onChange={(e) => { set('label', e.target.value); clearError('label') }} aria-invalid={!!err('label')} aria-describedby={described('label')} className={`${inp} ${border('label')}`} />
                <ErrorText k="label" />
              </div>
              <div>
                <label htmlFor={fid('whoFor')} className={lbl}>Who it&apos;s for</label>
                <input id={fid('whoFor')} value={form.whoFor} maxLength={500} onChange={(e) => { set('whoFor', e.target.value); clearError('whoFor') }} aria-invalid={!!err('whoFor')} aria-describedby={described('whoFor')} className={`${inp} ${border('whoFor')}`} placeholder="e.g. Teaches the personal development program" />
                <ErrorText k="whoFor" />
              </div>
              <fieldset className="md:col-span-2" aria-describedby={described('ageRanges', true)}>
                <legend className={lbl}>Age ranges allowed</legend>
                <div id={fid('ageRanges')} tabIndex={-1} className="flex flex-wrap gap-2 focus:outline-none">
                  {AGE_RANGES.map((a) => {
                    const on = form.ageRanges.includes(a.value)
                    return (
                      <label key={a.value} className="relative">
                        <input type="checkbox" className="peer sr-only" checked={on} onChange={() => { set('ageRanges', on ? form.ageRanges.filter((r) => r !== a.value) : [...form.ageRanges, a.value]); clearError('ageRanges') }} />
                        <span className={`${chip} ${on ? 'border-2 border-primary-700 bg-primary-100 text-primary-800 font-semibold' : errors.ageRanges ? 'border-red-500 text-gray-700' : 'border-gray-300 text-gray-700'}`}>{a.label}</span>
                      </label>
                    )
                  })}
                </div>
                <p id={`${fid('ageRanges')}-hint`} className="mt-1 text-xs text-gray-600">The interviewer only sees this role on the call record for these ages.</p>
                {minorsBlocked(form) && <p className="mt-1 text-sm text-amber-800">17 and under only ever see free roles, so this role won&apos;t be offered to them while it has a price.</p>}
                <ErrorText k="ageRanges" />
              </fieldset>
              <div>
                <label htmlFor={fid('billing')} className={lbl}>Billing</label>
                <select id={fid('billing')} value={form.billing} onChange={(e) => { set('billing', e.target.value as RoleBillingValue); clearError('priceCents', 'billing') }} className={`${inp} ${border('billing')}`}>
                  {ROLE_BILLINGS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
                <ErrorText k="billing" />
              </div>
              <div>
                <label htmlFor={fid('priceCents')} className={lbl}>Price{form.billing === 'MONTHLY' ? ' per month' : form.billing === 'YEARLY' ? ' per year' : ''}</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500" aria-hidden>$</span>
                  <input id={fid('priceCents')} inputMode="decimal" autoComplete="off" disabled={free} value={free ? '' : form.price} onChange={(e) => { set('price', e.target.value); clearError('priceCents') }}
                    aria-invalid={!!err('priceCents')} aria-describedby={described('priceCents', true)} className={`${inp} pl-7 ${border('priceCents')}`} placeholder={free ? (form.billing === 'GIFT' ? 'Gift: no fee' : 'Free') : '0.00'} />
                </div>
                <p id={`${fid('priceCents')}-hint`} className="mt-1 text-xs text-gray-600">{free ? 'No payment step: the login is made when they accept the terms.' : 'Charged at the payment step, after the terms.'}</p>
                <ErrorText k="priceCents" />
              </div>
              <div>
                <label htmlFor={fid('priceNote')} className={lbl}>Price shown in lists <span className="font-normal text-gray-500">(optional)</span></label>
                <input id={fid('priceNote')} value={form.priceNote} maxLength={40} onChange={(e) => { set('priceNote', e.target.value); clearError('priceNote') }} aria-invalid={!!err('priceNote')} aria-describedby={described('priceNote', true)} className={`${inp} ${border('priceNote')}`} placeholder={priceLabel({ billing: form.billing, priceCents: Math.round((parseFloat(form.price) || 0) * 100), priceNote: null })} />
                <p id={`${fid('priceNote')}-hint`} className="mt-1 text-xs text-gray-600">Replaces the price in summaries, e.g. &quot;$29–399/mo&quot;. Leave blank to show the price.</p>
                <ErrorText k="priceNote" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 min-h-[44px] text-sm text-gray-800">
                  <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="h-[18px] w-[18px] accent-primary-700 focus-visible:ring-2 focus-visible:ring-primary-600" />
                  Offer this role on discovery calls
                </label>
              </div>
              {sponsor && (
                <div className="md:col-span-2">
                  <label htmlFor={fid('handoffUrl')} className={lbl}>Donation page link</label>
                  <input id={fid('handoffUrl')} type="url" inputMode="url" value={form.handoffUrl} maxLength={500} onChange={(e) => { set('handoffUrl', e.target.value); clearError('handoffUrl') }} aria-invalid={!!err('handoffUrl')} aria-describedby={described('handoffUrl', true)} className={`${inp} ${border('handoffUrl')}`} placeholder="https://…" />
                  <p id={`${fid('handoffUrl')}-hint`} className="mt-1 text-xs text-gray-600">Where sponsors go to give. Must start with https://.</p>
                  <ErrorText k="handoffUrl" />
                </div>
              )}
            </div>
          </section>

          {sponsor ? (
            <section className={card}>
              <h2 className="text-lg font-bold text-gray-900">Assessment, orientation and terms</h2>
              <p className="text-sm text-gray-600">Sponsors skip these steps: once the role is chosen on the call they are sent to the donation page, and no login is created.</p>
            </section>
          ) : (
            <>
              {/* ---- Assessment ---- */}
              <section className={card} aria-labelledby="rs-assess-h">
                <div>
                  <h2 id="rs-assess-h" className="text-lg font-bold text-gray-900">Assessment: 3 questions</h2>
                  <p className="text-sm text-gray-600">Emailed after the discovery call. Each role has its own three.</p>
                </div>
                {form.questions.map((q, i) => (
                  <QuestionEditor key={i} i={i} q={q} errors={errors}
                    onText={(v) => { setQuestion(i, { text: v }); clearError(`questions.${i}.text`) }}
                    onType={(t) => { setQuestion(i, { type: t, choices: t === 'CHOICE' && q.choices.length < 2 ? ['', ''] : q.choices }); clearError(`questions.${i}.choices`) }}
                    onChoices={(c) => { setQuestion(i, { choices: c }); clearError(`questions.${i}.choices`) }} />
                ))}
              </section>

              {/* ---- Orientation ---- */}
              <section className={card} aria-labelledby="rs-orient-h">
                <h2 id="rs-orient-h" className="text-lg font-bold text-gray-900">Orientation</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_10rem]">
                  <div>
                    <label htmlFor={fid('orientationUrl')} className={lbl}>Recording link</label>
                    <input id={fid('orientationUrl')} type="url" inputMode="url" value={form.orientationUrl} maxLength={500} onChange={(e) => { set('orientationUrl', e.target.value); clearError('orientationUrl') }} aria-invalid={!!err('orientationUrl')} aria-describedby={described('orientationUrl', true)} className={`${inp} ${border('orientationUrl')}`} placeholder="https://…" />
                    <p id={`${fid('orientationUrl')}-hint`} className="mt-1 text-xs text-gray-600">YouTube, Vimeo or a Zoom recording. Must start with https://.</p>
                    <ErrorText k="orientationUrl" />
                  </div>
                  <div>
                    <label htmlFor={fid('orientationMinutes')} className={lbl}>Length (minutes)</label>
                    <input id={fid('orientationMinutes')} inputMode="numeric" value={form.orientationMinutes} maxLength={3} onChange={(e) => { set('orientationMinutes', e.target.value); clearError('orientationMinutes') }} aria-invalid={!!err('orientationMinutes')} aria-describedby={described('orientationMinutes')} className={`${inp} ${border('orientationMinutes')}`} placeholder="e.g. 40" />
                    <ErrorText k="orientationMinutes" />
                  </div>
                </div>
                <fieldset aria-describedby={described('orientationPoints', true)}>
                  <legend className={lbl}>Key points (&quot;In this video&quot;)</legend>
                  <p id={`${fid('orientationPoints')}-hint`} className="text-xs text-gray-600 mb-2">Listed under the recording so they know what to look for.</p>
                  <ol id={fid('orientationPoints')} tabIndex={-1} className="space-y-2 focus:outline-none">
                    {form.orientationPoints.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <label htmlFor={`rs-point-${i}`} className="sr-only">Key point {i + 1}</label>
                        <input id={`rs-point-${i}`} value={p} maxLength={300} onChange={(e) => { set('orientationPoints', form.orientationPoints.map((x, j) => (j === i ? e.target.value : x))); clearError('orientationPoints') }} className={`${inp} ${border('orientationPoints')}`} placeholder={`Key point ${i + 1}`} />
                        <button type="button" onClick={() => set('orientationPoints', form.orientationPoints.length > 1 ? form.orientationPoints.filter((_, j) => j !== i) : [''])} aria-label={`Remove key point ${i + 1}`} className={`${btnSecondary} w-11 px-0 shrink-0`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                      </li>
                    ))}
                  </ol>
                  {form.orientationPoints.length < MAX_POINTS && <button type="button" onClick={() => set('orientationPoints', [...form.orientationPoints, ''])} className={`${btnSecondary} mt-2 h-10`}><Plus className="h-4 w-4" aria-hidden />Add a point</button>}
                  <ErrorText k="orientationPoints" />
                </fieldset>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm text-gray-800 min-h-[44px] py-2">
                    <input type="checkbox" checked={form.comprehensionCheck} onChange={(e) => { set('comprehensionCheck', e.target.checked); clearError('comprehensionQuestion') }} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-primary-700" />
                    Ask a short &quot;did you understand&quot; check at the end
                  </label>
                  {form.comprehensionCheck && (
                    <div>
                      <label htmlFor={fid('comprehensionQuestion')} className={lbl}>Check question</label>
                      <input id={fid('comprehensionQuestion')} value={form.comprehensionQuestion} maxLength={500} onChange={(e) => { set('comprehensionQuestion', e.target.value); clearError('comprehensionQuestion') }} aria-invalid={!!err('comprehensionQuestion')} aria-describedby={described('comprehensionQuestion')} className={`${inp} ${border('comprehensionQuestion')}`} placeholder="e.g. In your own words, what will you do in this role each week?" />
                      <ErrorText k="comprehensionQuestion" />
                    </div>
                  )}
                </div>
              </section>

              {/* ---- Terms ---- */}
              <section className={card} aria-labelledby="rs-terms-h">
                <h2 id="rs-terms-h" className="text-lg font-bold text-gray-900">Terms</h2>
                <div>
                  <label htmlFor={fid('terms')} className="sr-only">{saved[role].config.label} terms</label>
                  <textarea id={fid('terms')} value={form.terms} onChange={(e) => { set('terms', e.target.value); clearError('terms') }} rows={8} maxLength={50000}
                    aria-invalid={!!err('terms')} aria-describedby={described('terms', true)}
                    className={`w-full min-h-[160px] rounded-lg border px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 ${border('terms')}`} />
                  <p id={`${fid('terms')}-hint`} className="mt-1 text-xs text-gray-600">{termsLine}</p>
                  {termsDirty && form.terms.trim() && <p className="mt-1 text-sm font-semibold text-amber-800">Saving publishes version {live.version + 1}.{live.version > 0 ? ` Anyone who accepted version ${live.version} keeps it.` : ''}</p>}
                  <ErrorText k="terms" />
                </div>
                {roleHistory.length > 0 && (
                  <details className="rounded-lg border border-gray-200">
                    <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 rounded-lg">All versions ({roleHistory.length})</summary>
                    <ul className="divide-y divide-gray-100 border-t border-gray-200">
                      {roleHistory.map((v) => (
                        <li key={v.id} className="p-3 space-y-1">
                          <p className="text-sm text-gray-900"><span className="font-semibold">Version {v.version}</span>{v.version === live.version ? <span className="ml-2 text-xs font-semibold rounded-full px-2 py-0.5 bg-green-100 text-green-800">Live</span> : null}</p>
                          <p className="text-xs text-gray-600">{fmtDate(v.createdAt)}{v.createdBy ? ` · ${v.createdBy}` : ''} · accepted by {v.acceptedCount} {v.acceptedCount === 1 ? 'person' : 'people'}</p>
                          <details>
                            <summary className="cursor-pointer text-xs font-semibold text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 rounded">Show text</summary>
                            <p className="mt-2 whitespace-pre-wrap break-words rounded bg-gray-50 p-2 text-xs text-gray-800">{v.body}</p>
                          </details>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            </>
          )}

          {/* ---- Actions: stuck to the bottom of the screen while editing ---- */}
          <div className="sticky bottom-0 z-10 -mx-4 sm:mx-0 border-t sm:border border-gray-200 bg-white/95 backdrop-blur px-4 py-3 sm:rounded-xl flex flex-wrap items-center justify-end gap-2">
            <div className="mr-auto min-w-0 text-sm" aria-live="polite">
              {banner?.ok ? <span role="status" className="text-green-700 font-semibold">{banner.text}</span>
                : dirty ? <span className="text-amber-800 font-semibold">Unsaved changes</span>
                  : <span className="text-gray-500">No changes</span>}
            </div>
            {dirty && <button type="button" onClick={() => { setForm(baseline); setErrors({}); setBanner(null) }} disabled={busy} className={btnSecondary}>Discard</button>}
            <button type="button" onClick={() => setPreview(true)} className={btnSecondary}><Eye className="h-4 w-4" aria-hidden /><span>Preview<span className="hidden sm:inline"> as prospect</span></span></button>
            <button type="submit" disabled={busy || !dirty} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>

      {/* Dialogs use z-[100]: above the fixed header (z-30) and sidebar (z-50). */}
      {preview && <RolePreview cfg={formToConfig(role, form)} terms={form.terms} termsVersion={previewVersion} onClose={closePreview} />}

      {pending && (
        <LeaveDialog label={saved[role].config.label}
          onStay={stay}
          onLeave={() => {
            const p = pending
            setPending(null)
            if (p.role) goToRole(p.role)
            else if (p.href) { dirtyRef.current = false; router.push(p.href) }
          }} />
      )}
    </div>
  )
}

function QuestionEditor({ i, q, errors, onText, onType, onChoices }: {
  i: number
  q: RoleForm['questions'][number]
  errors: Record<string, string>
  onText: (v: string) => void
  onType: (t: AnswerTypeValue) => void
  onChoices: (c: string[]) => void
}) {
  const tk = `questions.${i}.text`
  const ck = `questions.${i}.choices`
  return (
    <div className="rounded-lg border border-gray-200 p-3 sm:p-4 space-y-3">
      <div>
        <label htmlFor={fid(tk)} className={lbl}>Question {i + 1}</label>
        <input id={fid(tk)} value={q.text} maxLength={500} onChange={(e) => onText(e.target.value)} aria-invalid={!!errors[tk]} aria-describedby={errors[tk] ? `${fid(tk)}-err` : undefined}
          className={`${inp} ${errors[tk] ? 'border-red-500' : 'border-gray-300'}`} placeholder="[To be written]" />
        {errors[tk] && <p id={`${fid(tk)}-err`} className="mt-1 text-sm text-red-700">{errors[tk]}</p>}
      </div>
      <fieldset>
        <legend className="text-xs font-semibold text-gray-600 mb-1.5">Answer type</legend>
        <div className="flex flex-wrap gap-2">
          {ANSWER_TYPES.map((t) => (
            <label key={t.value} className="relative">
              <input type="radio" name={`rs-type-${i}`} value={t.value} checked={q.type === t.value} onChange={() => onType(t.value)} className="peer sr-only" />
              <span className={`${chip} h-9 ${q.type === t.value ? 'border-primary-700 bg-primary-700 text-white font-semibold' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {q.type === 'SCALE_1_5' && <p className="text-xs text-gray-600">They pick a number from 1 (not at all) to 5 (very much).</p>}
      {q.type === 'SHORT_TEXT' && <p className="text-xs text-gray-600">They type a short answer.</p>}
      {q.type === 'CHOICE' && (
        <fieldset aria-describedby={errors[ck] ? `${fid(ck)}-err` : undefined}>
          <legend className="text-xs font-semibold text-gray-600 mb-1.5">Options (they pick one; 2 to {MAX_CHOICES})</legend>
          <ol id={fid(ck)} tabIndex={-1} className="space-y-2 focus:outline-none">
            {q.choices.map((c, j) => (
              <li key={j} className="flex gap-2">
                <label htmlFor={`rs-q${i}-opt${j}`} className="sr-only">Question {i + 1}, option {j + 1}</label>
                <input id={`rs-q${i}-opt${j}`} value={c} maxLength={200} onChange={(e) => onChoices(q.choices.map((x, k) => (k === j ? e.target.value : x)))}
                  aria-invalid={!!errors[ck] && !c.trim()} className={`${inp} ${errors[ck] && !c.trim() ? 'border-red-500' : 'border-gray-300'}`} placeholder={`Option ${j + 1}`} />
                <button type="button" disabled={q.choices.length <= 2} onClick={() => onChoices(q.choices.filter((_, k) => k !== j))} aria-label={`Remove option ${j + 1} from question ${i + 1}`} className={`${btnSecondary} w-11 px-0 shrink-0`}><Trash2 className="h-4 w-4" aria-hidden /></button>
              </li>
            ))}
          </ol>
          {q.choices.length < MAX_CHOICES && <button type="button" onClick={() => onChoices([...q.choices, ''])} className={`${btnSecondary} mt-2 h-10`}><Plus className="h-4 w-4" aria-hidden />Add an option</button>}
          {errors[ck] && <p id={`${fid(ck)}-err`} className="mt-1 text-sm text-red-700">{errors[ck]}</p>}
        </fieldset>
      )}
    </div>
  )
}

function LeaveDialog({ label, onStay, onLeave }: { label: string; onStay: () => void; onLeave: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    stayRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onStay() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onStay])
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="leave-h" aria-describedby="leave-d" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-4">
        <h2 id="leave-h" className="text-lg font-bold text-gray-900">Leave without saving?</h2>
        <p id="leave-d" className="text-sm text-gray-700">Your changes to {label} have not been saved. If you leave now they will be lost.</p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onLeave} className={btnSecondary}>Discard changes</button>
          <button ref={stayRef} type="button" onClick={onStay} className={btnPrimary}>Keep editing</button>
        </div>
      </div>
    </div>
  )
}
