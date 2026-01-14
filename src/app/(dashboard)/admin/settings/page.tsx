import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { SettingsClient } from './settings-client'

async function getSystemStats() {
  const [
    totalUsers,
    totalCoaches,
    totalAmbassadors,
    totalEvents,
    totalCourses,
    featureConfigs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.coachProfile.count(),
    prisma.ambassador.count(),
    prisma.event.count(),
    prisma.course.count(),
    prisma.featureConfig.findMany({
      select: {
        feature: true,
        isEnabled: true,
        enabledForCoaches: true,
        enabledForAmbassadors: true,
      },
    }),
  ])

  return {
    totalUsers,
    totalCoaches,
    totalAmbassadors,
    totalEvents,
    totalCourses,
    featureConfigs: featureConfigs.map(fc => ({
      feature: fc.feature,
      isEnabled: fc.isEnabled,
      enabledForCoaches: fc.enabledForCoaches,
      enabledForAmbassadors: fc.enabledForAmbassadors,
    })),
  }
}

export default async function SettingsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const stats = await getSystemStats()

  return <SettingsClient stats={stats} />
}
