'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Channel schemas
const createChannelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(100),
  description: z.string().optional(),
  isPrivate: z.boolean().default(false),
  allowedRoles: z.array(z.string()).default(['ADMIN', 'COACH', 'AMBASSADOR']),
})

const createPostSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  content: z.string().min(1, 'Content is required'),
})

const createReplySchema = z.object({
  postId: z.string().min(1, 'Post ID is required'),
  content: z.string().min(1, 'Content is required'),
})

// Helper to revalidate all collaboration paths
function revalidateCollaboration() {
  revalidatePath('/admin/collaboration')
  revalidatePath('/coach/collaboration')
  revalidatePath('/ambassador/collaboration')
}

// ============ CHANNELS ============

export async function getChannels() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const channels = await prisma.collaborationChannel.findMany({
      where: {
        type: 'CHANNEL',
        ...(session.user.role === 'ADMIN'
          ? {}
          : { allowedRoles: { has: session.user.role } }),
      },
      include: {
        _count: {
          select: { posts: true, members: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      channels: channels.map(c => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        postCount: c._count.posts,
        memberCount: c._count.members,
      }))
    }
  } catch (error) {
    console.error('Error fetching channels:', error)
    return { error: 'Failed to fetch channels' }
  }
}

export async function getChannel(channelId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const channel = await prisma.collaborationChannel.findUnique({
      where: { id: channelId },
      include: {
        posts: {
          include: {
            replies: {
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        members: true,
        _count: {
          select: { posts: true, members: true }
        }
      },
    })

    if (!channel) {
      return { error: 'Channel not found' }
    }

    // Check access
    if (session.user.role !== 'ADMIN' && !channel.allowedRoles.includes(session.user.role)) {
      return { error: 'Access denied' }
    }

    return {
      channel: {
        ...channel,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
        posts: channel.posts.map(p => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          replies: p.replies.map(r => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
          }))
        })),
        members: channel.members.map(m => ({
          ...m,
          joinedAt: m.joinedAt.toISOString(),
        })),
      }
    }
  } catch (error) {
    console.error('Error fetching channel:', error)
    return { error: 'Failed to fetch channel' }
  }
}

export async function createChannel(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const data = {
    name: formData.get('name') as string,
    description: formData.get('description') as string || undefined,
    isPrivate: formData.get('isPrivate') === 'true',
    allowedRoles: JSON.parse(formData.get('allowedRoles') as string || '["ADMIN", "COACH", "AMBASSADOR"]'),
  }

  const validated = createChannelSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid data' }
  }

  try {
    const channel = await prisma.collaborationChannel.create({
      data: {
        ...validated.data,
        type: 'CHANNEL',
        createdById: session.user.id,
      },
    })

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true, channel }
  } catch (error) {
    console.error('Error creating channel:', error)
    return { error: 'Failed to create channel' }
  }
}

export async function updateChannel(channelId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const data = {
    name: formData.get('name') as string,
    description: formData.get('description') as string || undefined,
    isPrivate: formData.get('isPrivate') === 'true',
    allowedRoles: JSON.parse(formData.get('allowedRoles') as string || '["ADMIN", "COACH", "AMBASSADOR"]'),
  }

  const validated = createChannelSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid data' }
  }

  try {
    const channel = await prisma.collaborationChannel.update({
      where: { id: channelId },
      data: validated.data,
    })

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true, channel }
  } catch (error) {
    console.error('Error updating channel:', error)
    return { error: 'Failed to update channel' }
  }
}

export async function deleteChannel(channelId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Delete all related data first
    await prisma.channelPostReply.deleteMany({
      where: { post: { channelId } }
    })
    await prisma.channelPost.deleteMany({
      where: { channelId }
    })
    await prisma.channelMember.deleteMany({
      where: { channelId }
    })
    await prisma.collaborationChannel.delete({
      where: { id: channelId },
    })

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true }
  } catch (error) {
    console.error('Error deleting channel:', error)
    return { error: 'Failed to delete channel' }
  }
}

// ============ POSTS ============

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  const data = {
    channelId: formData.get('channelId') as string,
    content: formData.get('content') as string,
  }

  const validated = createPostSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid data' }
  }

  try {
    // Verify channel access
    const channel = await prisma.collaborationChannel.findUnique({
      where: { id: validated.data.channelId },
    })

    if (!channel) {
      return { error: 'Channel not found' }
    }

    if (session.user.role !== 'ADMIN' && !channel.allowedRoles.includes(session.user.role)) {
      return { error: 'Access denied' }
    }

    const post = await prisma.channelPost.create({
      data: {
        channelId: validated.data.channelId,
        authorId: session.user.id,
        content: validated.data.content,
      },
    })

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true, post }
  } catch (error) {
    console.error('Error creating post:', error)
    return { error: 'Failed to create post' }
  }
}

export async function createReply(formData: FormData) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  const data = {
    postId: formData.get('postId') as string,
    content: formData.get('content') as string,
  }

  const validated = createReplySchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid data' }
  }

  try {
    const reply = await prisma.channelPostReply.create({
      data: {
        postId: validated.data.postId,
        authorId: session.user.id,
        content: validated.data.content,
      },
    })

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true, reply }
  } catch (error) {
    console.error('Error creating reply:', error)
    return { error: 'Failed to create reply' }
  }
}

export async function togglePinPost(postId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const post = await prisma.channelPost.findUnique({
      where: { id: postId },
    })

    if (!post) {
      return { error: 'Post not found' }
    }

    const updated = await prisma.channelPost.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned },
    })

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true, isPinned: updated.isPinned }
  } catch (error) {
    console.error('Error toggling pin:', error)
    return { error: 'Failed to toggle pin' }
  }
}

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const post = await prisma.channelPost.findUnique({
      where: { id: postId },
    })

    if (!post) {
      return { error: 'Post not found' }
    }

    // Only admin or author can delete
    if (session.user.role !== 'ADMIN' && post.authorId !== session.user.id) {
      return { error: 'Unauthorized' }
    }

    await prisma.channelPostReply.deleteMany({
      where: { postId }
    })
    await prisma.channelPost.delete({
      where: { id: postId },
    })

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true }
  } catch (error) {
    console.error('Error deleting post:', error)
    return { error: 'Failed to delete post' }
  }
}

// ============ SHARED DOCUMENTS ============

export async function getSharedDocuments() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const documents = await prisma.sharedDocument.findMany({
      where: session.user.role === 'ADMIN'
        ? {}
        : {
            OR: [
              { isPublic: true },
              { allowedRoles: { has: session.user.role } },
            ]
          },
      orderBy: { createdAt: 'desc' },
    })

    return {
      documents: documents.map(d => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }))
    }
  } catch (error) {
    console.error('Error fetching documents:', error)
    return { error: 'Failed to fetch documents' }
  }
}

export async function createSharedDocument(formData: FormData) {
  const session = await auth()
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'COACH')) {
    return { error: 'Unauthorized' }
  }

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const fileName = formData.get('fileName') as string
  const fileUrl = formData.get('fileUrl') as string
  const fileSize = parseInt(formData.get('fileSize') as string) || null
  const mimeType = formData.get('mimeType') as string
  const isPublic = formData.get('isPublic') === 'true'
  const allowedRoles = JSON.parse(formData.get('allowedRoles') as string || '["ADMIN", "COACH", "AMBASSADOR"]')
  const category = formData.get('category') as string

  if (!title || !fileName || !fileUrl) {
    return { error: 'Title, file name, and URL are required' }
  }

  try {
    const document = await prisma.sharedDocument.create({
      data: {
        uploaderId: session.user.id,
        title,
        description,
        fileName,
        fileUrl,
        fileSize,
        mimeType,
        isPublic,
        allowedRoles,
        category,
      },
    })

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true, document }
  } catch (error) {
    console.error('Error creating document:', error)
    return { error: 'Failed to create document' }
  }
}

export async function deleteSharedDocument(documentId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.sharedDocument.delete({
      where: { id: documentId },
    })

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true }
  } catch (error) {
    console.error('Error deleting document:', error)
    return { error: 'Failed to delete document' }
  }
}

// ============ CHANNEL MEMBERS ============

export async function joinChannel(channelId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const channel = await prisma.collaborationChannel.findUnique({
      where: { id: channelId },
    })

    if (!channel) {
      return { error: 'Channel not found' }
    }

    if (session.user.role !== 'ADMIN' && !channel.allowedRoles.includes(session.user.role)) {
      return { error: 'Access denied' }
    }

    await prisma.channelMember.upsert({
      where: {
        channelId_userId: {
          channelId,
          userId: session.user.id,
        }
      },
      update: {},
      create: {
        channelId,
        userId: session.user.id,
      },
    })

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true }
  } catch (error) {
    console.error('Error joining channel:', error)
    return { error: 'Failed to join channel' }
  }
}

export async function leaveChannel(channelId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId: session.user.id,
        }
      },
    })

    revalidateCollaboration()
    return { success: true }
  } catch (error) {
    console.error('Error leaving channel:', error)
    return { error: 'Failed to leave channel' }
  }
}

// ============ DIRECT MESSAGES ============

export async function getDirectMessages() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    // Get all DM conversations where user is a member
    const dms = await prisma.collaborationChannel.findMany({
      where: {
        type: 'DIRECT_MESSAGE',
        members: {
          some: { userId: session.user.id }
        }
      },
      include: {
        members: {
          include: {
            // We need to get user info - but ChannelMember doesn't have direct user relation
            // So we'll fetch separately
          }
        },
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Get last message for preview
        },
        _count: {
          select: { posts: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Get user info for each DM's members
    const memberUserIds = dms.flatMap(dm => dm.members.map(m => m.userId))
    const users = await prisma.user.findMany({
      where: { id: { in: memberUserIds } },
      select: {
        id: true,
        email: true,
        role: true,
        coachProfile: { select: { firstName: true, lastName: true } },
        ambassador: { select: { firstName: true, lastName: true } },
      }
    })

    const userMap = new Map(users.map(u => [u.id, u]))

    return {
      directMessages: dms.map(dm => {
        // Get other participants (exclude current user)
        const otherMembers = dm.members
          .filter(m => m.userId !== session.user.id)
          .map(m => {
            const user = userMap.get(m.userId)
            if (!user) return null
            const name = user.coachProfile
              ? `${user.coachProfile.firstName} ${user.coachProfile.lastName}`
              : user.ambassador
                ? `${user.ambassador.firstName} ${user.ambassador.lastName}`
                : user.email
            return {
              userId: m.userId,
              name,
              email: user.email,
              role: user.role,
            }
          })
          .filter(Boolean)

        return {
          id: dm.id,
          participants: otherMembers,
          lastMessage: dm.posts[0] ? {
            content: dm.posts[0].content,
            createdAt: dm.posts[0].createdAt.toISOString(),
            authorId: dm.posts[0].authorId,
          } : null,
          messageCount: dm._count.posts,
          createdAt: dm.createdAt.toISOString(),
          updatedAt: dm.updatedAt.toISOString(),
        }
      })
    }
  } catch (error) {
    console.error('Error fetching direct messages:', error)
    return { error: 'Failed to fetch direct messages' }
  }
}

export async function getOrCreateDirectMessage(otherUserId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  if (otherUserId === session.user.id) {
    return { error: 'Cannot create DM with yourself' }
  }

  try {
    // Check if DM already exists between these two users
    const existingDM = await prisma.collaborationChannel.findFirst({
      where: {
        type: 'DIRECT_MESSAGE',
        AND: [
          { members: { some: { userId: session.user.id } } },
          { members: { some: { userId: otherUserId } } },
        ],
        members: {
          every: {
            userId: { in: [session.user.id, otherUserId] }
          }
        }
      },
      include: {
        members: true,
        _count: { select: { members: true } }
      }
    })

    // If exists and has exactly 2 members, return it
    if (existingDM && existingDM._count.members === 2) {
      return { channelId: existingDM.id, isNew: false }
    }

    // Create new DM
    const dm = await prisma.collaborationChannel.create({
      data: {
        type: 'DIRECT_MESSAGE',
        name: null,
        isPrivate: true,
        createdById: session.user.id,
        allowedRoles: [],
        members: {
          create: [
            { userId: session.user.id },
            { userId: otherUserId },
          ]
        }
      },
    })

    revalidateCollaboration()
    return { channelId: dm.id, isNew: true }
  } catch (error) {
    console.error('Error creating direct message:', error)
    return { error: 'Failed to create direct message' }
  }
}

export async function sendDirectMessage(channelId: string, content: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  if (!content.trim()) {
    return { error: 'Message cannot be empty' }
  }

  try {
    // Verify user is a member of this DM
    const dm = await prisma.collaborationChannel.findFirst({
      where: {
        id: channelId,
        type: 'DIRECT_MESSAGE',
        members: { some: { userId: session.user.id } }
      }
    })

    if (!dm) {
      return { error: 'Conversation not found or access denied' }
    }

    // Create message (using post model)
    const message = await prisma.channelPost.create({
      data: {
        channelId,
        authorId: session.user.id,
        content: content.trim(),
      }
    })

    // Update DM timestamp
    await prisma.collaborationChannel.update({
      where: { id: channelId },
      data: { updatedAt: new Date() }
    })

    revalidateCollaboration()
    return {
      success: true,
      message: {
        id: message.id,
        content: message.content,
        authorId: message.authorId,
        createdAt: message.createdAt.toISOString(),
      }
    }
  } catch (error) {
    console.error('Error sending direct message:', error)
    return { error: 'Failed to send message' }
  }
}

export async function getDirectMessageHistory(channelId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    // Verify access
    const dm = await prisma.collaborationChannel.findFirst({
      where: {
        id: channelId,
        type: 'DIRECT_MESSAGE',
        members: { some: { userId: session.user.id } }
      },
      include: {
        members: true,
        posts: {
          orderBy: { createdAt: 'asc' },
          take: 100, // Last 100 messages
        }
      }
    })

    if (!dm) {
      return { error: 'Conversation not found or access denied' }
    }

    // Get user info for participants
    const memberUserIds = dm.members.map(m => m.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: memberUserIds } },
      select: {
        id: true,
        email: true,
        role: true,
        coachProfile: { select: { firstName: true, lastName: true } },
        ambassador: { select: { firstName: true, lastName: true } },
      }
    })

    const userMap = new Map(users.map(u => [u.id, u]))

    const getUserName = (userId: string) => {
      const user = userMap.get(userId)
      if (!user) return 'Unknown'
      return user.coachProfile
        ? `${user.coachProfile.firstName} ${user.coachProfile.lastName}`
        : user.ambassador
          ? `${user.ambassador.firstName} ${user.ambassador.lastName}`
          : user.email
    }

    return {
      conversation: {
        id: dm.id,
        participants: dm.members.map(m => ({
          userId: m.userId,
          name: getUserName(m.userId),
          email: userMap.get(m.userId)?.email || '',
          role: userMap.get(m.userId)?.role || '',
          isCurrentUser: m.userId === session.user.id,
        })),
        messages: dm.posts.map(p => ({
          id: p.id,
          content: p.content,
          authorId: p.authorId,
          authorName: getUserName(p.authorId),
          isCurrentUser: p.authorId === session.user.id,
          createdAt: p.createdAt.toISOString(),
        }))
      }
    }
  } catch (error) {
    console.error('Error fetching DM history:', error)
    return { error: 'Failed to fetch messages' }
  }
}

export async function getUsersForDM() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    // Get users based on role
    // Admin can message anyone
    // Coach can message admins and their ambassadors
    // Ambassador can message their coach and admins

    let whereClause: any = {}

    if (session.user.role === 'ADMIN') {
      // Admin can message coaches and ambassadors
      whereClause = {
        role: { in: ['COACH', 'AMBASSADOR', 'ADMIN'] },
        id: { not: session.user.id }
      }
    } else if (session.user.role === 'COACH') {
      // Coach can message admins and ambassadors assigned to them
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.user.id },
        include: { ambassadors: { select: { userId: true } } }
      })
      const ambassadorUserIds = coach?.ambassadors.map(a => a.userId).filter(Boolean) || []

      whereClause = {
        OR: [
          { role: 'ADMIN' },
          { id: { in: ambassadorUserIds } }
        ],
        id: { not: session.user.id }
      }
    } else if (session.user.role === 'AMBASSADOR') {
      // Ambassador can message their coach and admins
      const ambassador = await prisma.ambassador.findUnique({
        where: { userId: session.user.id },
        include: { coach: { select: { userId: true } } }
      })

      whereClause = {
        OR: [
          { role: 'ADMIN' },
          ...(ambassador?.coach?.userId ? [{ id: ambassador.coach.userId }] : [])
        ],
        id: { not: session.user.id }
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        role: true,
        coachProfile: { select: { firstName: true, lastName: true } },
        ambassador: { select: { firstName: true, lastName: true } },
      },
      orderBy: { email: 'asc' }
    })

    return {
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        name: u.coachProfile
          ? `${u.coachProfile.firstName} ${u.coachProfile.lastName}`
          : u.ambassador
            ? `${u.ambassador.firstName} ${u.ambassador.lastName}`
            : u.email,
      }))
    }
  } catch (error) {
    console.error('Error fetching users for DM:', error)
    return { error: 'Failed to fetch users' }
  }
}
