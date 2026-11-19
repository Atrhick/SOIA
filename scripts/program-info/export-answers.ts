/**
 * Prints every answer of one page as plain text (what the page, welcome paragraph and invitation line are
 * written from). Read only.
 *
 *   npx tsx scripts/program-info/export-answers.ts <programSlug>
 */
import { PrismaClient } from '@prisma/client'
import { answersAsText } from '../../src/lib/program-info/questions'
import { asAnswers, mergeAnswers } from '../../src/lib/program-info/progress'
import { checkDatabase } from './db'

async function main() {
  const [slug] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!slug) throw new Error('Usage: export-answers.ts <programSlug>')
  checkDatabase(false, false)
  const prisma = new PrismaClient()
  try {
    const owner = { select: { firstName: true, lastName: true } } as const
    const p = await prisma.coachProgram.findUnique({ where: { slug }, include: { parent: true, coach: owner, ambassador: owner } })
    if (!p) throw new Error(`No program with slug ${slug}`)
    const root = p.parent ?? p
    const shared = asAnswers(root.sharedAnswers)
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    const person = p.coach ?? p.ambassador
    console.log(answersAsText(mergeAnswers(p.infoAnswers, root.sharedAnswers), {
      programName: str(shared.programName) || root.pageTitle || root.name,
      companyName: str(shared.companyName) || root.organization,
      audienceLabel: p.audienceLabel,
      ownerName: person ? `${person.firstName} ${person.lastName}` : null,
    }))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
