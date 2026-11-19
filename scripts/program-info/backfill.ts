/**
 * Program info workflow: brings existing programs into it. Idempotent.
 *
 *   npx tsx scripts/program-info/backfill.ts                     dry run (default): prints what it would do
 *   npx tsx scripts/program-info/backfill.ts --apply             writes (local database)
 *   npx tsx scripts/program-info/backfill.ts --apply --remote-ok writes to a non-local database
 *
 * For every program not yet in the workflow (no versions and infoAnswers still empty):
 * - page answers are started from its columns (programDescription/headline -> summary, targetMarket ->
 *   audience, servicesDescription -> offerings, zoomUrl, offerFullPrice/offerSponsoredPrice -> cost);
 *   shared answers (root) from coachBio / the owner's invite "why" -> aboutYou, and the names.
 * - live today (PUBLISHED, snapshot, offerPage): version 1 APPROVED (approvedOnBehalf, from the live page,
 *   approved welcome paragraph and invitation line), event MIGRATED, stage DONE.
 * - everything else: stage ANSWERING (shows "Not started" until the owner types).
 * groupsConfirmedAt is left empty: owners confirm Names and groups on their first visit.
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { prefillPageAnswers, prefillSharedAnswers } from '../../src/lib/program-info/questions'
import { asAnswers, mergeAnswers } from '../../src/lib/program-info/progress'
import { checkDatabase } from './db'

const APPLY = process.argv.includes('--apply')
const REMOTE_OK = process.argv.includes('--remote-ok')

async function main() {
  if (!checkDatabase(APPLY, REMOTE_OK)) process.exit(1)
  const prisma = new PrismaClient()
  try {
    const programs = await prisma.coachProgram.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { pageVersions: true } },
        coach: { select: { user: { select: { inviteWhy: true } } } },
        ambassador: { select: { user: { select: { inviteWhy: true } } } },
      },
    })
    let migrated = 0, prefilled = 0, skipped = 0
    for (const p of programs) {
      if (p._count.pageVersions > 0 || p.infoAnswers !== null) { skipped++; continue }
      const isRoot = p.parentProgramId === null
      const page = prefillPageAnswers(p, asAnswers(p.infoAnswers))
      const shared = isRoot
        ? prefillSharedAnswers({ name: p.pageTitle || p.name, organization: p.organization, coachBio: p.coachBio, inviteWhy: p.coach?.user.inviteWhy ?? p.ambassador?.user?.inviteWhy ?? null }, asAnswers(p.sharedAnswers))
        : null
      const live = p.status === 'PUBLISHED' && p.publishedSnapshot !== null && p.offerPage !== null
      console.log(`${live ? 'MIGRATE ' : 'PREFILL '} ${p.slug} (${p.status}): ${Object.keys(page).length} page answers${shared ? `, ${Object.keys(shared).length} shared` : ''}`)
      if (!APPLY) { if (live) migrated++; else prefilled++; continue }

      const now = new Date()
      await prisma.$transaction(async (tx) => {
        await tx.coachProgram.update({
          where: { id: p.id },
          data: {
            infoAnswers: page as Prisma.InputJsonValue,
            ...(shared ? { sharedAnswers: shared as Prisma.InputJsonValue } : {}),
            ...(live ? { infoStage: 'DONE', infoStageAt: now } : { infoStage: 'ANSWERING' }),
          },
        })
        if (live) {
          const v = await tx.programPageVersion.create({
            data: {
              programId: p.id,
              number: 1,
              answers: mergeAnswers(page, shared ?? p.sharedAnswers) as Prisma.InputJsonValue,
              offerPage: p.offerPage as Prisma.InputJsonValue,
              welcomeNote: p.welcomeNoteApprovedAt ? p.welcomeNote : null,
              messageLine: p.messageLine,
              status: 'APPROVED',
              approvedAt: p.reviewedAt ?? now,
              approvedById: p.reviewedBy,
              approvedOnBehalf: true,
            },
          })
          await tx.programPageEvent.create({ data: { programId: p.id, actorId: null, kind: 'MIGRATED', detail: { versionId: v.id, number: 1 } } })
        }
      })
      if (live) migrated++; else prefilled++
    }
    console.log(`${APPLY ? 'Done' : 'Dry run'}: ${migrated} live pages ${APPLY ? 'migrated' : 'to migrate'}, ${prefilled} ${APPLY ? 'prefilled' : 'to prefill'}, ${skipped} already in the workflow.`)
    if (!APPLY) console.log('Nothing written (add --apply).')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
