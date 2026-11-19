/**
 * Running costs page: adds the researched starting rows (rows.ts). Safe to run more than once.
 *
 *   npx tsx scripts/running-costs/seed.ts                      dry run (default): prints what it would do
 *   npx tsx scripts/running-costs/seed.ts --apply              writes (local database)
 *   npx tsx scripts/running-costs/seed.ts --apply --remote-ok  writes to a non-local database
 *   add --update                                               also overwrites rows that already exist
 *
 * Rows are matched on their stable `key`. Without --update an existing row is left alone, so edits
 * an admin made on the page are kept.
 */
import { PrismaClient } from '@prisma/client'
import { checkDatabase } from '../program-info/db'
import { CHECKED_AT, SEED_ROWS } from './rows'

const APPLY = process.argv.includes('--apply')
const REMOTE_OK = process.argv.includes('--remote-ok')
const UPDATE = process.argv.includes('--update')

async function main() {
  if (!checkDatabase(APPLY, REMOTE_OK)) process.exit(1)
  const prisma = new PrismaClient()
  try {
    const existing = new Set(
      (await prisma.costItem.findMany({ where: { key: { in: SEED_ROWS.map((r) => r.key) } }, select: { key: true } }))
        .map((r) => r.key),
    )
    let created = 0, updated = 0, kept = 0
    for (const row of SEED_ROWS) {
      const data = { ...row, checkedAt: CHECKED_AT }
      const has = existing.has(row.key)
      const action = !has ? 'create' : UPDATE ? 'update' : 'keep'
      const money = [row.monthlyLow, row.monthlyExpected, row.monthlyHigh].map((n) => (n == null ? '-' : `$${n}`)).join(' / ')
      console.log(`${action.padEnd(6)} ${row.key.padEnd(20)} ${row.status.padEnd(9)} ${money}`)
      if (action === 'keep') { kept++; continue }
      if (APPLY) {
        await prisma.costItem.upsert({ where: { key: row.key }, create: data, update: data })
      }
      if (action === 'create') created++
      else updated++
    }
    console.log(`${APPLY ? 'Done' : 'Dry run'}: ${created} to create, ${updated} to update, ${kept} kept as they are.`)
    if (!APPLY) console.log('Nothing written. Add --apply to write.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
