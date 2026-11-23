import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { MobileNavProvider } from '@/components/dashboard/mobile-nav'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { NotificationsCard } from '@/components/pwa/notifications-card'
import { prisma } from '@/lib/prisma'
import { CALLBACK_PATH_HEADER, loginPath } from '@/lib/safe-callback'
import { isAssociateRole, isSwitchableRole, rolesOf, type AssociateRole } from '@/lib/roles'
import { newSupportCount } from '@/lib/support/server'
import { unreadConversationCount } from '@/lib/messaging/notify-message'
import { messagesPathFor } from '@/lib/messaging/notify-message-core'
import { canViewRunningCosts } from '@/lib/running-costs/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    // Deep links (program pages) carry their path from src/middleware.ts so sign-in comes back to them.
    redirect(loginPath(headers().get(CALLBACK_PATH_HEADER)))
  }

  // Cast to the supported role types
  const role = session.user.role as 'ADMIN' | 'SUB_ADMIN' | 'COACH' | 'AMBASSADOR' | 'PARENT' | AssociateRole
  const isImpersonating = session.user.isImpersonating || false

  // Fetch the profile name based on role
  let profileName: string | null = null
  if (isAssociateRole(role)) {
    const associate = await prisma.associateProfile.findUnique({
      where: { userId: session.user.id },
      select: { firstName: true, lastName: true }
    })
    if (associate) {
      profileName = `${associate.firstName} ${associate.lastName}`
    }
  } else if (role === 'COACH' && session.user.coachId) {
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

  // "Last active" on the admin person page: at most one write per user every 10 minutes, never while
  // an admin is viewing as them. Fire-and-forget so a slow or failed write never holds up the page.
  if (!isImpersonating) {
    prisma.user
      .updateMany({
        where: { id: session.user.id, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }] },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {})
  }

  // The session keeps the admin's email while impersonating, so look up who is really being viewed.
  const viewingEmail = isImpersonating
    ? (await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } }))?.email ?? null
    : null

  // The views this login can switch to (only roles it has a profile for). Not offered while viewing as someone.
  const me = isImpersonating ? null : await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, extraRoles: true, messageEmailsOff: true, coachProfile: { select: { id: true } }, ambassadorProfile: { select: { id: true } } },
  })
  const views = me
    ? rolesOf(me).filter((r) => isSwitchableRole(r) && (r !== 'COACH' || me.coachProfile) && (r !== 'AMBASSADOR' || me.ambassadorProfile))
    : []

  // Sidebar badge: support messages nobody has picked up yet (admins and sub-admins).
  const supportNew = role === 'ADMIN' || role === 'SUB_ADMIN' ? await newSupportCount({ id: session.user.id, role }) : 0
  // Sidebar badge: conversations with unread direct messages (cleared when the conversation is opened).
  const unreadDms = await unreadConversationCount(session.user.id)
  const badges: Record<string, number> = {}
  if (supportNew) { badges['/admin/support'] = supportNew; badges['/team/support'] = supportNew }
  if (unreadDms) badges[messagesPathFor(role)] = unreadDms
  // Admins have Running costs under System; anyone else sees it only when granted the feature.
  const showRunningCosts = role !== 'ADMIN' && (await canViewRunningCosts({ id: session.user.id, role }))

  return (
    <MobileNavProvider>
    <div className="min-h-screen bg-gray-50">
      <Sidebar role={role} showRunningCosts={showRunningCosts} badges={Object.keys(badges).length ? badges : undefined} />
      <Header user={{
        email: viewingEmail ?? session.user.email,
        role: session.user.role,
        name: profileName,
        isImpersonating,
        originalAdminId: session.user.originalAdminId,
        views,
        messageEmails: me ? !me.messageEmailsOff : undefined,
      }} />
      <main className={`lg:ml-64 ${isImpersonating ? 'pt-[7.25rem] sm:pt-[7.75rem]' : 'pt-20 sm:pt-[5.5rem]'} px-4 pb-6 sm:px-6`}>
        {children}
      </main>
      <InstallPrompt />
      <NotificationsCard />
    </div>
    </MobileNavProvider>
  )
}
