import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { BusinessExcellenceAdminClient } from './business-excellence-admin-client'

async function getAllCoachesBusinessExcellence() {
  const coaches = await prisma.coachProfile.findMany({
    include: {
      user: {
        select: {
          email: true,
        },
      },
      businessExcellenceCRM: true,
      websiteContentStatus: true,
      outreachTargets: true,
      outreachLogs: {
        where: {
          date: {
            gte: new Date(new Date().setDate(new Date().getDate() - 30)),
          },
        },
        orderBy: { date: 'desc' },
      },
    },
    orderBy: { firstName: 'asc' },
  })

  return coaches
}

export default async function AdminBusinessExcellencePage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const coaches = await getAllCoachesBusinessExcellence()

  // Serialize data for client
  const serializedCoaches = coaches.map((coach) => ({
    id: coach.id,
    firstName: coach.firstName,
    lastName: coach.lastName,
    email: coach.user.email,
    coachStatus: coach.coachStatus,
    crm: coach.businessExcellenceCRM
      ? {
          crmActivated: coach.businessExcellenceCRM.crmActivated,
          crmSubscriptionActive: coach.businessExcellenceCRM.crmSubscriptionActive,
          crmProvider: coach.businessExcellenceCRM.crmProvider,
          lastLoginDate: coach.businessExcellenceCRM.lastLoginDate?.toISOString() || null,
          activationDate: coach.businessExcellenceCRM.activationDate?.toISOString() || null,
        }
      : null,
    website: coach.websiteContentStatus
      ? {
          logoSubmitted: coach.websiteContentStatus.logoSubmitted,
          servicesSubmitted: coach.websiteContentStatus.servicesSubmitted,
          productsSubmitted: coach.websiteContentStatus.productsSubmitted,
          pricingSubmitted: coach.websiteContentStatus.pricingSubmitted,
          targetAudienceSubmitted: coach.websiteContentStatus.targetAudienceSubmitted,
          contactSubmitted: coach.websiteContentStatus.contactSubmitted,
          aboutSubmitted: coach.websiteContentStatus.aboutSubmitted,
          visionMissionSubmitted: coach.websiteContentStatus.visionMissionSubmitted,
          bioSubmitted: coach.websiteContentStatus.bioSubmitted,
        }
      : null,
    outreachTargetsCount: coach.outreachTargets.length,
    recentOutreachCount: coach.outreachLogs.reduce((sum, log) => sum + log.quantity, 0),
  }))

  return <BusinessExcellenceAdminClient coaches={serializedCoaches} />
}
