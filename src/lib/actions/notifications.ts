'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

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

// ============================================
// CREATE NOTIFICATION (Internal use)
// ============================================

export async function createNotification(data: {
  userId: string
  type: NotificationType
  title: string
  message: string
  entityType?: string
  entityId?: string
  actionUrl?: string
}) {
  try {
    const notification = await prisma.adminNotification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
      },
    })

    return { success: true, notification }
  } catch (error) {
    console.error('Error creating notification:', error)
    return { error: 'Failed to create notification' }
  }
}

export async function createNotificationForAdmins(data: {
  type: NotificationType
  title: string
  message: string
  entityType?: string
  entityId?: string
  actionUrl?: string
  excludeUserId?: string
}) {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
        ...(data.excludeUserId ? { id: { not: data.excludeUserId } } : {}),
      },
      select: { id: true },
    })

    if (admins.length === 0) {
      return { success: true, count: 0 }
    }

    await prisma.adminNotification.createMany({
      data: admins.map(admin => ({
        userId: admin.id,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
      })),
    })

    return { success: true, count: admins.length }
  } catch (error) {
    console.error('Error creating notifications for admins:', error)
    return { error: 'Failed to create notifications' }
  }
}

// ============================================
// DELETE NOTIFICATION
// ============================================

export async function deleteNotification(notificationId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

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
