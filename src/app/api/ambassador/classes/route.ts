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
    })

    if (!ambassador) {
      return NextResponse.json({ error: 'Ambassador not found' }, { status: 404 })
    }

    const classes = await prisma.coachClass.findMany({
      where: { isActive: true },
      include: {
        coach: {
          select: { firstName: true, lastName: true },
        },
        _count: {
          select: { enrollments: true },
        },
        enrollments: {
          where: { ambassadorId: ambassador.id },
          select: { id: true, status: true, paymentStatus: true },
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
    })

    // Serialize dates and decimals
    const serializedClasses = classes.map(c => ({
      ...c,
      date: c.date?.toISOString() || null,
      price: c.price?.toNumber() || null,
    }))

    return NextResponse.json({ classes: serializedClasses })
  } catch (error) {
    console.error('Error fetching classes:', error)
    return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 })
  }
}
