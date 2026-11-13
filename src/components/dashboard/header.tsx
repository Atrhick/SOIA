'use client'

import { useState, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, Search, User, Users, ChevronDown, ArrowLeftRight, Shield, Menu, Smartphone, Bell, BellOff } from 'lucide-react'
import { useMobileNav } from '@/components/dashboard/mobile-nav'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getUsersForImpersonation, getImpersonationData } from '@/lib/actions/impersonation'
import { useRouter } from 'next/navigation'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { OPEN_INSTALL_EVENT, isInstalled } from '@/components/pwa/install-prompt'
import { pushState, turnOnPush, turnOffPush, type PushState } from '@/components/pwa/push-client'
import { ROLE_VIEW_NAMES, homeForRole, isSwitchableRole } from '@/lib/roles'
import { useToast } from '@/components/ui/kit/toast'

interface HeaderProps {
  user: {
    email: string
    role: string
    name?: string | null
    isImpersonating?: boolean
    originalAdminId?: string
    /** The roles this login can switch between (admin, coach, ambassador). */
    views?: string[]
  }
}

interface ImpersonationUser {
  id: string
  email: string
  role: string
  name: string
  coachId?: string
  ambassadorId?: string
}

export function Header({ user }: HeaderProps) {
  const { update } = useSession()
  const router = useRouter()
  const mobileNav = useMobileNav()
  const [users, setUsers] = useState<ImpersonationUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Hidden once the app runs from the home screen.
  const [canInstall, setCanInstall] = useState(false)
  useEffect(() => { setCanInstall(!isInstalled()) }, [])
  const [push, setPush] = useState<PushState>('unsupported')
  const [pushBusy, setPushBusy] = useState(false)
  useEffect(() => { pushState().then(setPush).catch(() => {}) }, [])
  const togglePush = async () => {
    if (push === 'needs-install') { window.dispatchEvent(new Event(OPEN_INSTALL_EVENT)); return }
    setPushBusy(true)
    try { setPush(push === 'on' ? await turnOffPush() : await turnOnPush()) } catch { setPush(await pushState()) }
    setPushBusy(false)
  }

  const loadUsers = async () => {
    if (user.role !== 'ADMIN' || user.isImpersonating) return
    setIsLoadingUsers(true)
    const result = await getUsersForImpersonation()
    if (result.users) {
      setUsers(result.users)
    }
    setIsLoadingUsers(false)
  }

  const handleImpersonate = async (targetUser: ImpersonationUser) => {
    const result = await getImpersonationData(targetUser.id)
    if (result.impersonateData) {
      await update({
        impersonate: result.impersonateData
      })
      // Redirect to the appropriate dashboard. Always navigate somewhere the
      // impersonated role can actually load: staying put on an admin-only page
      // bounces to /login, which renders no header and therefore no way back.
      if (result.impersonateData.role === 'COACH') {
        router.push('/coach')
      } else if (result.impersonateData.role === 'AMBASSADOR') {
        router.push('/ambassador')
      } else {
        router.push('/')
      }
      router.refresh()
    }
  }

  const toast = useToast()
  const [switching, setSwitching] = useState(false)
  const otherViews = (user.views ?? []).filter((r) => r !== user.role && isSwitchableRole(r))
  const handleSwitchView = async (role: string) => {
    setSwitching(true)
    const s = await update({ switchRole: role })
    if (s?.user?.role !== role) { setSwitching(false); toast.error('We couldn’t switch your view. Sign out and back in, then try again.'); return }
    // A full load, so every part of the page is drawn for the new view.
    window.location.assign(homeForRole(role))
  }

  const handleStopImpersonating = async () => {
    await update({
      stopImpersonating: true
    })
    // A full load: router.push + refresh raced and left the address on the coach/ambassador page.
    window.location.assign('/admin')
  }

  const q = query.trim().toLowerCase()
  const matches = (u: ImpersonationUser) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  const coaches = users.filter(u => u.role === 'COACH' && matches(u))
  const ambassadors = users.filter(u => u.role === 'AMBASSADOR' && matches(u))

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 lg:left-64">
        {/* Impersonation Banner */}
        {user.isImpersonating && (
          <div className="bg-amber-500 text-white px-4 py-1.5">
            <div className="flex items-center justify-center gap-3">
              <Shield className="w-4 h-4 shrink-0" />
              <span className="min-w-0 truncate text-sm font-medium" title={user.email}>
                Viewing as: <strong>{user.name || user.email}</strong>
                <span className="hidden sm:inline"> ({user.email}, {user.role.toLowerCase()})</span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleStopImpersonating}
                className="h-6 px-2 text-xs bg-white text-amber-600 hover:bg-amber-50"
              >
                <ArrowLeftRight className="w-3 h-3 mr-1" />
                Switch Back
              </Button>
            </div>
          </div>
        )}

        <div className="flex h-16 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => mobileNav.setOpen(true)}
              aria-label="Open menu"
              aria-controls="dashboard-sidebar"
              aria-expanded={mobileNav.open}
              className="-ml-2 rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-lg font-semibold text-gray-900">
              Welcome back!
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {/* Notifications - Only for Admin */}
            {user.role === 'ADMIN' && <NotificationBell />}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 border-l pl-4">
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-600" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900">{user.name || user.email}</p>
                    <p className="text-xs text-gray-500 capitalize">{user.role.toLowerCase()}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Switch back to Admin when impersonating */}
                {user.isImpersonating && (
                  <>
                    <div className="px-2 py-1.5 mb-1 bg-amber-50 rounded-sm">
                      <p className="text-xs text-amber-700">
                        Viewing as: <span className="font-medium">{user.name ? `${user.name} (${user.email})` : user.email}</span>
                      </p>
                    </div>
                    <DropdownMenuItem
                      onClick={handleStopImpersonating}
                      className="cursor-pointer text-amber-600"
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      <span>Switch Back to Admin</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Switch between the roles this login holds */}
                {otherViews.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-xs font-normal text-gray-500">
                      You’re in the {ROLE_VIEW_NAMES[user.role as keyof typeof ROLE_VIEW_NAMES] ?? user.role.toLowerCase()} view
                    </DropdownMenuLabel>
                    {otherViews.map((r) => (
                      <DropdownMenuItem key={r} onSelect={() => { void handleSwitchView(r) }} disabled={switching} className="cursor-pointer">
                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                        <span>Switch to {ROLE_VIEW_NAMES[r as keyof typeof ROLE_VIEW_NAMES]} view</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Admin-only: Impersonation */}
                {user.role === 'ADMIN' && !user.isImpersonating && (
                  <>
                    <DropdownMenuItem
                      onSelect={() => { setPickerOpen(true); setQuery(''); void loadUsers() }}
                      className="cursor-pointer"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      <span>Login as User</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {(push === 'on' || push === 'off' || push === 'needs-install' || push === 'blocked') && (
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); if (push !== 'blocked' && !pushBusy) void togglePush() }}
                    className="cursor-pointer"
                    disabled={push === 'blocked'}
                  >
                    {push === 'on' ? <Bell className="mr-2 h-4 w-4 text-primary-700" /> : <BellOff className="mr-2 h-4 w-4" />}
                    <span className="flex-1">
                      {push === 'blocked' ? 'Notifications blocked in browser settings'
                        : push === 'needs-install' ? 'Notifications: add to home screen first'
                        : pushBusy ? 'Notifications…' : `Notifications on this device: ${push === 'on' ? 'On' : 'Off'}`}
                    </span>
                  </DropdownMenuItem>
                )}
                {canInstall && (
                  <DropdownMenuItem
                    onClick={() => window.dispatchEvent(new Event(OPEN_INSTALL_EVENT))}
                    className="cursor-pointer"
                  >
                    <Smartphone className="mr-2 h-4 w-4" />
                    <span>Add to home screen</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-red-600 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Admin: pick someone to view the app as. A dialog, not a side submenu, so it fits on phones. */}
      {user.role === 'ADMIN' && !user.isImpersonating && (
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-md flex-col gap-3 p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Login as User</DialogTitle>
              <DialogDescription>See the app as this coach or ambassador. It switches back after 30 minutes.</DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                aria-label="Search name or email"
                className="h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-base focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30"
              />
            </div>
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              {isLoadingUsers ? (
                <p className="py-6 text-center text-sm text-gray-500">Loading people…</p>
              ) : coaches.length === 0 && ambassadors.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">{q ? 'No one matches that search.' : 'No users available.'}</p>
              ) : (
                [{ label: 'Coaches', list: coaches }, { label: 'Ambassadors', list: ambassadors }].filter((g) => g.list.length).map((g) => (
                  <section key={g.label} className="mb-3">
                    <h3 className="sticky top-0 bg-white py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.label} ({g.list.length})</h3>
                    <ul className="space-y-1">
                      {g.list.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => { setPickerOpen(false); void handleImpersonate(u) }}
                            className="flex min-h-[48px] w-full flex-col items-start justify-center rounded-lg px-3 py-2 text-left hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                          >
                            <span className="w-full truncate font-medium text-gray-900">{u.name}</span>
                            <span className="w-full truncate text-sm text-gray-500">{u.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
