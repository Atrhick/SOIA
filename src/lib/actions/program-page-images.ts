'use server'

/**
 * Photos for program pages, uploaded from the team's page editor (/admin/program-pages/[id]/edit).
 * ADMIN only, never while viewing as someone else. Stored with saveFile (src/lib/storage.ts) under
 * offers/<program slug>/<time>-<name>.<ext>: an https storage link in production, /uploads/... locally,
 * both accepted by OfferPageSchema.
 *
 * jpg, png or webp, up to 5 MB, checked by the file's first bytes (not its name). The editor shrinks photos
 * to 1600px wide webp in the browser before sending (sharp is not installed, and server actions accept 2 MB
 * bodies, next.config.js), so large camera photos fit.
 */
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { audit, requireAdmin } from '@/lib/program-pages-core'
import { saveFile } from '@/lib/storage'

const MAX_PAGE_IMAGE_BYTES = 5 * 1024 * 1024

type Result = { ok: true; url: string } | { ok: false; error: string }

const Input = z.object({
  programId: z.string().min(1).max(100),
  permission: z.literal('yes', { error: 'Tick "We have permission to use this photo" first.' }),
})

/** The real type from the first bytes, or null. */
function imageKind(b: Buffer): { ext: 'jpg' | 'png' | 'webp'; contentType: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' }
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', contentType: 'image/png' }
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { ext: 'webp', contentType: 'image/webp' }
  return null
}

/** "My Photo (1).JPG" -> "my-photo-1" (letters, numbers and dashes only; the page format allows no others). */
function safeName(name: string): string {
  const base = name.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return base || 'photo'
}

export async function uploadProgramPageImage(form: FormData): Promise<Result> {
  const ctx = await requireAdmin()
  if (!ctx.ok) return { ok: false, error: ctx.error }
  const parsed = Input.safeParse({ programId: form.get('programId'), permission: form.get('permission') })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the photo' }
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a photo first.' }
  if (file.size > MAX_PAGE_IMAGE_BYTES) return { ok: false, error: 'That photo is over 5 MB. Choose a smaller one.' }

  const program = await prisma.coachProgram.findUnique({ where: { id: parsed.data.programId }, select: { id: true, slug: true } })
  if (!program) return { ok: false, error: 'Page not found' }

  const data = Buffer.from(await file.arrayBuffer())
  const kind = imageKind(data)
  if (!kind) return { ok: false, error: 'That file is not a JPG, PNG or WebP photo.' }

  const folder = program.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || program.id
  const key = `offers/${folder}/${Date.now()}-${safeName(file.name)}.${kind.ext}`
  let url: string
  try {
    url = await saveFile(key, data, kind.contentType)
  } catch (e) {
    console.error('[PROGRAM-PAGE-IMAGES] upload failed', e)
    return { ok: false, error: 'The photo could not be saved. Please try again.' }
  }
  await audit(ctx.session.user.id, 'PROGRAM_PAGE_IMAGE_UPLOADED', program.id, { key, bytes: data.length })
  return { ok: true, url }
}
