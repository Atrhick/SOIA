'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CATEGORY_KEYS, STATUS_KEYS } from '@/lib/running-costs/core'
import { serializeCostItem, type CostItemView } from '@/lib/running-costs/server'

const text = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null))

const money = z
  .union([z.number(), z.null()])
  .optional()
  .transform((v) => (v == null ? null : v))
  .refine((v) => v == null || (Number.isFinite(v) && v >= 0 && v < 100_000_000), 'Amounts must be 0 or more.')

const costItemSchema = z.object({
  category: z.enum(CATEGORY_KEYS),
  service: z.string().trim().min(1, 'Give the service a name.').max(200),
  whatFor: text(1000),
  provider: text(200),
  pricingNote: text(2000),
  unitPrice: text(1000),
  monthlyLow: money,
  monthlyExpected: money,
  monthlyHigh: money,
  status: z.enum(STATUS_KEYS),
  sourceUrl: text(500).refine((v) => v == null || /^https?:\/\/\S+$/i.test(v), 'The source link must start with http:// or https://'),
  /** YYYY-MM-DD from a date field, or empty. */
  checkedAt: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Pick a valid date.')
    .transform((v) => (v ? new Date(`${v}T12:00:00Z`) : null)),
  notes: text(2000),
  sortOrder: z.number().int().min(0).max(100_000).optional().default(0),
})

export type CostItemInput = z.input<typeof costItemSchema>

type Result = { item: CostItemView; error?: undefined } | { error: string; item?: undefined }

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { error: 'Only admins can change running costs.' }
  if (session.user.isImpersonating) return { error: 'Switch back to your own account to change running costs.' }
  return { userId: session.user.id }
}

function revalidate() {
  revalidatePath('/admin/running-costs')
  revalidatePath('/running-costs')
}

function parse(input: CostItemInput) {
  const parsed = costItemSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' } as const
  const d = parsed.data
  if (d.monthlyLow != null && d.monthlyHigh != null && d.monthlyLow > d.monthlyHigh) {
    return { error: 'Low can not be more than high.' } as const
  }
  return { data: d } as const
}

export async function createCostItem(input: CostItemInput): Promise<Result> {
  const who = await requireAdmin()
  if ('error' in who) return { error: who.error }
  const p = parse(input)
  if ('error' in p) return { error: p.error as string }
  try {
    const row = await prisma.costItem.create({ data: { ...p.data, updatedById: who.userId } })
    await prisma.auditLog.create({
      data: { userId: who.userId, action: 'COST_ITEM_CREATED', entityType: 'CostItem', entityId: row.id, details: JSON.stringify({ service: row.service }) },
    })
    revalidate()
    return { item: serializeCostItem(row) }
  } catch (error) {
    console.error('Error creating cost item:', error)
    return { error: 'Could not save. Please try again.' }
  }
}

export async function updateCostItem(id: string, input: CostItemInput): Promise<Result> {
  const who = await requireAdmin()
  if ('error' in who) return { error: who.error }
  if (typeof id !== 'string' || !id) return { error: 'Line not found.' }
  const p = parse(input)
  if ('error' in p) return { error: p.error as string }
  try {
    const exists = await prisma.costItem.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return { error: 'This line was removed. Reload the page.' }
    const row = await prisma.costItem.update({ where: { id }, data: { ...p.data, updatedById: who.userId } })
    await prisma.auditLog.create({
      data: { userId: who.userId, action: 'COST_ITEM_UPDATED', entityType: 'CostItem', entityId: row.id, details: JSON.stringify({ service: row.service }) },
    })
    revalidate()
    return { item: serializeCostItem(row) }
  } catch (error) {
    console.error('Error updating cost item:', error)
    return { error: 'Could not save. Please try again.' }
  }
}

export async function deleteCostItem(id: string): Promise<{ success: true } | { error: string }> {
  const who = await requireAdmin()
  if ('error' in who) return { error: who.error }
  if (typeof id !== 'string' || !id) return { error: 'Line not found.' }
  try {
    const removed = await prisma.costItem.deleteMany({ where: { id } })
    if (removed.count > 0) {
      await prisma.auditLog.create({
        data: { userId: who.userId, action: 'COST_ITEM_DELETED', entityType: 'CostItem', entityId: id, details: null },
      })
    }
    revalidate()
    return { success: true }
  } catch (error) {
    console.error('Error deleting cost item:', error)
    return { error: 'Could not remove. Please try again.' }
  }
}
