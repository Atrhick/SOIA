/**
 * Program info workflow: fills EMPTY answers with the team's suggested answers. Never overwrites anything.
 *
 *   npx tsx scripts/program-info/apply-suggestions.ts [dir]                      dry run (default)
 *   npx tsx scripts/program-info/apply-suggestions.ts [dir] --apply              writes (local database)
 *   npx tsx scripts/program-info/apply-suggestions.ts [dir] --apply --remote-ok  writes to a non-local database
 *
 * dir (default scripts/program-info/suggested-answers) holds <program-slug>.json files: flat { questionId: answer }.
 * Run it after backfill.ts. Page answers go on the program; shared ones (About you, must-not-say) on its root.
 * For a page brought over as approved version 1 (MIGRATED) and not changed since, version 1's recorded answers get
 * the same values, so the suggestions don't show up as "changed since approval". Logs SUGGESTIONS_ADDED.
 * Does not touch infoAnswersEditedAt, so no reminders start because of it.
 */
import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { PrismaClient, Prisma } from '@prisma/client'
import { isAnswered, isSharedKey, parseAnswer } from '../../src/lib/program-info/questions'
import { asAnswers } from '../../src/lib/program-info/progress'
import { checkDatabase } from './db'

const APPLY = process.argv.includes('--apply')
const REMOTE_OK = process.argv.includes('--remote-ok')
const DIR = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? join(__dirname, 'suggested-answers'))

type Ans = Record<string, unknown>

function load(file: string): Ans {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Ans
  const out: Ans = {}
  for (const [k, v] of Object.entries(raw)) {
    const r = parseAnswer(k, v)
    if (!r.ok) throw new Error(`${file}: ${k}: ${r.error}`)
    if (isAnswered(k, r.value)) out[k] = r.value
  }
  return out
}

/** Adds suggestion values only where `into` has no answer. Returns the keys added. */
function fillBlanks(into: Ans, from: Ans, keys: string[]): string[] {
  const added: string[] = []
  for (const k of keys) if (!isAnswered(k, into[k]) && k in from) { into[k] = from[k]; added.push(k) }
  return added
}

async function main() {
  if (!checkDatabase(APPLY, REMOTE_OK)) process.exit(1)
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'))
  const prisma = new PrismaClient()
  let total = 0
  try {
    for (const f of files) {
      const slug = f.replace(/\.json$/, '')
      const sug = load(join(DIR, f))
      const p = await prisma.coachProgram.findUnique({
        where: { slug },
        select: {
          id: true, slug: true, parentProgramId: true, infoAnswers: true, sharedAnswers: true, infoStage: true, infoAnswersEditedAt: true,
          pageVersions: { orderBy: { number: 'asc' }, select: { id: true, number: true, status: true, approvedOnBehalf: true, answers: true } },
        },
      })
      if (!p) { console.log(`SKIP     ${slug}: no program with this slug`); continue }
      if (p.infoAnswers === null) { console.log(`SKIP     ${slug}: not in the workflow yet (run backfill.ts first)`); continue }

      const rootId = p.parentProgramId ?? p.id
      const root = p.parentProgramId
        ? await prisma.coachProgram.findUnique({ where: { id: rootId }, select: { sharedAnswers: true } })
        : { sharedAnswers: p.sharedAnswers }
      const page = asAnswers(p.infoAnswers)
      const shared = asAnswers(root?.sharedAnswers)
      const sugKeys = Object.keys(sug)
      const pageAdded = fillBlanks(page, sug, sugKeys.filter((k) => !isSharedKey(k)))
      const sharedAdded = fillBlanks(shared, sug, sugKeys.filter((k) => isSharedKey(k)))
      const added = [...pageAdded, ...sharedAdded]

      // The migrated approved version 1, when nothing has happened since.
      const v = p.pageVersions
      const migratedOnly = v.length === 1 && v[0].number === 1 && v[0].status === 'APPROVED' && v[0].approvedOnBehalf && p.infoAnswersEditedAt === null
      const vAnswers = migratedOnly ? asAnswers(v[0].answers) : null
      const vAdded = vAnswers ? fillBlanks(vAnswers, sug, sugKeys) : []

      console.log(`${added.length ? 'FILL    ' : 'NOTHING '} ${slug} (${p.infoStage}): ${added.length ? added.join(', ') : 'all answered already'}${vAdded.length ? ` | version 1 record: ${vAdded.length}` : ''}`)
      if (!added.length && !vAdded.length) continue
      total += added.length
      if (!APPLY) continue

      await prisma.$transaction(async (tx) => {
        if (pageAdded.length) await tx.coachProgram.update({ where: { id: p.id }, data: { infoAnswers: page as Prisma.InputJsonValue } })
        if (sharedAdded.length) await tx.coachProgram.update({ where: { id: rootId }, data: { sharedAnswers: shared as Prisma.InputJsonValue } })
        if (vAnswers && vAdded.length) await tx.programPageVersion.update({ where: { id: v[0].id }, data: { answers: vAnswers as Prisma.InputJsonValue } })
        await tx.programPageEvent.create({ data: { programId: p.id, actorId: null, kind: 'SUGGESTIONS_ADDED', detail: { count: added.length, keys: added } } })
      })
    }
    console.log(`${APPLY ? 'Done' : 'Dry run'}: ${total} empty answers ${APPLY ? 'filled' : 'to fill'} from ${files.length} files.`)
    if (!APPLY) console.log('Nothing written (add --apply).')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
