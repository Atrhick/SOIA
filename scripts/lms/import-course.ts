/**
 * Loads a course from a folder of markdown files as a new DRAFT course (same rules as Admin > Courses >
 * Import from markdown; see src/lib/lms/markdown-import.ts).
 *
 *   npx tsx scripts/lms/import-course.ts <folder>                       dry run: prints what would be created
 *   npx tsx scripts/lms/import-course.ts <folder> --apply               writes to the local database
 *   npx tsx scripts/lms/import-course.ts <folder> --apply --remote-ok   writes to a non-local database
 *
 * Options: --title "Course title" (overrides the course.md title), --admin <email> (createdBy; default the
 * first ADMIN user).
 */
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { parseCourseFolder } from '../../src/lib/lms/markdown-import'
import { createCourseFromImport } from '../../src/lib/lms/server'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const REMOTE_OK = args.includes('--remote-ok')
const opt = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const folder = args.find((a, i) => !a.startsWith('--') && !['--title', '--admin'].includes(args[i - 1] ?? ''))

async function main() {
  if (!folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    console.error('Usage: npx tsx scripts/lms/import-course.ts <folder> [--apply] [--remote-ok] [--title "..."] [--admin email]')
    process.exit(1)
  }
  const files = fs
    .readdirSync(folder)
    .filter((f) => /\.(md|markdown)$/i.test(f))
    .map((f) => ({ name: f, content: fs.readFileSync(path.join(folder, f), 'utf8') }))
  const course = parseCourseFolder(files)

  console.log(`Course: ${opt('--title') || course.title}`)
  console.log(`Roles: ${course.allowedRoles.join(', ')} | Category: ${course.category ?? '-'} | Drip days: ${course.dripDays ?? '-'}`)
  for (const m of course.modules) {
    console.log(`\n${m.title}  (${m.sourceFile})`)
    for (const l of m.lessons) {
      const ex = l.blocks.filter((b) => b.type === 'EXERCISE').length
      console.log(`  - ${l.title}  [${l.estimatedDuration} min${ex ? `, ${ex} exercise(s)` : ''}]`)
    }
  }
  if (course.warnings.length) console.log(`\nWarnings:\n${course.warnings.map((w) => `  ! ${w}`).join('\n')}`)
  if (!course.modules.length) {
    console.error('\nNo modules with lessons found. Nothing to import.')
    process.exit(1)
  }

  if (!APPLY) {
    console.log('\nDry run. Add --apply to create the draft course.')
    return
  }
  const url = process.env.DATABASE_URL ?? ''
  const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
  if (!local && !REMOTE_OK) {
    console.error('\nDATABASE_URL is not local. Add --remote-ok if you really mean to write there.')
    process.exit(1)
  }
  const prisma = new PrismaClient()
  try {
    const adminEmail = opt('--admin')
    const admin = await prisma.user.findFirst({
      where: adminEmail ? { email: adminEmail.toLowerCase() } : { role: 'ADMIN' },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!admin) throw new Error('No admin user found for createdBy')
    const id = await prisma.$transaction((tx) => createCourseFromImport(tx, course, admin.id, { title: opt('--title') }), {
      timeout: 60_000,
    })
    console.log(`\nCreated draft course ${id} (by ${admin.email}). Open /admin/lms/${id} to check and publish it.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
