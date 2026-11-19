/**
 * Saves the team's draft for one page (until "Write with AI" exists, this is how a written page gets in):
 *
 *   npx tsx scripts/program-info/save-draft.ts <programSlug> <file.json> [--apply] [--remote-ok]
 *
 * file.json = { "offerPage": {...}, "welcomeNote": "...", "messageLine": "..." } (any of the three).
 * Checks it like the saveDraft action (OfferPageSchema, welcome paragraph rules, invitation line length),
 * then creates the page's DRAFT version or updates the one there is. Never sends it: the team presses
 * "Send to <coach> to check" on /admin/program-pages/<id>. Without --apply nothing is written.
 */
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { parseDraftInput, writeDraftVersion } from '../../src/lib/program-info/drafts'
import { checkDatabase } from './db'

async function main() {
  const [slug, file] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const apply = process.argv.includes('--apply')
  if (!slug || !file) throw new Error('Usage: save-draft.ts <programSlug> <file.json> [--apply] [--remote-ok]')
  const parsed = parseDraftInput(JSON.parse(readFileSync(file, 'utf8')))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exit(1)
  }
  if (!checkDatabase(apply, process.argv.includes('--remote-ok'))) process.exit(1)
  const prisma = new PrismaClient()
  try {
    const p = await prisma.coachProgram.findUnique({ where: { slug }, select: { id: true, name: true, audienceLabel: true, infoStage: true } })
    if (!p) throw new Error(`No program with slug ${slug}`)
    const draft = await prisma.programPageVersion.findFirst({ where: { programId: p.id, status: 'DRAFT' }, select: { number: true } })
    const parts = Object.keys(parsed.data).join(', ')
    console.log(`${p.name}${p.audienceLabel ? ` · ${p.audienceLabel}` : ''} (${p.infoStage}): ${draft ? `updates draft version ${draft.number}` : 'creates a new draft version'} with ${parts}`)
    if (!apply) { console.log('Checked. Nothing written (add --apply).'); return }
    const out = await prisma.$transaction(async (tx) => {
      const w = await writeDraftVersion(tx, p.id, parsed.data, null)
      await tx.programPageEvent.create({ data: { programId: p.id, actorId: null, kind: 'DRAFT_SAVED', detail: { versionId: w.versionId, number: w.number, created: w.created, via: 'script' } } })
      return w
    })
    console.log(`Saved draft version ${out.number}. Send it to the owner from /admin/program-pages/${p.id}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
