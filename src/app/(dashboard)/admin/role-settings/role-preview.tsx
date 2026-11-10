'use client'

/**
 * "Preview as prospect": the unsaved form rendered the way the journey pages show it
 * (assessment, orientation, join / give). Nothing in here is interactive except the tabs.
 */
import { useEffect, useRef, useState } from 'react'
import { X, PlayCircle, AlertTriangle } from 'lucide-react'
import { RoleConfig, billingLabel, formatDollars, isPaidRole } from '@/lib/get-involved/core'

type Tab = 'assessment' | 'orientation' | 'join'

const fakeInput = 'w-full min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-400'
const fakeBtn = 'inline-flex items-center justify-center h-12 px-5 rounded-xl text-sm font-semibold'

export function RolePreview({ cfg, terms, termsVersion, onClose }: { cfg: RoleConfig; terms: string; termsVersion: string; onClose: () => void }) {
  const sponsor = cfg.role === 'SPONSOR'
  const tabs: { key: Tab; label: string }[] = sponsor
    ? [{ key: 'join', label: 'Give page' }]
    : [{ key: 'assessment', label: 'Assessment' }, { key: 'orientation', label: 'Orientation' }, { key: 'join', label: 'Join' }]
  const [tab, setTab] = useState<Tab>(tabs[0].key)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Tab' && panelRef.current) {
        // Keep focus inside the dialog.
        const f = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'))
        if (f.length === 0) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus() }
  }, [onClose])

  const paid = isPaidRole(cfg)
  return (
    <div className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center bg-gray-900/50 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="preview-title" className="bg-gray-50 w-full sm:max-w-3xl sm:rounded-2xl shadow-xl flex flex-col max-h-full sm:max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 sm:px-6 py-4 sm:rounded-t-2xl">
          <div className="min-w-0">
            <h2 id="preview-title" className="font-bold text-gray-900">Preview as prospect: {cfg.label}</h2>
            <p className="text-sm text-gray-600">Shows your unsaved changes. Prospects see this after you save.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close preview" className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"><X className="h-5 w-5" aria-hidden /></button>
        </div>
        {tabs.length > 1 && (
          <div role="tablist" aria-label="Page to preview" className="flex gap-1 border-b border-gray-200 bg-white px-4 sm:px-6 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" id={`pv-tab-${t.key}`} aria-selected={tab === t.key} aria-controls="pv-panel" tabIndex={tab === t.key ? 0 : -1}
                onClick={() => setTab(t.key)}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                  const i = tabs.findIndex((x) => x.key === tab)
                  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].key
                  setTab(next); document.getElementById(`pv-tab-${next}`)?.focus()
                }}
                className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${tab === t.key ? 'border-primary-700 text-primary-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>{t.label}</button>
            ))}
          </div>
        )}
        <div id="pv-panel" role={tabs.length > 1 ? 'tabpanel' : undefined} aria-labelledby={tabs.length > 1 ? `pv-tab-${tab}` : undefined} className="overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-2xl bg-white border border-gray-200 rounded-2xl p-5 md:p-8 space-y-5" aria-hidden="true">
            {tab === 'assessment' && !sponsor && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-700">Role assessment · {cfg.label}</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">Three quick questions</h3>
                  <p className="text-gray-600 mt-1">Great talking with you, Jordan. These help us prepare your orientation. About 5 minutes.</p>
                </div>
                {cfg.questions.map((q, i) => (
                  <div key={i} className="space-y-2">
                    <p className="font-semibold text-gray-900 break-words">{i + 1}. {q.text || <span className="text-red-700">[No question yet]</span>}</p>
                    {q.type === 'SHORT_TEXT' && <div className={`${fakeInput} min-h-[88px]`}>Type your answer</div>}
                    {q.type === 'CHOICE' && (
                      <div className="space-y-2">
                        {(q.choices.length ? q.choices : ['[Option]']).map((c, j) => (
                          <div key={j} className="flex items-center gap-3 min-h-[44px] rounded-xl border border-gray-300 px-3 text-sm text-gray-800"><span className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-400" />{c}</div>
                        ))}
                      </div>
                    )}
                    {q.type === 'SCALE_1_5' && (
                      <div>
                        <div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-12 rounded-xl border border-gray-300 flex items-center justify-center font-semibold text-gray-800">{n}</div>)}</div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1"><span>1 · Not at all</span><span>5 · Very much</span></div>
                      </div>
                    )}
                  </div>
                ))}
                <div className={`${fakeBtn} w-full bg-primary-700 text-white`}>Submit answers</div>
              </>
            )}

            {tab === 'orientation' && !sponsor && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-700">Role orientation</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{cfg.label} orientation</h3>
                  <p className="text-gray-600 mt-1">What being a {cfg.label.toLowerCase()} looks like</p>
                </div>
                <div className="aspect-video rounded-xl bg-gray-900 text-white flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <PlayCircle className="h-12 w-12 opacity-90" />
                  <span className="text-sm">{cfg.orientationUrl ? 'Recording' : 'No recording link yet'}{cfg.orientationMinutes ? ` · ${cfg.orientationMinutes} min` : ''}</span>
                </div>
                {!cfg.orientationUrl && <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />Add a recording link before prospects reach this step.</p>}
                {cfg.orientationPoints.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-900">In this video</p>
                    <ul className="mt-2 space-y-1 list-disc pl-5 text-gray-700">{cfg.orientationPoints.map((p, i) => <li key={i} className="break-words">{p}</li>)}</ul>
                  </div>
                )}
                {cfg.comprehensionCheck && (
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-900 break-words">Quick check: {cfg.comprehensionQuestion || <span className="text-red-700">[No question yet]</span>}</p>
                    <div className={fakeInput}>Type your answer</div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className={`${fakeBtn} bg-primary-700 text-white`}>I&apos;ve watched it: continue</div>
                  <div className={`${fakeBtn} border border-gray-300 text-gray-800`}>Remind me later: pick a date</div>
                </div>
              </>
            )}

            {tab === 'join' && !sponsor && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-700">Join · {cfg.label}</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">Accept the {cfg.label.toLowerCase()} terms</h3>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">{termsVersion}</p>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 whitespace-pre-wrap break-words">{terms || '[No terms yet]'}</div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-800"><span className="h-[18px] w-[18px] shrink-0 rounded border-2 border-gray-400" />I have read and accept the {cfg.label.toLowerCase()} terms</div>
                <div className={fakeInput}>Choose a password</div>
                {paid ? (
                  <div className="rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700">{cfg.label} fee · {billingLabel(cfg.billing)}</span>
                    <span className="font-bold text-gray-900">{cfg.priceNote || `${formatDollars(cfg.priceCents)}${cfg.billing === 'MONTHLY' ? '/mo' : cfg.billing === 'YEARLY' ? '/yr' : ''}`}</span>
                  </div>
                ) : <p className="text-sm text-gray-600">This role is free: the login is created as soon as they accept.</p>}
                <div className={`${fakeBtn} w-full bg-primary-700 text-white`}>{paid ? 'Accept and continue to payment' : 'Accept and create my login'}</div>
              </>
            )}

            {sponsor && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-700">{cfg.label}</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">Thank you for wanting to give</h3>
                  <p className="text-gray-600 mt-1">Your gift helps young people take their next step. The donation page opens on our giving site.</p>
                </div>
                {cfg.handoffUrl
                  ? <div className={`${fakeBtn} w-full bg-primary-700 text-white`}>Go to the donation page</div>
                  : <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />Add the donation page link so sponsors have somewhere to go.</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
