import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'AMBASSADOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ambassador = await prisma.ambassador.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        firstName: true,
        businessIdea: {
          select: {
            id: true,
            title: true,
            description: true,
            targetMarket: true,
            resources: true,
            status: true,
            feedback: true,
            submittedAt: true,
            reviewedAt: true,
          },
        },
      },
    })

    if (!ambassador) {
      return NextResponse.json({ error: 'Ambassador not found' }, { status: 404 })
    }

    // Serialize dates
    const serialized = {
      ...ambassador,
      businessIdea: ambassador.businessIdea
        ? {
            ...ambassador.businessIdea,
            submittedAt: ambassador.businessIdea.submittedAt?.toISOString() || null,
            reviewedAt: ambassador.businessIdea.reviewedAt?.toISOString() || null,
          }
        : null,
    }

    return NextResponse.json({ ambassador: serialized })
  } catch (error) {
    console.error('Error fetching business idea:', error)
    return NextResponse.json({ error: 'Failed to fetch business idea' }, { status: 500 })
  }
}
