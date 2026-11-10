/**
 * Role Settings form model: the editable shape of a RoleConfig + its terms, conversion to the
 * roleConfigInputSchema input, and client-side checks that mirror the server's (so errors show
 * next to fields before a round trip). Error keys are the server's dotted paths.
 */
import { AGE_RANGES, AnswerTypeValue, QUESTION_COUNT, RoleBillingValue, RoleConfig, isPaidRole } from '@/lib/get-involved/core'

export interface QuestionForm { text: string; type: AnswerTypeValue; choices: string[] }

export interface RoleForm {
  label: string
  whoFor: string
  ageRanges: string[]
  active: boolean
  /** Dollars as typed, e.g. "99" or "29.50". */
  price: string
  priceNote: string
  billing: RoleBillingValue
  questions: QuestionForm[]
  orientationUrl: string
  /** Minutes as typed. */
  orientationMinutes: string
  orientationPoints: string[]
  comprehensionCheck: boolean
  comprehensionQuestion: string
  handoffUrl: string
  terms: string
}

export const MAX_CHOICES = 8
export const MAX_POINTS = 10

export function isFreeBilling(b: RoleBillingValue): boolean {
  return b === 'FREE' || b === 'GIFT'
}

export function centsToDollars(cents: number): string {
  if (!cents) return ''
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}

/** null when the text is not a valid amount. */
export function dollarsToCents(v: string): number | null {
  const t = v.replace(/[$,\s]/g, '')
  if (t === '') return 0
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(parseFloat(t) * 100)
}

export function toForm(cfg: RoleConfig, termsBody: string): RoleForm {
  return {
    label: cfg.label,
    whoFor: cfg.whoFor,
    ageRanges: AGE_RANGES.map((a) => a.value).filter((v) => cfg.ageRanges.includes(v)),
    active: cfg.active,
    price: centsToDollars(cfg.priceCents),
    priceNote: cfg.priceNote ?? '',
    billing: cfg.billing,
    questions: cfg.questions.map((q) => ({ text: q.text, type: q.type, choices: q.type === 'CHOICE' ? [...q.choices] : ['', ''] })),
    orientationUrl: cfg.orientationUrl ?? '',
    orientationMinutes: cfg.orientationMinutes ? String(cfg.orientationMinutes) : '',
    orientationPoints: cfg.orientationPoints.length ? [...cfg.orientationPoints] : [''],
    comprehensionCheck: cfg.comprehensionCheck,
    comprehensionQuestion: cfg.comprehensionQuestion ?? '',
    handoffUrl: cfg.handoffUrl ?? '',
    terms: termsBody,
  }
}

/** The form as a RoleConfig, for the prospect preview (invalid numbers fall back to 0 / null). */
export function formToConfig(role: RoleConfig['role'], f: RoleForm): RoleConfig {
  const cents = isFreeBilling(f.billing) ? 0 : dollarsToCents(f.price) ?? 0
  const mins = parseInt(f.orientationMinutes, 10)
  return {
    role,
    label: f.label.trim() || role,
    whoFor: f.whoFor.trim(),
    ageRanges: f.ageRanges as RoleConfig['ageRanges'],
    active: f.active,
    priceCents: cents,
    priceNote: f.priceNote.trim() || null,
    billing: f.billing,
    questions: f.questions.map((q) => ({ text: q.text.trim(), type: q.type, choices: q.type === 'CHOICE' ? q.choices.map((c) => c.trim()).filter(Boolean) : [] })),
    orientationUrl: f.orientationUrl.trim() || null,
    orientationMinutes: Number.isFinite(mins) && mins > 0 ? mins : null,
    orientationPoints: f.orientationPoints.map((p) => p.trim()).filter(Boolean),
    comprehensionCheck: f.comprehensionCheck,
    comprehensionQuestion: f.comprehensionQuestion.trim() || null,
    handoffUrl: f.handoffUrl.trim() || null,
    saved: true,
  }
}

/** What the server action receives (roleConfigInputSchema shape). Call validateForm first. */
export function toInput(role: RoleConfig['role'], f: RoleForm) {
  const mins = f.orientationMinutes.trim() ? parseInt(f.orientationMinutes, 10) : null
  return {
    role,
    label: f.label.trim(),
    whoFor: f.whoFor.trim(),
    ageRanges: f.ageRanges,
    active: f.active,
    priceCents: isFreeBilling(f.billing) ? 0 : dollarsToCents(f.price) ?? 0,
    priceNote: f.priceNote.trim(),
    billing: f.billing,
    questions: f.questions.map((q) => ({ text: q.text.trim(), type: q.type, choices: q.type === 'CHOICE' ? q.choices.map((c) => c.trim()) : [] })),
    orientationUrl: f.orientationUrl.trim(),
    orientationMinutes: mins,
    orientationPoints: f.orientationPoints.map((p) => p.trim()).filter(Boolean),
    comprehensionCheck: f.comprehensionCheck,
    comprehensionQuestion: f.comprehensionCheck ? f.comprehensionQuestion.trim() : '',
    handoffUrl: f.handoffUrl.trim(),
    terms: f.terms,
  }
}

const https = (v: string) => v.trim() === '' || /^https:\/\/\S+$/i.test(v.trim())

/** Field errors keyed like the server's (e.g. "questions.1.text"). Empty object = valid. */
export function validateForm(f: RoleForm): Record<string, string> {
  const e: Record<string, string> = {}
  if (!f.label.trim()) e.label = 'Enter a name'
  else if (f.label.trim().length > 80) e.label = 'Keep the name under 80 characters'
  if (f.whoFor.trim().length > 500) e.whoFor = 'Keep this under 500 characters'
  if (f.ageRanges.length === 0) e.ageRanges = 'Pick at least one age range'
  if (!isFreeBilling(f.billing)) {
    const cents = dollarsToCents(f.price)
    if (cents === null) e.priceCents = 'Enter a price like 99 or 29.50'
    else if (cents === 0) e.priceCents = 'Enter a price, or set billing to Free'
    else if (cents > 10_000_000) e.priceCents = 'That price is too high'
  }
  if (f.priceNote.trim().length > 40) e.priceNote = 'Keep this under 40 characters'
  f.questions.slice(0, QUESTION_COUNT).forEach((q, i) => {
    if (!q.text.trim()) e[`questions.${i}.text`] = 'Enter the question'
    else if (q.text.trim().length > 500) e[`questions.${i}.text`] = 'Keep the question under 500 characters'
    if (q.type === 'CHOICE') {
      const filled = q.choices.map((c) => c.trim())
      if (filled.some((c) => !c)) e[`questions.${i}.choices`] = 'Fill in or remove the empty option'
      else if (filled.length < 2) e[`questions.${i}.choices`] = 'A choice question needs at least 2 options'
      else if (filled.some((c) => c.length > 200)) e[`questions.${i}.choices`] = 'Keep each option under 200 characters'
    }
  })
  if (!https(f.orientationUrl)) e.orientationUrl = 'Links must start with https://'
  if (f.orientationMinutes.trim()) {
    const n = Number(f.orientationMinutes)
    if (!Number.isInteger(n) || n < 1 || n > 600) e.orientationMinutes = 'Enter whole minutes from 1 to 600'
  }
  if (f.orientationPoints.some((p) => p.trim().length > 300)) e.orientationPoints = 'Keep each point under 300 characters'
  if (f.comprehensionCheck && !f.comprehensionQuestion.trim()) e.comprehensionQuestion = 'Enter the check question, or turn the check off'
  if (!https(f.handoffUrl)) e.handoffUrl = 'Links must start with https://'
  if (!f.terms.trim()) e.terms = 'Enter the terms prospects accept for this role'
  return e
}

/** Under-18 prospects only ever see free roles. */
export function minorsBlocked(f: RoleForm): boolean {
  return f.ageRanges.includes('UNDER_18') && isPaidRole({ billing: f.billing, priceCents: dollarsToCents(f.price) ?? 0 })
}

/** DOM id for a field key, so errors can focus and describe it. */
export function fid(key: string): string {
  return `rs-${key.replace(/\./g, '-')}`
}
