'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// ============================================
// GET NOTIFICATIONS
// ============================================

export async function getUnreadNotifications() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const notifications = await prisma.adminNotification.findMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return {
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: n.entityType,
        entityId: n.entityId,
        actionUrl: n.actionUrl,
        createdAt: n.createdAt.toISOString(),
      })),
    }
  } catch (error) {
    console.error('Error getting notifications:', error)
    return { error: 'Failed to get notifications' }
  }
}

export async function getAllNotifications(page = 1, limit = 20) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  // Public endpoint: never trust the paging numbers.
  page = Math.max(1, Math.floor(Number(page) || 1))
  limit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 20)))

  try {
    const skip = (page - 1) * limit

    const [notifications, total] = await Promise.all([
      prisma.adminNotification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminNotification.count({
        where: { userId: session.user.id },
      }),
    ])

    return {
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: n.entityType,
        entityId: n.entityId,
        actionUrl: n.actionUrl,
        isRead: n.isRead,
        readAt: n.readAt?.toISOString() || null,
        createdAt: n.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  } catch (error) {
    console.error('Error getting all notifications:', error)
    return { error: 'Failed to get notifications' }
  }
}

export async function getNotificationCount() {
  const session = await auth()
  if (!session) {
    return { count: 0 }
  }

  try {
    const count = await prisma.adminNotification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    })

    return { count }
  } catch (error) {
    console.error('Error getting notification count:', error)
    return { count: 0 }
  }
}

// ============================================
// MARK AS READ
// ============================================

export async function markNotificationAsRead(notificationId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  // An admin viewing as someone must not change that person's notifications.
  if (session.user.isImpersonating) return { success: true }

  try {
    await prisma.adminNotification.update({
      where: {
        id: notificationId,
        userId: session.user.id,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return { error: 'Failed to mark notification as read' }
  }
}

export async function markAllNotificationsAsRead() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  // An admin viewing as someone must not change that person's notifications.
  if (session.user.isImpersonating) return { success: true }

  try {
    await prisma.adminNotification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return { error: 'Failed to mark notifications as read' }
  }
}

// Notifications are created server-side only (prisma.adminNotification.create in server code,
// e.g. src/lib/program-info/notify.ts). There is deliberately no exported "create" action here:
// everything exported from a 'use server' file is a public endpoint.

// ============================================
// DELETE NOTIFICATION
// ============================================

export async function deleteNotification(notificationId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  // An admin viewing as someone must not change that person's notifications.
  if (session.user.isImpersonating) return { success: true }

  try {
    await prisma.adminNotification.delete({
      where: {
        id: notificationId,
        userId: session.user.id,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error deleting notification:', error)
    return { error: 'Failed to delete notification' }
  }
}

export async function deleteAllReadNotifications() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  // An admin viewing as someone must not change that person's notifications.
  if (session.user.isImpersonating) return { success: true }

  try {
    await prisma.adminNotification.deleteMany({
      where: {
        userId: session.user.id,
        isRead: true,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error deleting read notifications:', error)
    return { error: 'Failed to delete notifications' }
  }
}
