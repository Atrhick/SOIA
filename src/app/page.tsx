import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAssociateRole } from '@/lib/roles'

export default async function Home() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const role = session.user.role

  if (role === 'ADMIN') redirect('/admin')
  if (role === 'COACH') redirect('/coach')
  if (role === 'AMBASSADOR') redirect('/ambassador')
  if (isAssociateRole(role)) redirect('/associate')

  // Every role must be listed above. Anything else - PARENT, SUB_ADMIN, or a
  // role added later - lands on /login rather than falling through to /coach,
  // which rejects non-coaches and sends them back here in an endless loop.
  redirect('/login')
}
