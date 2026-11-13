/**
 * Loads NowTransformed's default pitch content for programs (One-A-Day v2) from a folder of JSON files,
 * one per program: { programId, slug, businessName, messageLine, guide, scripts: [{ scenario, variant, subject, body }] }.
 *
 *   npx tsx scripts/load-program-pitches.ts <folder>                 dry run (default): validate + show what would change
 *   npx tsx scripts/load-program-pitches.ts <folder> --apply         write to the database in DATABASE_URL
 *   npx tsx scripts/load-program-pitches.ts <folder> --map-local     (testing) put each file on a local PUBLISHED program, in order
 *
 * What it writes (and nothing else):
 *   - ProgramScript.defaultSubject / defaultBody   (owner* fields are never touched)
 *   - ProgramPlaybook.defaultGuide + businessName  (ownerGuide is never touched)
 *   - CoachProgram.messageLine, ONLY when it is empty (an owner's line is never overwritten)
 *
 * Safety: prints the database host first; writes only with --apply; a host other than localhost/127.0.0.1
 * also needs --remote-ok. Every file must pass scriptChecks() and isPlaybookGuide(), or nothing is written.
 * Programs are matched by id and the slug must match (with --map-local, files go onto local programs in order).
 */
import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { PrismaClient, Prisma } from '@prisma/client'
import { SCENARIOS, checksPass, isPlaybookGuide, isScenarioKey, isScriptVariant, scriptChecks, type PlaybookGuide } from '../src/lib/get-involved/scripts'

interface PitchFile {
  file: string
  programId: string
  slug: string
  businessName: string
  messageLine: string
  guide: PlaybookGuide
  scripts: { scenario: string; variant: string; subject: string | null; body: string }[]
}

const args = process.argv.slice(2)
const folder = args.find((a) => !a.startsWith('--'))
const APPLY = args.includes('--apply')
const MAP_LOCAL = args.includes('--map-local')
const REMOTE_OK = args.includes('--remote-ok')

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  // Same file the Prisma CLI reads.
  try {
    const line = readFileSync(resolve(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l))
    const v = line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
    if (v) { process.env.DATABASE_URL = v; return v }
  } catch { /* fall through */ }
  throw new Error('DATABASE_URL is not set (environment or .env).')
}

function readFiles(dir: string): { files: PitchFile[]; problems: string[] } {
  const problems: string[] = []
  const files: PitchFile[] = []
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    let raw: PitchFile
    try { raw = { ...JSON.parse(readFileSync(join(dir, name), 'utf8')), file: name } } catch (e) { problems.push(`${name}: not valid JSON (${(e as Error).message})`); continue }
    const p = (m: string) => problems.push(`${name}: ${m}`)
    if (!raw.programId || !raw.slug) p('needs programId and slug')
    if (!raw.businessName?.trim()) p('needs businessName')
    if (!raw.messageLine?.trim() || raw.messageLine.length > 200) p('needs a messageLine (up to 200 characters)')
    if (!isPlaybookGuide(raw.guide)) p('guide is not a valid PlaybookGuide')
    const seen = new Set<string>()
    for (const s of raw.scripts ?? []) {
      const key = `${s.scenario}:${s.variant}`
      if (seen.has(key)) p(`${key} appears twice`)
      seen.add(key)
      const sc = SCENARIOS.find((x) => x.key === s.scenario)
      if (!isScenarioKey(s.scenario) || !isScriptVariant(s.variant) || !(sc?.variants as readonly string[] | undefined)?.includes(s.variant)) { p(`${key} is not a known situation/variant`); continue }
      const checks = scriptChecks(s.scenario, s.variant, { subject: s.subject, body: s.body })
      if (!checksPass(checks)) p(`${key} fails: ${checks.filter((c) => !c.ok).map((c) => c.label).join('; ')}`)
    }
    if (!raw.scripts?.length) p('has no scripts')
    files.push(raw)
  }
  return { files, problems }
}

async function main() {
  if (!folder) {
    console.log('Usage: npx tsx scripts/load-program-pitches.ts <folder> [--apply] [--map-local] [--remote-ok]')
    process.exit(2)
  }
  const url = new URL(databaseUrl())
  const host = `${url.hostname}:${url.port || '5432'}${url.pathname}`
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  console.log(`Database: ${host} (${local ? 'local' : 'REMOTE'})`)
  console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'dry run (nothing is written; add --apply to write)'}${MAP_LOCAL ? ', map onto local programs' : ''}`)
  if (APPLY && !local && !REMOTE_OK) {
    console.log('Refusing to write to a non-local database without --remote-ok.')
    process.exit(1)
  }
  if (MAP_LOCAL && !local) {
    console.log('--map-local is for testing on a local database only.')
    process.exit(1)
  }

  const { files, problems } = readFiles(resolve(folder))
  console.log(`Files: ${files.length}`)
  if (problems.length) {
    console.log('\nProblems (nothing written):')
    for (const x of problems) console.log(`  - ${x}`)
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    // Which program each file goes onto.
    const targets = new Map<PitchFile, { id: string; slug: string; name: string; messageLine: string | null }>()
    if (MAP_LOCAL) {
      const published = await prisma.coachProgram.findMany({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'asc' }, select: { id: true, slug: true, name: true, messageLine: true } })
      files.forEach((f, i) => {
        const t = published[i]
        if (t) targets.set(f, t)
        console.log(`  map ${f.file} -> ${t ? `${t.name} (${t.slug}, ${t.id})` : 'no local PUBLISHED program left, skipped'}`)
      })
    } else {
      const found = await prisma.coachProgram.findMany({ where: { id: { in: files.map((f) => f.programId) } }, select: { id: true, slug: true, name: true, messageLine: true } })
      for (const f of files) {
        const t = found.find((x) => x.id === f.programId)
        if (!t) { console.log(`  skip ${f.file}: program ${f.programId} not in this database`); continue }
        if (t.slug !== f.slug) { console.log(`  skip ${f.file}: slug in database is "${t.slug}", file says "${f.slug}"`); continue }
        targets.set(f, t)
      }
    }

    let scriptsWritten = 0
    for (const f of files) {
      const t = targets.get(f)
      if (!t) continue
      const existing = await prisma.programScript.findMany({ where: { programId: t.id }, select: { scenario: true, variant: true, defaultBody: true, ownerBody: true } })
      const changed = f.scripts.filter((s) => existing.find((e) => e.scenario === s.scenario && e.variant === s.variant)?.defaultBody !== s.body)
      const ownerEdited = existing.filter((e) => e.ownerBody?.trim()).length
      const setLine = !t.messageLine?.trim()
      console.log(`\n${t.name} (${t.slug})`)
      console.log(`  business name: ${f.businessName}`)
      console.log(`  message line: ${setLine ? `set to "${f.messageLine}"` : `kept the existing "${t.messageLine}"`}`)
      console.log(`  messages: ${f.scripts.length} in file, ${changed.length} new or changed${ownerEdited ? `, ${ownerEdited} have the owner's own version (kept; owners still see theirs)` : ''}`)
      console.log(`  guide: ${f.guide.sections.length} sections`)
      if (!APPLY) continue

      await prisma.$transaction(async (tx) => {
        for (const s of f.scripts) {
          await tx.programScript.upsert({
            where: { programId_scenario_variant: { programId: t.id, scenario: s.scenario, variant: s.variant } },
            create: { programId: t.id, scenario: s.scenario, variant: s.variant, defaultSubject: s.subject ?? null, defaultBody: s.body },
            update: { defaultSubject: s.subject ?? null, defaultBody: s.body },
          })
        }
        const guide = f.guide as unknown as Prisma.InputJsonValue
        await tx.programPlaybook.upsert({
          where: { programId: t.id },
          create: { programId: t.id, businessName: f.businessName, defaultGuide: guide },
          update: { businessName: f.businessName, defaultGuide: guide },
        })
        // Only fills an empty line; the condition is in the WHERE so a line set meanwhile is never overwritten.
        if (setLine) await tx.coachProgram.updateMany({ where: { id: t.id, OR: [{ messageLine: null }, { messageLine: '' }] }, data: { messageLine: f.messageLine } })
      })
      scriptsWritten += f.scripts.length
    }
    console.log(APPLY ? `\nDone: wrote ${scriptsWritten} messages for ${targets.size} program(s).` : `\nDry run only. Re-run with --apply to write.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
