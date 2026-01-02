import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { MessagesClient } from './messages-client'

async function getThreads(userId: string) {
  return prisma.messageThread.findMany({
    where: {
      participants: {
        some: { id: userId },
      },
    },
    orderBy: { updatedAt: 'desc' },
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

export default async function MessagesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'COACH') {
    redirect('/login')
  }

  const threads = await getThreads(session.user.id)

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
  }))

  return (
    <MessagesClient
      threads={serializedThreads}
      currentUserId={session.user.id}
    />
  )
}
