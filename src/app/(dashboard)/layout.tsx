import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { prisma } from '@/lib/prisma'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  // Cast to the supported role types
  const role = session.user.role as 'ADMIN' | 'COACH' | 'AMBASSADOR'
  const isImpersonating = session.user.isImpersonating || false

  // Fetch the profile name based on role
  let profileName: string | null = null
  if (role === 'COACH' && session.user.coachId) {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { id: session.user.coachId },
      select: { firstName: true, lastName: true }
    })
    if (coachProfile) {
      profileName = `${coachProfile.firstName} ${coachProfile.lastName}`
    }
  } else if (role === 'AMBASSADOR' && session.user.ambassadorId) {
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: session.user.ambassadorId },
      select: { firstName: true, lastName: true }
    })
    if (ambassador) {
      profileName = `${ambassador.firstName} ${ambassador.lastName}`
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar role={role} />
      <Header user={{
        email: session.user.email,
        role: session.user.role,
        name: profileName,
        isImpersonating,
        originalAdminId: session.user.originalAdminId
      }} />
      <main className={`ml-64 ${isImpersonating ? 'pt-24' : 'pt-16'} p-6`}>
        {children}
      </main>
    </div>
  )
}
