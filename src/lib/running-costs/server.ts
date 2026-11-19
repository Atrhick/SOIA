/**
 * Running costs: loading rows and the access rule. Server only, and NOT 'use server' (nothing here is an endpoint).
 */
import type { CostItem } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabled } from '@/lib/actions/feature-config'

export const RUNNING_COSTS_FEATURE = 'RUNNING_COSTS'

/** What the page gets: Decimals as numbers, dates as ISO strings. */
export type CostItemView = {
  id: string
  key: string | null
  category: string
  service: string
  whatFor: string | null
  provider: string | null
  pricingNote: string | null
  unitPrice: string | null
  monthlyLow: number | null
  monthlyExpected: number | null
  monthlyHigh: number | null
  status: string
  sourceUrl: string | null
  checkedAt: string | null
  notes: string | null
  sortOrder: number
  updatedAt: string
}

export function serializeCostItem(row: CostItem): CostItemView {
  return {
    id: row.id,
    key: row.key,
    category: row.category,
    service: row.service,
    whatFor: row.whatFor,
    provider: row.provider,
    pricingNote: row.pricingNote,
    unitPrice: row.unitPrice,
    monthlyLow: row.monthlyLow?.toNumber() ?? null,
    monthlyExpected: row.monthlyExpected?.toNumber() ?? null,
    monthlyHigh: row.monthlyHigh?.toNumber() ?? null,
    status: row.status,
    sourceUrl: row.sourceUrl,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    notes: row.notes,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function loadCostItems(): Promise<CostItemView[]> {
  const rows = await prisma.costItem.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { service: 'asc' }] })
  return rows.map(serializeCostItem)
}

/** Admins always; anyone else only when the RUNNING_COSTS feature is granted to them (or their role). */
export async function canViewRunningCosts(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === 'ADMIN') return true
  return isFeatureEnabled(RUNNING_COSTS_FEATURE, user.role, user.id)
}
