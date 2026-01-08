import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar role={role} />
      <Header user={{
        email: session.user.email,
        role: session.user.role,
        isImpersonating,
        originalAdminId: session.user.originalAdminId
      }} />
      <main className={`ml-64 ${isImpersonating ? 'pt-24' : 'pt-16'} p-6`}>
        {children}
      </main>
    </div>
  )
}
