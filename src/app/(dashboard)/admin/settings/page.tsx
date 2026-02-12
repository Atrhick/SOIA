import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getSitePages } from '@/lib/actions/site-pages'
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

  const [stats, sitePagesResult] = await Promise.all([
    getSystemStats(),
    getSitePages(),
  ])

  return (
    <SettingsClient
      stats={stats}
      sitePages={sitePagesResult.pages || []}
    />
  )
}
