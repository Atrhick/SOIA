/**
 * Read-only report: private conversations (direct messages and support threads) where an under-18 ambassador
 * is with an adult and their parent is not part of it. Lists ids, names and message COUNTS only, never
 * message content. It changes nothing; the team reviews the list and decides what to do.
 *
 *   npx tsx scripts/messaging/report-minor-dms.ts
 *
 * Uses DATABASE_URL from .env and prints the database host first.
 */
import { PrismaClient } from '@prisma/client'
import { requiredParents, isMinor, type AmbassadorAgeInfo } from '../../src/lib/messaging/guardians'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log(`Database host: ${new URL(process.env.DATABASE_URL || '').host || '(unknown)'}`)
  } catch {
    console.log('Database host: (could not read DATABASE_URL)')
  }

  const ambassadors = await prisma.ambassador.findMany({
    where: { userId: { not: null } },
    select: {
      userId: true, firstName: true, lastName: true, dateOfBirth: true, parentUserId: true,
      parentFirstName: true, parentLastName: true, parentEmail: true, parentPhone: true,
    },
  })
  const infos = ambassadors.filter((a): a is typeof a & { userId: string } => !!a.userId)
  const minors = infos.filter((a) => isMinor(a as AmbassadorAgeInfo))
  const minorIds = minors.map((m) => m.userId)
  const nameOf = new Map(infos.map((a) => [a.userId, `${a.firstName} ${a.lastName}`]))
  console.log(`Ambassadors treated as under 18: ${minors.length}`)
  if (minorIds.length === 0) return

  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } })
  const who = (id: string) => {
    const u = users.find((x) => x.id === id)
    return `${nameOf.get(id) ?? u?.email ?? id} (${u?.role ?? '?'})`
  }

  const describe = (memberIds: string[]) => {
    const check = requiredParents(memberIds, infos)
    if (check.ok && check.parentIds.length === 0) return null
    return check.ok ? `parent login(s) missing from it: ${check.parentIds.map(who).join(', ')}` : 'minor has no parent login'
  }

  // Direct messages (and any other non-group conversation) with a minor in them.
  const dms = await prisma.collaborationChannel.findMany({
    where: { type: { not: 'CHANNEL' }, members: { some: { userId: { in: minorIds } } } },
    select: { id: true, type: true, createdAt: true, members: { select: { userId: true } }, _count: { select: { posts: true } } },
  })
  let dmFlagged = 0
  console.log('\nDirect messages needing review:')
  for (const dm of dms) {
    const members = dm.members.map((m) => m.userId)
    const problem = describe(members)
    if (!problem) continue
    dmFlagged++
    console.log(`- ${dm.id} [${dm.type}] started ${dm.createdAt.toISOString().slice(0, 10)}, ${dm._count.posts} message(s)`)
    console.log(`    people: ${members.map(who).join('; ')}`)
    console.log(`    ${problem}`)
  }
  if (dmFlagged === 0) console.log('  none')

  // Support threads with a minor in them.
  const threads = await prisma.messageThread.findMany({
    where: { participants: { some: { id: { in: minorIds } } } },
    select: { id: true, createdAt: true, participants: { select: { id: true } }, _count: { select: { messages: true } } },
  })
  let threadFlagged = 0
  console.log('\nSupport threads needing review:')
  for (const t of threads) {
    const members = t.participants.map((p) => p.id)
    const problem = describe(members)
    if (!problem) continue
    threadFlagged++
    console.log(`- ${t.id} started ${t.createdAt.toISOString().slice(0, 10)}, ${t._count.messages} message(s)`)
    console.log(`    people: ${members.map(who).join('; ')}`)
    console.log(`    ${problem}`)
  }
  if (threadFlagged === 0) console.log('  none')

  console.log(`\nTotal: ${dmFlagged} direct message(s), ${threadFlagged} support thread(s). Nothing was changed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
