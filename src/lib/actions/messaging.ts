'use server'

import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const createThreadSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  category: z.enum(['ONBOARDING', 'AMBASSADORS', 'SPONSORSHIP', 'EVENTS', 'TECHNICAL', 'OTHER']),
  message: z.string().min(1, 'Message is required'),
})

const replySchema = z.object({
  content: z.string().min(1, 'Message is required'),
})

// Helper to get current user
async function getCurrentUser() {
  const session = await auth()
  if (!session) return null
  return session.user
}

// Create a new message thread
export async function createMessageThread(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const data = {
    subject: formData.get('subject') as string,
    category: formData.get('category') as string,
    message: formData.get('message') as string,
  }

  const validated = createThreadSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  try {
    // Get admin users to add as participants
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
    })

    // Create thread with the user and all admins as participants
    const participantIds = [user.id, ...admins.map((a) => a.id)]
    const uniqueParticipantIds = Array.from(new Set(participantIds))

    const thread = await prisma.messageThread.create({
      data: {
        subject: validated.data.subject,
        category: validated.data.category as 'ONBOARDING' | 'AMBASSADORS' | 'SPONSORSHIP' | 'EVENTS' | 'TECHNICAL' | 'OTHER',
        participants: {
          connect: uniqueParticipantIds.map((id) => ({ id })),
        },
        messages: {
          create: {
            senderId: user.id,
            content: validated.data.message,
          },
        },
      },
    })

    revalidatePath('/coach/messages')
    revalidatePath('/admin/messages')
    return { success: true, threadId: thread.id }
  } catch (error) {
    console.error('Error creating message thread:', error)
    return { error: 'Failed to create thread' }
  }
}

// Reply to a thread
export async function replyToThread(threadId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const data = {
    content: formData.get('content') as string,
  }

  const validated = replySchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  // Verify user is a participant
  const thread = await prisma.messageThread.findFirst({
    where: {
      id: threadId,
      participants: {
        some: { id: user.id },
      },
    },
  })

  if (!thread) {
    return { error: 'Thread not found or access denied' }
  }

  try {
    await prisma.message.create({
      data: {
        threadId,
        senderId: user.id,
        content: validated.data.content,
      },
    })

    // Update thread timestamp
    await prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    })

    revalidatePath('/coach/messages')
    revalidatePath('/admin/messages')
    return { success: true }
  } catch (error) {
    console.error('Error replying to thread:', error)
    return { error: 'Failed to send reply' }
  }
}

// Mark messages as read
export async function markMessagesAsRead(threadId: string) {
  const user = await getCurrentUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.message.updateMany({
      where: {
        threadId,
        senderId: { not: user.id },
        isRead: false,
      },
      data: { isRead: true },
    })

    revalidatePath('/coach/messages')
    revalidatePath('/admin/messages')
    return { success: true }
  } catch (error) {
    console.error('Error marking messages as read:', error)
    return { error: 'Failed to mark as read' }
  }
}

// Update thread status (admin only)
export async function updateThreadStatus(
  threadId: string,
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.messageThread.update({
      where: { id: threadId },
      data: { status },
    })

    revalidatePath('/coach/messages')
    revalidatePath('/admin/messages')
    return { success: true }
  } catch (error) {
    console.error('Error updating thread status:', error)
    return { error: 'Failed to update status' }
  }
}

// Get unread message count
export async function getUnreadCount() {
  const user = await getCurrentUser()
  if (!user) {
    return { count: 0 }
  }

  try {
    const threads = await prisma.messageThread.findMany({
      where: {
        participants: {
          some: { id: user.id },
        },
      },
      select: {
        messages: {
          where: {
            senderId: { not: user.id },
            isRead: false,
          },
          select: { id: true },
        },
      },
    })

    const count = threads.reduce((sum, t) => sum + t.messages.length, 0)
    return { count }
  } catch (error) {
    console.error('Error getting unread count:', error)
    return { count: 0 }
  }
}
