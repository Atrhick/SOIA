/**
 * Running costs page: categories, statuses and the totals. Pure (no Prisma), shared by the page and the tests.
 * All money is US dollars per month, as plain numbers (Decimals are converted with .toNumber() before this).
 */

export const COST_CATEGORIES = [
  { key: 'HOSTING', label: 'Hosting' },
  { key: 'EMAIL', label: 'Email and messages' },
  { key: 'PHONE', label: 'Phone and texting' },
  { key: 'AI', label: 'AI' },
  { key: 'STORAGE', label: 'Storage' },
  { key: 'PAYMENTS', label: 'Payments' },
  { key: 'DOMAIN', label: 'Domain and accounts' },
] as const

export type CostCategory = (typeof COST_CATEGORIES)[number]['key']

export const COST_STATUSES = [
  { key: 'IN_USE', label: 'In use' },
  { key: 'PLANNED', label: 'Planned' },
  { key: 'SUGGESTED', label: 'Suggested' },
] as const

export type CostStatus = (typeof COST_STATUSES)[number]['key']

export const CATEGORY_KEYS = COST_CATEGORIES.map((c) => c.key) as [CostCategory, ...CostCategory[]]
export const STATUS_KEYS = COST_STATUSES.map((s) => s.key) as [CostStatus, ...CostStatus[]]

export function categoryLabel(key: string): string {
  return COST_CATEGORIES.find((c) => c.key === key)?.label ?? key
}

export function statusLabel(key: string): string {
  return COST_STATUSES.find((s) => s.key === key)?.label ?? key
}

/** Which rows the totals count. */
export type TotalsScope = 'IN_USE' | 'IN_USE_AND_PLANNED' | 'ALL'

export const SCOPE_LABELS: Record<TotalsScope, string> = {
  IN_USE: 'Only what we use today',
  IN_USE_AND_PLANNED: 'Today plus what is planned',
  ALL: 'Everything, including suggestions',
}

export type CostAmounts = {
  status: string
  monthlyLow: number | null
  monthlyExpected: number | null
  monthlyHigh: number | null
}

export function inScope(status: string, scope: TotalsScope): boolean {
  if (scope === 'ALL') return true
  if (scope === 'IN_USE') return status === 'IN_USE'
  return status === 'IN_USE' || status === 'PLANNED'
}

/**
 * One row's three amounts with the blanks filled in:
 * expected falls back to the middle of low and high (or whichever one is there), and
 * low/high fall back to expected. A row with no amounts counts as 0.
 */
export function filledAmounts(row: Omit<CostAmounts, 'status'>): { low: number; expected: number; high: number } {
  const { monthlyLow: lo, monthlyExpected: ex, monthlyHigh: hi } = row
  const expected = ex ?? (lo != null && hi != null ? (lo + hi) / 2 : lo ?? hi ?? 0)
  return { low: lo ?? expected, expected, high: hi ?? expected }
}

export type CostTotals = {
  low: number
  expected: number
  high: number
  yearlyExpected: number
  /** Rows counted. */
  count: number
}

const cents = (n: number) => Math.round(n * 100) / 100

export function computeTotals(rows: CostAmounts[], scope: TotalsScope = 'IN_USE_AND_PLANNED'): CostTotals {
  let low = 0
  let expected = 0
  let high = 0
  let count = 0
  for (const row of rows) {
    if (!inScope(row.status, scope)) continue
    const f = filledAmounts(row)
    low += f.low
    expected += f.expected
    high += f.high
    count++
  }
  return { low: cents(low), expected: cents(expected), high: cents(high), yearlyExpected: cents(expected * 12), count }
}

/** Rows grouped in the fixed category order; unknown categories go last under their own key. */
export function groupByCategory<T extends { category: string; sortOrder: number; service: string }>(
  rows: T[],
): { key: string; label: string; rows: T[] }[] {
  const keys: string[] = COST_CATEGORIES.map((c) => c.key)
  rows.forEach((r) => { if (!keys.includes(r.category)) keys.push(r.category) })
  return keys
    .map((key) => ({
      key,
      label: categoryLabel(key),
      rows: rows
        .filter((r) => r.category === key)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.service.localeCompare(b.service)),
    }))
    .filter((g) => g.rows.length > 0)
}

/** "$12", "$1,234.50", "$0.40" */
export function formatMoney(n: number): string {
  const whole = Number.isInteger(Math.round(n * 100) / 100)
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })
}
