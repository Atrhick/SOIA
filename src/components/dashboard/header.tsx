'use client'

import { useState, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, User, Users, ChevronDown, ArrowLeftRight, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { getUsersForImpersonation, getImpersonationData } from '@/lib/actions/impersonation'
import { useRouter } from 'next/navigation'
import { NotificationBell } from '@/components/notifications/notification-bell'

interface HeaderProps {
  user: {
    email: string
    role: string
    name?: string | null
    isImpersonating?: boolean
    originalAdminId?: string
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
  const [users, setUsers] = useState<ImpersonationUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

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
      // Redirect to the appropriate dashboard
      if (result.impersonateData.role === 'COACH') {
        router.push('/coach')
      } else if (result.impersonateData.role === 'AMBASSADOR') {
        router.push('/ambassador')
      }
      router.refresh()
    }
  }

  const handleStopImpersonating = async () => {
    await update({
      stopImpersonating: true
    })
    router.push('/admin')
    router.refresh()
  }

  const coaches = users.filter(u => u.role === 'COACH')
  const ambassadors = users.filter(u => u.role === 'AMBASSADOR')

  return (
    <>
      <header className="fixed top-0 left-64 right-0 z-30 bg-white border-b border-gray-200">
        {/* Impersonation Banner */}
        {user.isImpersonating && (
          <div className="bg-amber-500 text-white px-4 py-1.5">
            <div className="flex items-center justify-center gap-3">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">
                Viewing as: <strong>{user.email}</strong> ({user.role})
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

        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Welcome back!
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications - Only for Admin */}
            {user.role === 'ADMIN' && <NotificationBell />}

            {/* User Menu */}
            <DropdownMenu onOpenChange={(open) => { if (open) loadUsers() }}>
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
                        Viewing as: <span className="font-medium">{user.email}</span>
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

                {/* Admin-only: Impersonation */}
                {user.role === 'ADMIN' && !user.isImpersonating && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Login as User</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-64 max-h-80 overflow-y-auto">
                        {isLoadingUsers ? (
                          <DropdownMenuItem disabled>Loading users...</DropdownMenuItem>
                        ) : (
                          <>
                            {coaches.length > 0 && (
                              <>
                                <DropdownMenuLabel className="text-xs text-gray-500">Coaches</DropdownMenuLabel>
                                {coaches.map((u) => (
                                  <DropdownMenuItem
                                    key={u.id}
                                    onClick={() => handleImpersonate(u)}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{u.name}</span>
                                      <span className="text-xs text-gray-500">{u.email}</span>
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                            {ambassadors.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-xs text-gray-500">Ambassadors</DropdownMenuLabel>
                                {ambassadors.map((u) => (
                                  <DropdownMenuItem
                                    key={u.id}
                                    onClick={() => handleImpersonate(u)}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{u.name}</span>
                                      <span className="text-xs text-gray-500">{u.email}</span>
                                    </div>
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                            {coaches.length === 0 && ambassadors.length === 0 && (
                              <DropdownMenuItem disabled>No users available</DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                  </>
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
    </>
  )
}
