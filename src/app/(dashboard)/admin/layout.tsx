import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * Sub-admins work only in their own area (/team). An admin page opened by a sub-admin (an old link,
 * a typed address) sends them back to their support inbox instead of to the sign-in page.
 * Every admin page still checks role ADMIN itself.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session?.user.role === 'SUB_ADMIN') redirect('/team/support')
  return <>{children}</>
}
