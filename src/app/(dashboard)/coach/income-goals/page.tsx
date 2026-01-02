import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { IncomeGoalsClient } from './income-goals-client'

async function getCoachData() {
  const session = await auth()
  if (!session || session.user.role !== 'COACH') {
    return null
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      weeklyGoals: {
        orderBy: { weekStart: 'desc' },
        take: 12,
      },
      incomeEntries: {
        orderBy: { date: 'desc' },
        take: 50,
      },
    },
  })

  return coach
}

export default async function IncomeGoalsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const coach = await getCoachData()

  if (!coach) {
    redirect('/login')
  }

  // Calculate summary stats
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const monthlyIncome = coach.incomeEntries
    .filter((e) => new Date(e.date) >= startOfMonth)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const weeklyIncome = coach.incomeEntries
    .filter((e) => new Date(e.date) >= startOfWeek)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const currentWeekGoal = coach.weeklyGoals.find((g) => {
    const start = new Date(g.weekStart)
    const end = new Date(g.weekEnd)
    return now >= start && now <= end
  })

  const goalsCompleted = coach.weeklyGoals.filter((g) => g.status === 'COMPLETED').length

  // Serialize current goal for client component
  const serializedCurrentGoal = currentWeekGoal
    ? {
        id: currentWeekGoal.id,
        title: currentWeekGoal.title,
        targetValue: currentWeekGoal.targetValue,
        actualValue: currentWeekGoal.actualValue,
        status: currentWeekGoal.status,
        notes: currentWeekGoal.notes,
        weekStart: currentWeekGoal.weekStart.toISOString(),
        weekEnd: currentWeekGoal.weekEnd.toISOString(),
      }
    : null

  const stats = {
    monthlyIncome,
    weeklyIncome,
    totalEntries: coach.incomeEntries.length,
    goalsCompleted,
    currentGoal: serializedCurrentGoal,
  }

  // Convert Decimal to number for serialization
  const serializedGoals = coach.weeklyGoals.map((g) => ({
    ...g,
    weekStart: g.weekStart.toISOString(),
    weekEnd: g.weekEnd.toISOString(),
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }))

  const serializedEntries = coach.incomeEntries.map((e) => ({
    ...e,
    amount: Number(e.amount),
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }))

  return (
    <IncomeGoalsClient
      goals={serializedGoals}
      incomeEntries={serializedEntries}
      stats={stats}
    />
  )
}
