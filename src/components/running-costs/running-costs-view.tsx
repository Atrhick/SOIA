'use client'

import { useMemo, useState } from 'react'
import { Calculator, ExternalLink, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  COST_CATEGORIES,
  COST_STATUSES,
  SCOPE_LABELS,
  computeTotals,
  filledAmounts,
  formatMoney,
  groupByCategory,
  inScope,
  statusLabel,
  type TotalsScope,
} from '@/lib/running-costs/core'
import { AI_MODELS, AI_TASKS, DEFAULT_AI_MODEL, RETRY_FACTOR, estimateAiMonthly, type AiCounts } from '@/lib/running-costs/ai'
import { createCostItem, deleteCostItem, updateCostItem, type CostItemInput } from '@/lib/actions/running-costs'
import type { CostItemView } from '@/lib/running-costs/server'

const STATUS_PILL: Record<string, string> = {
  IN_USE: 'bg-green-100 text-green-800',
  PLANNED: 'bg-blue-100 text-blue-800',
  SUGGESTED: 'bg-amber-100 text-amber-800',
}

const FIELD = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

function checkedOn(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

function amount(n: number | null): string {
  return n == null ? '-' : formatMoney(n)
}

export function RunningCostsView({ items: initialItems, canEdit }: { items: CostItemView[]; canEdit: boolean }) {
  const [items, setItems] = useState(initialItems)
  const [scope, setScope] = useState<TotalsScope>('IN_USE_AND_PLANNED')
  const [editingId, setEditingId] = useState<string | null>(null) // 'new' = the add form
  const [error, setError] = useState<string | null>(null)

  const totals = useMemo(() => computeTotals(items, scope), [items, scope])
  const groups = useMemo(() => groupByCategory(items), [items])

  const onSaved = (item: CostItemView) => {
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]))
    setEditingId(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Running costs</h1>
          <p className="mt-1 text-sm text-gray-600">
            What it costs each month to run the app and the services around it. Every amount is an estimate in US dollars,
            with the price we used and the date we checked it.
          </p>
        </div>
        {canEdit && editingId !== 'new' && (
          <Button onClick={() => { setEditingId('new'); setError(null) }}>
            <Plus className="mr-2 h-4 w-4" /> Add a line
          </Button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="rc-scope" className="text-gray-700">Count in the totals:</label>
        <select id="rc-scope" value={scope} onChange={(e) => setScope(e.target.value as TotalsScope)} className="rounded-md border border-gray-300 px-3 py-2 text-sm max-w-full">
          {(Object.keys(SCOPE_LABELS) as TotalsScope[]).map((s) => (
            <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="stat-grid grid grid-cols-2 gap-4 md:grid-cols-4">
        <Total label="Low, per month" value={totals.low} />
        <Total label="Expected, per month" value={totals.expected} strong />
        <Total label="High, per month" value={totals.high} />
        <Total label="Expected, per year" value={totals.yearlyExpected} />
      </div>
      <p className="-mt-3 text-xs text-gray-500">
        {totals.count} {totals.count === 1 ? 'line' : 'lines'} counted. Lines marked &quot;not counted&quot; (other choices, per-payment fees) are never added.
      </p>

      {canEdit && editingId === 'new' && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Add a line</h2>
            <CostItemForm onCancel={() => setEditingId(null)} onSaved={onSaved} />
          </CardContent>
        </Card>
      )}

      {groups.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No costs added yet.</p>
      )}

      {groups.map((group) => {
        const sub = computeTotals(group.rows, scope)
        return (
          <section key={group.key} aria-labelledby={`rc-${group.key}`}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 id={`rc-${group.key}`} className="text-lg font-semibold text-gray-900">{group.label}</h2>
              <span className="text-sm text-gray-600">Expected {formatMoney(sub.expected)} a month</span>
            </div>
            <div className="space-y-3">
              {group.rows.map((item) =>
                canEdit && editingId === item.id ? (
                  <Card key={item.id}>
                    <CardContent className="p-4 sm:p-6">
                      <CostItemForm item={item} onCancel={() => setEditingId(null)} onSaved={onSaved} />
                    </CardContent>
                  </Card>
                ) : (
                  <CostRow
                    key={item.id}
                    item={item}
                    counted={inScope(item.status, scope)}
                    canEdit={canEdit}
                    onEdit={() => { setEditingId(item.id); setError(null) }}
                    onRemoved={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                    onError={setError}
                  />
                ),
              )}
            </div>
          </section>
        )
      })}

      <AiCalculator />
    </div>
  )
}

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Wallet className="h-5 w-5" aria-hidden="true" /></div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-2xl ${strong ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{formatMoney(value)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CostRow({
  item, counted, canEdit, onEdit, onRemoved, onError,
}: {
  item: CostItemView
  counted: boolean
  canEdit: boolean
  onEdit: () => void
  onRemoved: () => void
  onError: (e: string | null) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const noAmounts = item.monthlyLow == null && item.monthlyExpected == null && item.monthlyHigh == null
  const filled = filledAmounts(item)
  const checked = checkedOn(item.checkedAt)

  const remove = async () => {
    setBusy(true)
    const res = await deleteCostItem(item.id)
    setBusy(false)
    if ('error' in res) { onError(res.error); setConfirming(false); return }
    onRemoved()
  }

  return (
    <Card className={counted ? '' : 'opacity-80'}>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 break-words">{item.service}</h3>
            {item.whatFor && <p className="text-sm text-gray-600 break-words">{item.whatFor}</p>}
            {item.provider && <p className="text-xs text-gray-500">From {item.provider}</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[item.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {statusLabel(item.status)}
          </span>
        </div>

        {noAmounts ? (
          <p className="text-sm text-gray-600">Not counted in the totals.</p>
        ) : (
          <dl className="grid grid-cols-3 gap-2 rounded-md bg-gray-50 p-3 text-center">
            <div><dt className="text-xs text-gray-500">Low</dt><dd className="font-medium text-gray-800">{amount(filled.low)}</dd></div>
            <div><dt className="text-xs text-gray-500">Expected</dt><dd className="font-semibold text-gray-900">{amount(filled.expected)}</dd></div>
            <div><dt className="text-xs text-gray-500">High</dt><dd className="font-medium text-gray-800">{amount(filled.high)}</dd></div>
          </dl>
        )}
        {!noAmounts && !counted && <p className="text-xs text-gray-500">Not in the totals with the current setting above.</p>}

        {item.unitPrice && <p className="text-sm text-gray-700 break-words"><span className="font-medium">Price: </span>{item.unitPrice}</p>}
        {item.pricingNote && <p className="text-sm text-gray-600 break-words"><span className="font-medium text-gray-700">How we got these numbers: </span>{item.pricingNote}</p>}
        {item.notes && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 break-words">{item.notes}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span className="min-w-0 break-words">
            {checked ? `Price checked on ${checked}` : 'Price not checked yet'}
            {item.sourceUrl && (
              <>
                {' '}
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-700 underline break-all">
                  source <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </>
            )}
          </span>
          {canEdit && (
            confirming ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-gray-700">Remove this line?</span>
                <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>Yes, remove</Button>
                <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={busy}>Keep it</Button>
              </span>
            ) : (
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Edit ${item.service}`}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-red-700" onClick={() => setConfirming(true)} aria-label={`Remove ${item.service}`}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              </span>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}

type FormState = Record<
  'category' | 'service' | 'whatFor' | 'provider' | 'unitPrice' | 'pricingNote' | 'monthlyLow' | 'monthlyExpected' | 'monthlyHigh' | 'status' | 'sourceUrl' | 'checkedAt' | 'notes' | 'sortOrder',
  string
>

function toForm(item?: CostItemView): FormState {
  const n = (v: number | null | undefined) => (v == null ? '' : String(v))
  return {
    category: item?.category ?? 'HOSTING',
    service: item?.service ?? '',
    whatFor: item?.whatFor ?? '',
    provider: item?.provider ?? '',
    unitPrice: item?.unitPrice ?? '',
    pricingNote: item?.pricingNote ?? '',
    monthlyLow: n(item?.monthlyLow),
    monthlyExpected: n(item?.monthlyExpected),
    monthlyHigh: n(item?.monthlyHigh),
    status: item?.status ?? 'PLANNED',
    sourceUrl: item?.sourceUrl ?? '',
    checkedAt: item?.checkedAt ? item.checkedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: item?.notes ?? '',
    sortOrder: String(item?.sortOrder ?? 100),
  }
}

function toInput(f: FormState): CostItemInput | string {
  const num = (s: string, label: string): number | null | string => {
    const t = s.trim().replace(/[$,]/g, '')
    if (!t) return null
    const v = Number(t)
    return Number.isFinite(v) && v >= 0 ? v : `${label} must be a number, 0 or more.`
  }
  const low = num(f.monthlyLow, 'Low')
  const expected = num(f.monthlyExpected, 'Expected')
  const high = num(f.monthlyHigh, 'High')
  for (const v of [low, expected, high]) if (typeof v === 'string') return v
  const sort = Number(f.sortOrder || '0')
  return {
    category: f.category as CostItemInput['category'],
    service: f.service,
    whatFor: f.whatFor,
    provider: f.provider,
    unitPrice: f.unitPrice,
    pricingNote: f.pricingNote,
    monthlyLow: low as number | null,
    monthlyExpected: expected as number | null,
    monthlyHigh: high as number | null,
    status: f.status as CostItemInput['status'],
    sourceUrl: f.sourceUrl,
    checkedAt: f.checkedAt,
    notes: f.notes,
    sortOrder: Number.isInteger(sort) && sort >= 0 ? sort : 0,
  }
}

function CostItemForm({ item, onCancel, onSaved }: { item?: CostItemView; onCancel: () => void; onSaved: (i: CostItemView) => void }) {
  const [f, setF] = useState<FormState>(() => toForm(item))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }))
  const id = (k: string) => `rc-${item?.id ?? 'new'}-${k}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const input = toInput(f)
    if (typeof input === 'string') { setError(input); return }
    setSaving(true)
    const res = item ? await updateCostItem(item.id, input) : await createCostItem(input)
    setSaving(false)
    if (res.error !== undefined) { setError(res.error); return }
    onSaved(res.item)
  }

  const text = (k: keyof FormState, label: string, placeholder?: string) => (
    <div>
      <label htmlFor={id(k)} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input id={id(k)} value={f[k]} onChange={set(k)} placeholder={placeholder} className={FIELD} />
    </div>
  )
  const area = (k: keyof FormState, label: string) => (
    <div className="sm:col-span-2">
      <label htmlFor={id(k)} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <textarea id={id(k)} value={f[k]} onChange={set(k)} rows={2} className={FIELD} />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4" aria-label={item ? `Edit ${item.service}` : 'Add a line'}>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {text('service', 'Service', 'e.g. Google Cloud Run')}
        {text('provider', 'Company', 'e.g. Google Cloud')}
        <div>
          <label htmlFor={id('category')} className="mb-1 block text-sm font-medium text-gray-700">Group</label>
          <select id={id('category')} value={f.category} onChange={set('category')} className={FIELD}>
            {COST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={id('status')} className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select id={id('status')} value={f.status} onChange={set('status')} className={FIELD}>
            {COST_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        {area('whatFor', 'What we use it for')}
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-gray-700">Per month, in US dollars (leave all three empty for &quot;not counted&quot;)</legend>
        <div className="grid grid-cols-3 gap-2">
          {(['monthlyLow', 'monthlyExpected', 'monthlyHigh'] as const).map((k) => (
            <div key={k} className="min-w-0">
              <label htmlFor={id(k)} className="mb-1 block text-xs text-gray-600">{k === 'monthlyLow' ? 'Low' : k === 'monthlyExpected' ? 'Expected' : 'High'}</label>
              <input id={id(k)} inputMode="decimal" value={f[k]} onChange={set(k)} className={FIELD} />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {area('unitPrice', 'Price (as the company lists it)')}
        {area('pricingNote', 'How we got these numbers')}
        {text('sourceUrl', 'Link to the price page', 'https://')}
        <div>
          <label htmlFor={id('checkedAt')} className="mb-1 block text-sm font-medium text-gray-700">Price checked on</label>
          <input id={id('checkedAt')} type="date" value={f.checkedAt} onChange={set('checkedAt')} className={FIELD} />
        </div>
        {area('notes', 'Notes and open questions')}
        <div>
          <label htmlFor={id('sortOrder')} className="mb-1 block text-sm font-medium text-gray-700">Order in its group</label>
          <input id={id('sortOrder')} inputMode="numeric" value={f.sortOrder} onChange={set('sortOrder')} className={FIELD} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving} isLoading={saving}>{item ? 'Save changes' : 'Add line'}</Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
  )
}

function AiCalculator() {
  const [counts, setCounts] = useState<Record<keyof AiCounts, string>>({ pages: '8', welcome: '20', messages: '300' })
  const [modelId, setModelId] = useState(DEFAULT_AI_MODEL)
  const estimate = estimateAiMonthly(
    { pages: Number(counts.pages), welcome: Number(counts.welcome), messages: Number(counts.messages) },
    modelId,
  )

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary-700" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-900">AI use calculator</h2>
        </div>
        <p className="text-sm text-gray-600">Type how many of each you expect in a month and pick a model. This is an estimate, not a bill.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AI_TASKS.map((t) => (
            <div key={t.key}>
              <label htmlFor={`ai-${t.key}`} className="mb-1 block text-sm font-medium text-gray-700">{t.label} a month</label>
              <input
                id={`ai-${t.key}`}
                type="number"
                min={0}
                inputMode="numeric"
                value={counts[t.key]}
                onChange={(e) => setCounts((prev) => ({ ...prev, [t.key]: e.target.value }))}
                className={FIELD}
              />
            </div>
          ))}
          <div>
            <label htmlFor="ai-model" className="mb-1 block text-sm font-medium text-gray-700">Model</label>
            <select id="ai-model" value={modelId} onChange={(e) => setModelId(e.target.value)} className={FIELD}>
              {AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-md bg-emerald-50 p-4">
          <p className="text-sm text-emerald-900">Estimated cost a month</p>
          <p className="text-3xl font-bold text-emerald-900" data-testid="ai-total">{formatMoney(estimate.total)}</p>
          <ul className="mt-2 space-y-1 text-sm text-emerald-900">
            {estimate.lines.map((l) => (
              <li key={l.key} className="break-words">{l.count} {l.label.toLowerCase()} at about {formatMoney(l.costEach)} each = {formatMoney(l.cost)}</li>
            ))}
          </ul>
        </div>

        <details className="text-sm text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-700">What this assumes</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{estimate.model.label}: {formatMoney(estimate.model.inputPerMillion)} per million tokens sent, {formatMoney(estimate.model.outputPerMillion)} per million written (list price, checked 19 November 2026, <a className="text-primary-700 underline" href={estimate.model.sourceUrl} target="_blank" rel="noopener noreferrer">source</a>).</li>
            <li>A token is about three quarters of a word: 1,000 tokens is about 750 words.</li>
            {AI_TASKS.map((t) => <li key={t.key}>{t.label}: {t.assumption}</li>)}
            <li>Some drafts get asked for again, so each one is counted as {RETRY_FACTOR} tries.</li>
            <li>The model&apos;s thinking is billed as written tokens and is included above.</li>
          </ul>
        </details>
      </CardContent>
    </Card>
  )
}
