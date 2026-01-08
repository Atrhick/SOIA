import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { AdminAmbassadorTable } from './ambassador-table'

async function getAmbassadors() {
  return prisma.ambassador.findMany({
    include: {
      coach: {
        include: {
          user: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

async function getCoaches() {
  return prisma.coachProfile.findMany({
    where: {
      user: {
        status: 'ACTIVE',
      },
    },
    include: {
      user: {
        select: { email: true },
      },
    },
    orderBy: { firstName: 'asc' },
  })
}

export default async function AdminAmbassadorsPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [ambassadors, coaches] = await Promise.all([
    getAmbassadors(),
    getCoaches(),
  ])

  // Stats
  const stats = {
    total: ambassadors.length,
    pending: ambassadors.filter((a) => a.status === 'PENDING').length,
    approved: ambassadors.filter((a) => a.status === 'APPROVED').length,
    inactive: ambassadors.filter((a) => a.status === 'INACTIVE').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ambassadors</h1>
        <p className="text-gray-600">Manage all ambassadors across the platform</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Users className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Users className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-gray-500">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Users className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inactive}</p>
                <p className="text-sm text-gray-500">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ambassador Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Ambassadors</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminAmbassadorTable
            ambassadors={ambassadors}
            coaches={coaches.map(c => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName}`,
              email: c.user.email,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
