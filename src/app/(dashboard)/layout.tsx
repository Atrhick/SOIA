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

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar role={session.user.role} />
      <Header user={{ email: session.user.email, role: session.user.role }} />
      <main className="ml-64 pt-16 p-6">
        {children}
      </main>
    </div>
  )
}
