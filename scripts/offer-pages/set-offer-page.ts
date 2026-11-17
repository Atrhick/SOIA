/**
 * Saves a landing page onto a program: npx tsx scripts/offer-pages/set-offer-page.ts <program-slug> <page.json> [--apply]
 * Checks the JSON against OfferPageSchema first and prints what it would change. Without --apply nothing is written.
 * Until the owner editor exists, this is how an admin puts a page live.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { OfferPageSchema } from '../../src/lib/get-involved/offer-page'

async function main() {
  const [slug, file] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const apply = process.argv.includes('--apply')
  if (!slug || !file) throw new Error('Usage: set-offer-page.ts <program-slug> <page.json> [--apply]')
  const parsed = OfferPageSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
  if (!parsed.success) {
    console.error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'))
    process.exit(1)
  }
  const prisma = new PrismaClient()
  try {
    const p = await prisma.coachProgram.findUnique({ where: { slug }, select: { id: true, name: true, status: true, offerPage: true } })
    if (!p) throw new Error(`No program with slug ${slug}`)
    console.log(`${p.name} (${p.status}): ${p.offerPage ? 'replaces its current page' : 'gets its first page'}`)
    if (!apply) { console.log('Checked. Nothing written (add --apply).'); return }
    await prisma.coachProgram.update({ where: { id: p.id }, data: { offerPage: parsed.data } })
    console.log('Saved.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
