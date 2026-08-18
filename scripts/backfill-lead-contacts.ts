/**
 * Creates a CRMContact for every ProgramLead that does not already have one.
 *
 * Idempotent - leads that already have a contact are skipped, so this is safe
 * to re-run and safe to run against production after deploying.
 *
 *   npx tsx scripts/backfill-lead-contacts.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const leads = await prisma.programLead.findMany({
    where: { crmContact: null },
    include: { program: { select: { name: true, coachId: true } } },
  })

  console.log(`leads without a contact: ${leads.length}`)

  let created = 0
  let skippedNoCoach = 0

  for (const lead of leads) {
    if (!lead.program.coachId) {
      // Nobody owns this program yet, so there is no coach to own the contact.
      // Re-running after assignment will pick it up.
      skippedNoCoach++
      continue
    }

    const [firstName, ...rest] = lead.fullName.trim().split(/\s+/)

    await prisma.cRMContact.create({
      data: {
        ownerId: lead.program.coachId,
        firstName: firstName || lead.fullName,
        lastName: rest.join(' '),
        email: lead.email,
        jobTitle: lead.profession,
        source: 'PROGRAM_PAGE',
        // Someone who completed the qualification form has told us more than
        // someone who only left their name, so start them a step further on.
        status: lead.qualifiedAt ? 'QUALIFIED' : 'NEW',
        programLeadId: lead.id,
        tags: [lead.program.name],
        createdAt: lead.registeredAt,
      },
    })
    created++
  }

  console.log(`created: ${created}`)
  console.log(`skipped (program has no coach yet): ${skippedNoCoach}`)
  console.log(`total contacts now: ${await prisma.cRMContact.count()}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
