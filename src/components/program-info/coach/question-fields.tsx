'use client'

/**
 * One question from questions.ts as a form field: a real label, the hint and the example as text under
 * it (never placeholders), and an error spot. Used by the section screens (autosaved) and by the
 * Question screen (sent with the reply).
 */
import { COST_FREQUENCIES, COST_FREQUENCY_LABELS, questionById, type CostAnswer, type CostFrequency, type InfoQuestion } from '@/lib/program-info/questions'
import { ui } from './ui'
import { useAutosave } from './autosave'

export function asCost(v: unknown): CostAnswer {
  const o = v && typeof v === 'object' ? (v as Partial<CostAnswer>) : {}
  return {
    price: typeof o.price === 'string' ? o.price : '',
    frequency: o.frequency && (COST_FREQUENCIES as readonly string[]).includes(o.frequency) ? (o.frequency as CostFrequency) : null,
    sponsoredPrice: typeof o.sponsoredPrice === 'string' ? o.sponsoredPrice : '',
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null
  return <p id={id} className="m-0 text-sm font-semibold text-red-700">{text}</p>
}

interface InputProps {
  q: InfoQuestion
  value: unknown
  onChange: (v: unknown, opts?: { immediate?: boolean }) => void
  onBlur?: () => void
  error?: string
  disabled?: boolean
  idPrefix?: string
  /** Replaces the question's label (e.g. "Usual price" on a team question). */
  label?: string
  /** Hide the example line (e.g. inside a team question). */
  noExample?: boolean
}

/** Cost: price, how often, and the optional price with a sponsorship. */
export function CostInput({ q, value, onChange, onBlur, error, disabled, idPrefix = 'q', label }: InputProps) {
  const c = asCost(value)
  const id = `${idPrefix}-${q.id}`
  const set = (patch: Partial<CostAnswer>, immediate?: boolean) => onChange({ ...c, ...patch }, { immediate })
  const still = !c.price.trim() ? 'the price' : !c.frequency ? 'how often' : null
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" disabled={disabled}>
      <legend className={`${ui.label} mb-1.5 p-0`}>{label ?? q.label}</legend>
      {q.hint && <p className={ui.hint}>{q.hint}</p>}
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end lg:gap-5">
        <div className="flex flex-col gap-1.5 lg:w-[220px]">
          <label htmlFor={`${id}-price`} className={ui.labelSm}>Price</label>
          <input id={`${id}-price`} className={ui.box} value={c.price} maxLength={40} aria-describedby={`${id}-ex${error ? ` ${id}-err` : ''}`} aria-invalid={error ? true : undefined}
            onChange={(e) => set({ price: e.target.value })} onBlur={onBlur} />
        </div>
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className={`${ui.labelSm} mb-1.5 p-0`}>How often</legend>
          <div className="grid grid-cols-3 gap-2 lg:flex">
            {COST_FREQUENCIES.map((f) => (
              <label key={f} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-[15px] ${c.frequency === f ? 'border-violet-700 bg-violet-50' : 'border-gray-300 bg-white'}`}>
                <input type="radio" name={`${id}-often`} value={f} checked={c.frequency === f} onChange={() => set({ frequency: f }, true)} className="h-5 w-5 accent-violet-700" />
                {COST_FREQUENCY_LABELS[f]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <p id={`${id}-ex`} className={ui.hint}>Example: {q.example}</p>
      <label htmlFor={`${id}-sp`} className={`${ui.labelSm} mt-2`}>Price with a NowTRANSFORMED sponsorship <span className={ui.optional}>Optional</span></label>
      <p id={`${id}-sph`} className={ui.hint}>NowTRANSFORMED helps pay part of the cost for some people. What would they pay? Leave it empty if you&apos;re not sure.</p>
      <input id={`${id}-sp`} className={`${ui.box} lg:max-w-[220px]`} value={c.sponsoredPrice ?? ''} maxLength={40} aria-describedby={`${id}-sph`}
        onChange={(e) => set({ sponsoredPrice: e.target.value })} onBlur={onBlur} />
      {still && !disabled && <p className="m-0 text-sm font-semibold text-amber-800">Still needed: {still}</p>}
      <FieldError id={`${id}-err`} text={error} />
    </fieldset>
  )
}

/** Any question. `extra` is rendered inside it (the Zoom link under "How does it run", the tick box under the quote). */
export function QuestionInput(props: InputProps & { extra?: React.ReactNode; rows?: number }) {
  const { q, value, onChange, onBlur, error, disabled, idPrefix = 'q', label, noExample, extra, rows = 4 } = props
  if (q.kind === 'cost') return <CostInput {...props} />
  const id = `${idPrefix}-${q.id}`
  const describedBy = [q.hint ? `${id}-hint` : '', q.example && !noExample ? `${id}-ex` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined
  if (q.kind === 'checkbox') {
    return (
      <div className="flex flex-col gap-1">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-[15px] leading-snug">
          <input type="checkbox" id={id} checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked, { immediate: true })} className="mt-0.5 h-5 w-5 flex-none accent-violet-700" />
          <span>{label ?? q.label}</span>
        </label>
        <FieldError id={`${id}-err`} text={error} />
      </div>
    )
  }
  const optional = !q.required && <span className={ui.optional}> Optional</span>
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={q.extraOf ? `${ui.labelSm} mt-1.5` : ui.label}>{label ?? q.label}{optional}</label>
      {q.hint && <p id={`${id}-hint`} className={ui.hint}>{q.hint}</p>}
      {q.example && !noExample && <p id={`${id}-ex`} className={ui.example}>Example: {q.kind === 'longtext' && !q.example.startsWith('"') ? `"${q.example}"` : q.example}</p>}
      {q.kind === 'longtext' ? (
        <textarea id={id} rows={rows} className={ui.box} value={str(value)} maxLength={q.maxLength} disabled={disabled}
          aria-describedby={describedBy} aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      ) : (
        <input id={id} type={q.kind === 'url' ? 'url' : 'text'} inputMode={q.kind === 'url' ? 'url' : undefined} className={`${ui.box} ${q.extraOf ? 'lg:max-w-[520px]' : ''}`}
          value={str(value)} maxLength={q.maxLength} disabled={disabled} aria-describedby={describedBy} aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      )}
      <FieldError id={`${id}-err`} text={error} />
      {extra}
    </div>
  )
}

/** A question bound to the page's autosave. */
export function AutoQuestion({ q, extraOf, disabled }: { q: InfoQuestion; extraOf?: InfoQuestion[]; disabled?: boolean }) {
  const { answers, setAnswer, flush, errors, readOnly } = useAutosave()
  const off = disabled || readOnly
  const extras = (extraOf ?? []).map((x) => (
    <QuestionInput key={x.id} q={x} value={answers[x.id]} error={errors[x.id]} disabled={off}
      onChange={(v, o) => setAnswer(x.id, v, o)} onBlur={() => flush(x.id)} />
  ))
  return (
    <QuestionInput q={q} value={answers[q.id]} error={errors[q.id]} disabled={off}
      onChange={(v, o) => setAnswer(q.id, v, o)} onBlur={() => flush(q.id)}
      extra={extras.length ? <div className="mt-1 flex flex-col gap-1.5">{extras}</div> : undefined} />
  )
}

/** The flyer / website link on the page hub. */
export function FlyerField({ disabled }: { disabled?: boolean }) {
  const q = questionById('flyerLink')!
  const { answers, setAnswer, flush, errors, readOnly } = useAutosave()
  const id = 'q-flyerLink'
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="text-base font-bold">Have a flyer or website? <span className={ui.optional}>Optional</span></label>
      <p id={`${id}-hint`} className={ui.hint}>Paste a link and we&apos;ll use it to fill any gaps. Example: your Facebook page.</p>
      <input id={id} type="url" inputMode="url" className={ui.box} value={str(answers[q.id])} maxLength={q.maxLength} disabled={disabled || readOnly}
        aria-describedby={`${id}-hint${errors[q.id] ? ` ${id}-err` : ''}`} aria-invalid={errors[q.id] ? true : undefined}
        onChange={(e) => setAnswer(q.id, e.target.value)} onBlur={() => flush(q.id)} />
      <FieldError id={`${id}-err`} text={errors[q.id]} />
    </div>
  )
}
