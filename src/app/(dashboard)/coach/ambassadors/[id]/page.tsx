import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AmbassadorDetail } from './ambassador-detail'

async function getAmbassador(userId: string, ambassadorId: string) {
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId },
  })

  if (!coachProfile) return null

  return prisma.ambassador.findFirst({
    where: {
      id: ambassadorId,
      coachId: coachProfile.id,
    },
  })
}

export default async function AmbassadorPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const ambassador = await getAmbassador(session.user.id, params.id)

  if (!ambassador) {
    notFound()
  }

  return <AmbassadorDetail ambassador={ambassador} />
}
