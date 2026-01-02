import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const coaches = await prisma.coachProfile.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    })

    return NextResponse.json({
      coaches: coaches.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
      })),
    })
  } catch (error) {
    console.error('Error fetching coaches:', error)
    return NextResponse.json({ error: 'Failed to fetch coaches' }, { status: 500 })
  }
}
