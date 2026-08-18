/**
 * Parses the free-text grant goals ("10 students") into a number and a unit so
 * progress can be measured against them.
 *
 * Idempotent - only fills rows where the parsed value is still null, so it
 * never overwrites a correction an admin has made by hand.
 *
 *   npx tsx scripts/parse-program-goals.ts          # apply
 *   npx tsx scripts/parse-program-goals.ts --dry    # show what it would do
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** "10 PPLSI affiliates" -> { value: 10, unit: "PPLSI affiliates" } */
export function parseGoal(text: string): { value: number; unit: string } | null {
  const m = text?.trim().match(/^(\d+)\s*(.*)$/)
  if (!m) return null
  const value = Number.parseInt(m[1], 10)
  if (!Number.isFinite(value)) return null
  return { value, unit: m[2].trim() || 'total' }
}

async function main() {
  const dry = process.argv.includes('--dry')
  const programs = await prisma.coachProgram.findMany({
    select: {
      id: true,
      name: true,
      monthlyGrowthGoal: true,
      monthlyImpactGoal: true,
      monthlyGrowthGoalValue: true,
      monthlyImpactGoalValue: true,
    },
    orderBy: { name: 'asc' },
  })

  let updated = 0
  let unparseable = 0

  for (const p of programs) {
    const growth = p.monthlyGrowthGoalValue === null ? parseGoal(p.monthlyGrowthGoal) : null
    const impact = p.monthlyImpactGoalValue === null ? parseGoal(p.monthlyImpactGoal) : null

    if (!growth && !impact) continue
    if (p.monthlyGrowthGoalValue === null && !growth) unparseable++
    if (p.monthlyImpactGoalValue === null && !impact) unparseable++

    console.log(
      `${p.name.padEnd(26)} growth "${p.monthlyGrowthGoal}" -> ${growth ? `${growth.value} ${growth.unit}` : 'unparsed'}` +
        ` | impact "${p.monthlyImpactGoal}" -> ${impact ? `${impact.value} ${impact.unit}` : 'unparsed'}`
    )

    if (!dry) {
      await prisma.coachProgram.update({
        where: { id: p.id },
        data: {
          ...(growth
            ? { monthlyGrowthGoalValue: growth.value, monthlyGrowthGoalUnit: growth.unit }
            : {}),
          ...(impact
            ? { monthlyImpactGoalValue: impact.value, monthlyImpactGoalUnit: impact.unit }
            : {}),
        },
      })
      updated++
    }
  }

  console.log(`\n${dry ? 'would update' : 'updated'}: ${updated} programs`)
  if (unparseable > 0) {
    console.log(`goals that need an admin to set a number by hand: ${unparseable}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
