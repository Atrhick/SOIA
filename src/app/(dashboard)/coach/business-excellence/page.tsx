import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { BusinessExcellenceClient } from './business-excellence-client'

async function getBusinessExcellenceData(userId: string) {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
    include: {
      businessExcellenceCRM: true,
      websiteContentStatus: true,
      outreachTargets: true,
      outreachLogs: {
        where: {
          date: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
        orderBy: { date: 'desc' },
      },
      programs: {
        select: {
          id: true,
          name: true,
          slug: true,
          leads: { orderBy: { registeredAt: 'desc' } },
        },
      },
    },
  })
  return coachProfile
}

export default async function BusinessExcellencePage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const data = await getBusinessExcellenceData(session.user.id)

  if (!data) {
    redirect('/login')
  }

  // Serialize CRM data
  const crm = data.businessExcellenceCRM
    ? {
        crmActivated: data.businessExcellenceCRM.crmActivated,
        crmSubscriptionActive: data.businessExcellenceCRM.crmSubscriptionActive,
        crmProvider: data.businessExcellenceCRM.crmProvider,
        lastLoginDate: data.businessExcellenceCRM.lastLoginDate?.toISOString() || null,
      }
    : null

  // Serialize website data
  const website = data.websiteContentStatus
    ? {
        logoSubmitted: data.websiteContentStatus.logoSubmitted,
        servicesSubmitted: data.websiteContentStatus.servicesSubmitted,
        productsSubmitted: data.websiteContentStatus.productsSubmitted,
        pricingSubmitted: data.websiteContentStatus.pricingSubmitted,
        targetAudienceSubmitted: data.websiteContentStatus.targetAudienceSubmitted,
        contactSubmitted: data.websiteContentStatus.contactSubmitted,
        aboutSubmitted: data.websiteContentStatus.aboutSubmitted,
        visionMissionSubmitted: data.websiteContentStatus.visionMissionSubmitted,
        bioSubmitted: data.websiteContentStatus.bioSubmitted,
      }
    : null

  // Serialize outreach targets
  const outreachTargets = data.outreachTargets.map((t) => ({
    id: t.id,
    category: t.category,
    period: t.period,
    target: t.target,
  }))

  // Serialize outreach logs
  const outreachLogs = data.outreachLogs.map((l) => ({
    id: l.id,
    date: l.date.toISOString(),
    category: l.category,
    quantity: l.quantity,
    notes: l.notes,
  }))

  // Serialize program leads (flattened across all of this coach's programs)
  const programLeads = data.programs.flatMap((program) =>
    program.leads.map((lead) => ({
      id: lead.id,
      programName: program.name,
      fullName: lead.fullName,
      email: lead.email,
      profession: lead.profession,
      registeredAt: lead.registeredAt.toISOString(),
      qualifiedAt: lead.qualifiedAt?.toISOString() || null,
      association: lead.association,
      // The coach is the only route back to a lost joining link: the public
      // form deliberately will not re-issue it, and the app sends no email.
      joiningPath: `/p/${program.slug}/r/${lead.token}`,
      answers: (lead.answers as { label: string; value: string | number }[] | null) ?? [],
    }))
  )
  programLeads.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))

  return (
    <BusinessExcellenceClient
      crm={crm}
      website={website}
      outreachTargets={outreachTargets}
      outreachLogs={outreachLogs}
      programLeads={programLeads}
    />
  )
}
