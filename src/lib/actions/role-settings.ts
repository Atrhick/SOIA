'use server'

/**
 * Role Settings (/admin/role-settings): save one Get Involved role's settings and, when the text
 * changed, publish a new terms version. ADMIN only (not SUB_ADMIN), blocked while impersonating.
 * Validation, the upsert, terms versioning and the audit log live in saveRoleConfig (roles.ts).
 */
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { saveRoleConfig } from '@/lib/get-involved/roles'
import type { RoleConfig } from '@/lib/get-involved/core'

export interface SavedTerms {
  id: string | null
  version: number
  body: string
  createdAt: string | null
}

export type SaveRoleSettingsResult =
  | { ok: true; config: RoleConfig; terms: SavedTerms }
  | { ok: false; error: string; fieldErrors: Record<string, string> }

export async function saveRoleSettings(input: unknown): Promise<SaveRoleSettingsResult> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { ok: false, error: 'Unauthorized', fieldErrors: {} }
  if (session.user.isImpersonating) return { ok: false, error: 'Switch back to your admin account first.', fieldErrors: {} }

  // Blank terms would silently keep the old text (saveRoleConfig treats '' as "leave as is"),
  // which is confusing in a form that shows the terms. Ask for text instead.
  if (input && typeof input === 'object' && 'terms' in input) {
    const t = (input as { terms: unknown }).terms
    if (typeof t !== 'string' || !t.trim()) return { ok: false, error: 'Enter the terms', fieldErrors: { terms: 'Enter the terms prospects accept for this role' } }
  }

  const r = await saveRoleConfig(input, session.user.id)
  if (!r.ok) return r
  revalidatePath('/admin/role-settings')
  return {
    ok: true,
    config: r.config,
    terms: { id: r.terms.id, version: r.terms.version, body: r.terms.body, createdAt: r.terms.createdAt?.toISOString() ?? null },
  }
}
