'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, CheckCheck, Trash2, ExternalLink, LifeBuoy, ClipboardCheck, ArrowRightLeft, CreditCard, UserPlus, FileText, Mail, type LucideIcon } from 'lucide-react'
import type { NotificationType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationCount,
} from '@/lib/actions/notifications'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  entityType: string | null
  entityId: string | null
  actionUrl: string | null
  createdAt: string
}

// Every NotificationType needs an entry (the Record type makes a new enum value a type error here).
const NOTIFICATION_STYLES: Record<NotificationType, { icon: LucideIcon; className: string; label: string }> = {
  PROSPECT_ASSESSMENT_COMPLETED: { icon: ClipboardCheck, className: 'bg-blue-100 text-blue-600', label: 'Assessment' },
  PROSPECT_STATUS_CHANGED: { icon: ArrowRightLeft, className: 'bg-amber-100 text-amber-600', label: 'Prospect update' },
  PAYMENT_RECEIVED: { icon: CreditCard, className: 'bg-green-100 text-green-600', label: 'Payment' },
  ACCOUNT_CREATED: { icon: UserPlus, className: 'bg-purple-100 text-purple-600', label: 'New account' },
  PROGRAM_PAGE: { icon: FileText, className: 'bg-primary-100 text-primary-700', label: 'Program page' },
  SUPPORT: { icon: LifeBuoy, className: 'bg-sky-100 text-sky-700', label: 'Help message' },
  MESSAGE: { icon: Mail, className: 'bg-violet-100 text-violet-700', label: 'Message' },
}
const FALLBACK_STYLE = { icon: Bell, className: 'bg-gray-100 text-gray-600', label: 'Notification' }
export function notificationStyle(type: string) {
  return NOTIFICATION_STYLES[type as NotificationType] ?? FALLBACK_STYLE
}

/** Only same-site paths are followed ("/coach/programs/..."), never another site or "//host". */
export function safeActionPath(url: string | null): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return null
  return url
}

export function NotificationBell({ viewAllHref = null }: { viewAllHref?: string | null } = {}) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getUnreadNotifications()
      if (result.notifications) {
        setNotifications(result.notifications)
        setUnreadCount(result.notifications.length)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchCount = useCallback(async () => {
    try {
      const result = await getNotificationCount()
      setUnreadCount(result.count)
    } catch (error) {
      console.error('Error fetching notification count:', error)
    }
  }, [])

  // Poll for notification count every 30 seconds
  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [fetchCount])

  // Fetch full notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead()
    setNotifications([])
    setUnreadCount(0)
  }

  const handleDelete = async (notificationId: string) => {
    await deleteNotification(notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleClick = (notification: Notification) => {
    setIsOpen(false)
    // Mark read and open the link at the same time; a failed mark never blocks the link.
    void handleMarkAsRead(notification.id).catch(() => {})
    const path = safeActionPath(notification.actionUrl)
    if (path) router.push(path)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}>
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="py-0">Notifications</DropdownMenuLabel>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-gray-500 hover:text-gray-700"
              onClick={(e) => {
                e.preventDefault()
                handleMarkAllAsRead()
              }}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No new notifications</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="group relative px-2 py-2 hover:bg-gray-50 border-b last:border-b-0"
              >
                <button
                  type="button"
                  className="block w-full cursor-pointer rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  onClick={() => handleClick(notification)}
                >
                  <div className="flex gap-3">
                    {(() => {
                      const st = notificationStyle(notification.type)
                      const Icon = st.icon
                      return (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${st.className}`} title={st.label}>
                          <Icon className="h-4 w-4" aria-hidden />
                          <span className="sr-only">{st.label}: </span>
                        </div>
                      )
                    })()}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {notification.actionUrl && (
                      <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden />
                    )}
                  </div>
                </button>

                {/* Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 flex gap-1 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMarkAsRead(notification.id)
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Mark as read"
                    aria-label="Mark as read"
                  >
                    <Check className="h-3 w-3 text-gray-500" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(notification.id)
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3 text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {notifications.length > 0 && viewAllHref && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-primary-600 cursor-pointer"
              onClick={() => {
                router.push(viewAllHref)
                setIsOpen(false)
              }}
            >
              View all notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
