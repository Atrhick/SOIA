import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllProspects, getProspectStats } from '@/lib/actions/prospects'
import { ProspectsClient } from './prospects-client'

export default async function ProspectsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [prospectsResult, statsResult] = await Promise.all([
    getAllProspects(),
    getProspectStats(),
  ])

  const prospects = prospectsResult.prospects || []
  const stats = statsResult.stats || {
    total: 0,
    assessmentCompleted: 0,
    orientationPending: 0,
    businessFormPending: 0,
    interviewPending: 0,
    approved: 0,
    paymentPending: 0,
    accountCreated: 0,
    rejected: 0,
  }

  return <ProspectsClient prospects={prospects} stats={stats} />
}
