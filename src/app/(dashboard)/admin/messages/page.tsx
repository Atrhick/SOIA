import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AdminMessagesClient } from './admin-messages-client'

async function getAllThreads() {
  return prisma.messageThread.findMany({
    orderBy: [
      { status: 'asc' },
      { updatedAt: 'desc' },
    ],
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      },
      participants: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  })
}

export default async function AdminMessagesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const threads = await getAllThreads()

  // Serialize data
  const serializedThreads = threads.map((t) => ({
    id: t.id,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    participants: t.participants.map((p) => ({
      id: p.id,
      email: p.email,
      role: p.role,
    })),
    messages: t.messages.map((m) => ({
      id: m.id,
      content: m.content,
      isRead: m.isRead,
      createdAt: m.createdAt.toISOString(),
      sender: {
        id: m.sender.id,
        email: m.sender.email,
        role: m.sender.role,
      },
    })),
    unreadCount: t.messages.filter(
      (m) => !m.isRead && m.senderId !== session.user.id
    ).length,
    // Get the coach (non-admin participant)
    coach: t.participants.find((p) => p.role === 'COACH') || undefined,
  }))

  // Stats
  const stats = {
    total: threads.length,
    open: threads.filter((t) => t.status === 'OPEN').length,
    inProgress: threads.filter((t) => t.status === 'IN_PROGRESS').length,
    resolved: threads.filter((t) => t.status === 'RESOLVED').length,
    unread: threads.reduce(
      (sum, t) =>
        sum +
        t.messages.filter((m) => !m.isRead && m.senderId !== session.user.id).length,
      0
    ),
  }

  return (
    <AdminMessagesClient
      threads={serializedThreads}
      currentUserId={session.user.id}
      stats={stats}
    />
  )
}
