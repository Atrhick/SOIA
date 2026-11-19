import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAssociateRole } from '@/lib/roles'
import prisma from '@/lib/prisma'

export default async function Home() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const role = session.user.role

  if (role === 'ADMIN') redirect('/admin')
  if (role === 'COACH') {
    // Coaches still onboarding start on the onboarding page. Sending them here, before any
    // page streams, matters: /coach would redirect them itself, and a redirect from inside
    // that streaming page flashed "Application error" for a moment on a fresh load
    // (switching views, viewing as someone, opening the home-screen app).
    const coach = await prisma.coachProfile.findUnique({ where: { userId: session.user.id }, select: { coachStatus: true } })
    redirect(coach?.coachStatus === 'ONBOARDING_INCOMPLETE' ? '/coach/onboarding' : '/coach')
  }
  if (role === 'AMBASSADOR') redirect('/ambassador')
  if (isAssociateRole(role)) redirect('/associate')
  // Sub-admins have one area: the support inbox (they can't open any other admin page).
  if (role === 'SUB_ADMIN') redirect('/team/support')

  // Every role must be listed above. Anything else - PARENT, or a
  // role added later - lands on /login rather than falling through to /coach,
  // which rejects non-coaches and sends them back here in an endless loop.
  redirect('/login')
}
