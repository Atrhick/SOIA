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
  revalidatePath('/admin/collaboration/channels')
  revalidatePath('/admin/collaboration/messages')
  revalidatePath('/admin/collaboration/files')
  revalidatePath('/coach/collaboration')
  revalidatePath('/coach/collaboration/channels')
  revalidatePath('/coach/collaboration/messages')
  revalidatePath('/coach/collaboration/files')
  revalidatePath('/ambassador/collaboration')
  revalidatePath('/ambassador/collaboration/channels')
  revalidatePath('/ambassador/collaboration/messages')
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
        name: c.name || 'Untitled Channel',
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
              include: {
                reactions: true,
              },
              orderBy: { createdAt: 'asc' }
            },
            reactions: true,
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

    // Get user info for post/reply authors and reactions
    const authorIds = new Set<string>()
    channel.posts.forEach(p => {
      authorIds.add(p.authorId)
      p.replies.forEach(r => authorIds.add(r.authorId))
      p.reactions.forEach(r => authorIds.add(r.userId))
      p.replies.forEach(reply => reply.reactions.forEach(r => authorIds.add(r.userId)))
    })

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(authorIds) } },
      select: { id: true, email: true },
    })
    const userMap = new Map(users.map(u => [u.id, u.email.split('@')[0]]))

    return {
      channel: {
        ...channel,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
        posts: channel.posts.map(p => ({
          ...p,
          authorName: userMap.get(p.authorId) || 'Unknown',
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          reactions: p.reactions.map(r => ({
            ...r,
            userName: userMap.get(r.userId),
            createdAt: r.createdAt.toISOString(),
          })),
          replies: p.replies.map(r => ({
            ...r,
            authorName: userMap.get(r.authorId) || 'Unknown',
            createdAt: r.createdAt.toISOString(),
            reactions: r.reactions.map(reaction => ({
              ...reaction,
              userName: userMap.get(reaction.userId),
              createdAt: reaction.createdAt.toISOString(),
            })),
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
        ambassadorProfile: { select: { firstName: true, lastName: true } },
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
              : user.ambassadorProfile
                ? `${user.ambassadorProfile.firstName} ${user.ambassadorProfile.lastName}`
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
        ambassadorProfile: { select: { firstName: true, lastName: true } },
      }
    })

    const userMap = new Map(users.map(u => [u.id, u]))

    const getUserName = (userId: string) => {
      const user = userMap.get(userId)
      if (!user) return 'Unknown'
      return user.coachProfile
        ? `${user.coachProfile.firstName} ${user.coachProfile.lastName}`
        : user.ambassadorProfile
          ? `${user.ambassadorProfile.firstName} ${user.ambassadorProfile.lastName}`
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
        ambassadorProfile: { select: { firstName: true, lastName: true } },
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
          : u.ambassadorProfile
            ? `${u.ambassadorProfile.firstName} ${u.ambassadorProfile.lastName}`
            : u.email,
      }))
    }
  } catch (error) {
    console.error('Error fetching users for DM:', error)
    return { error: 'Failed to fetch users' }
  }
}

// ============ DOCUMENT UPLOAD ============

export async function uploadDocument(formData: FormData) {
  const session = await auth()
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'COACH')) {
    return { error: 'Unauthorized' }
  }

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const fileName = formData.get('fileName') as string
  const fileUrl = formData.get('fileUrl') as string
  const category = formData.get('category') as string
  const isPublic = formData.get('isPublic') === 'true'
  const allowedRoles = JSON.parse(formData.get('allowedRoles') as string || '["ADMIN", "COACH", "AMBASSADOR"]')

  if (!title || !fileName || !fileUrl) {
    return { error: 'Title, file name, and URL are required' }
  }

  try {
    const document = await prisma.sharedDocument.create({
      data: {
        uploaderId: session.user.id,
        title,
        description: description || null,
        fileName,
        fileUrl,
        category: category || null,
        isPublic,
        allowedRoles,
      },
    })

    revalidateCollaboration()
    return {
      success: true,
      document: {
        ...document,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString(),
      }
    }
  } catch (error) {
    console.error('Error uploading document:', error)
    return { error: 'Failed to upload document' }
  }
}

// ============ REACTIONS ============

const SUPPORTED_EMOJIS = ['+1', '-1', 'heart', 'smile', 'laugh', 'thinking', 'clap', 'fire', 'eyes', 'check', 'x', 'question', 'celebration']

export async function addReaction(postId: string | null, replyId: string | null, emoji: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  if (!postId && !replyId) {
    return { error: 'Post ID or Reply ID is required' }
  }

  if (!SUPPORTED_EMOJIS.includes(emoji)) {
    return { error: 'Invalid emoji' }
  }

  try {
    const reaction = await prisma.postReaction.create({
      data: {
        postId,
        replyId,
        userId: session.user.id,
        emoji,
      },
    })

    revalidateCollaboration()
    return { success: true, reaction }
  } catch (error: any) {
    // Handle unique constraint violation (user already reacted with this emoji)
    if (error?.code === 'P2002') {
      return { error: 'You already reacted with this emoji' }
    }
    console.error('Error adding reaction:', error)
    return { error: 'Failed to add reaction' }
  }
}

export async function removeReaction(reactionId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const reaction = await prisma.postReaction.findUnique({
      where: { id: reactionId },
    })

    if (!reaction) {
      return { error: 'Reaction not found' }
    }

    // Only the user who created the reaction can remove it
    if (reaction.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return { error: 'Unauthorized' }
    }

    await prisma.postReaction.delete({
      where: { id: reactionId },
    })

    revalidateCollaboration()
    return { success: true }
  } catch (error) {
    console.error('Error removing reaction:', error)
    return { error: 'Failed to remove reaction' }
  }
}

export async function getPostReactions(postId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const reactions = await prisma.postReaction.findMany({
      where: { postId },
    })

    // Group by emoji and count
    const grouped = reactions.reduce((acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = { count: 0, userIds: [], hasUserReacted: false }
      }
      acc[r.emoji].count++
      acc[r.emoji].userIds.push(r.userId)
      if (r.userId === session.user.id) {
        acc[r.emoji].hasUserReacted = true
      }
      return acc
    }, {} as Record<string, { count: number; userIds: string[]; hasUserReacted: boolean }>)

    return { reactions: grouped }
  } catch (error) {
    console.error('Error fetching reactions:', error)
    return { error: 'Failed to fetch reactions' }
  }
}

// ============ MENTIONS ============

// Parse @mentions from content: @[Name](user:userId)
// Note: This is a helper function, not exported as a server action
function parseMentions(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(user:([^)]+)\)/g
  const mentions: string[] = []
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[2]) // userId
  }

  return mentions
}

export async function getMentionableUsers(channelId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const channel = await prisma.collaborationChannel.findUnique({
      where: { id: channelId },
      include: {
        members: true,
      }
    })

    if (!channel) {
      return { error: 'Channel not found' }
    }

    // Get all members of the channel
    const memberIds = channel.members.map(m => m.userId)

    const users = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: {
        id: true,
        email: true,
        role: true,
        coachProfile: { select: { firstName: true, lastName: true } },
        ambassadorProfile: { select: { firstName: true, lastName: true } },
      }
    })

    return {
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        name: u.coachProfile
          ? `${u.coachProfile.firstName} ${u.coachProfile.lastName}`
          : u.ambassadorProfile
            ? `${u.ambassadorProfile.firstName} ${u.ambassadorProfile.lastName}`
            : u.email,
      }))
    }
  } catch (error) {
    console.error('Error fetching mentionable users:', error)
    return { error: 'Failed to fetch users' }
  }
}

export async function getUserMentions() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const mentions = await prisma.postMention.findMany({
      where: { mentionedUserId: session.user.id },
      include: {
        post: {
          include: {
            channel: true,
          }
        },
        reply: {
          include: {
            post: {
              include: {
                channel: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return {
      mentions: mentions.map(m => ({
        id: m.id,
        isRead: m.isRead,
        createdAt: m.createdAt.toISOString(),
        postId: m.postId,
        replyId: m.replyId,
        channelId: m.post?.channelId || m.reply?.post?.channelId,
        channelName: m.post?.channel?.name || m.reply?.post?.channel?.name,
      }))
    }
  } catch (error) {
    console.error('Error fetching user mentions:', error)
    return { error: 'Failed to fetch mentions' }
  }
}

export async function markMentionAsRead(mentionId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const mention = await prisma.postMention.findUnique({
      where: { id: mentionId },
    })

    if (!mention || mention.mentionedUserId !== session.user.id) {
      return { error: 'Mention not found' }
    }

    await prisma.postMention.update({
      where: { id: mentionId },
      data: { isRead: true },
    })

    return { success: true }
  } catch (error) {
    console.error('Error marking mention as read:', error)
    return { error: 'Failed to mark mention as read' }
  }
}

// ============ ATTACHMENTS ============

export async function attachDocumentToPost(postId: string | null, replyId: string | null, documentId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  if (!postId && !replyId) {
    return { error: 'Post ID or Reply ID is required' }
  }

  try {
    // Verify document exists and user has access
    const document = await prisma.sharedDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return { error: 'Document not found' }
    }

    if (!document.isPublic && !document.allowedRoles.includes(session.user.role) && session.user.role !== 'ADMIN') {
      return { error: 'Access denied to document' }
    }

    const attachment = await prisma.postAttachment.create({
      data: {
        postId,
        replyId,
        documentId,
      },
    })

    revalidateCollaboration()
    return { success: true, attachment }
  } catch (error) {
    console.error('Error attaching document:', error)
    return { error: 'Failed to attach document' }
  }
}

export async function removeAttachment(attachmentId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const attachment = await prisma.postAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        post: true,
        reply: true,
      }
    })

    if (!attachment) {
      return { error: 'Attachment not found' }
    }

    // Only author or admin can remove
    const authorId = attachment.post?.authorId || attachment.reply?.authorId
    if (authorId !== session.user.id && session.user.role !== 'ADMIN') {
      return { error: 'Unauthorized' }
    }

    await prisma.postAttachment.delete({
      where: { id: attachmentId },
    })

    revalidateCollaboration()
    return { success: true }
  } catch (error) {
    console.error('Error removing attachment:', error)
    return { error: 'Failed to remove attachment' }
  }
}

// ============ MEETING LINKS ============

const meetingProviders = ['ZOOM', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'CUSTOM'] as const

export async function addMeetingLink(
  channelId: string | null,
  postId: string | null,
  provider: string,
  url: string,
  title?: string,
  scheduledAt?: string,
  duration?: number
) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  if (!channelId && !postId) {
    return { error: 'Channel ID or Post ID is required' }
  }

  if (!url) {
    return { error: 'Meeting URL is required' }
  }

  if (!meetingProviders.includes(provider as any)) {
    return { error: 'Invalid meeting provider' }
  }

  try {
    const meetingLink = await prisma.meetingLink.create({
      data: {
        channelId,
        postId,
        provider: provider as any,
        url,
        title,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        duration,
        createdById: session.user.id,
      },
    })

    revalidateCollaboration()
    return {
      success: true,
      meetingLink: {
        ...meetingLink,
        createdAt: meetingLink.createdAt.toISOString(),
        scheduledAt: meetingLink.scheduledAt?.toISOString() || null,
      }
    }
  } catch (error) {
    console.error('Error adding meeting link:', error)
    return { error: 'Failed to add meeting link' }
  }
}

export async function removeMeetingLink(linkId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const link = await prisma.meetingLink.findUnique({
      where: { id: linkId },
    })

    if (!link) {
      return { error: 'Meeting link not found' }
    }

    // Only creator or admin can remove
    if (link.createdById !== session.user.id && session.user.role !== 'ADMIN') {
      return { error: 'Unauthorized' }
    }

    await prisma.meetingLink.delete({
      where: { id: linkId },
    })

    revalidateCollaboration()
    return { success: true }
  } catch (error) {
    console.error('Error removing meeting link:', error)
    return { error: 'Failed to remove meeting link' }
  }
}

export async function getChannelMeetingLinks(channelId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const links = await prisma.meetingLink.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
    })

    return {
      meetingLinks: links.map(l => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
        scheduledAt: l.scheduledAt?.toISOString() || null,
      }))
    }
  } catch (error) {
    console.error('Error fetching meeting links:', error)
    return { error: 'Failed to fetch meeting links' }
  }
}

// ============ POST EDITING ============

export async function updatePost(postId: string, content: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  if (!content.trim()) {
    return { error: 'Content cannot be empty' }
  }

  try {
    const post = await prisma.channelPost.findUnique({
      where: { id: postId },
    })

    if (!post) {
      return { error: 'Post not found' }
    }

    // Only author or admin can edit
    if (post.authorId !== session.user.id && session.user.role !== 'ADMIN') {
      return { error: 'Unauthorized' }
    }

    const updated = await prisma.channelPost.update({
      where: { id: postId },
      data: {
        content: content.trim(),
        isEdited: true,
        editedAt: new Date(),
      },
    })

    revalidateCollaboration()
    return {
      success: true,
      post: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        editedAt: updated.editedAt?.toISOString() || null,
      }
    }
  } catch (error) {
    console.error('Error updating post:', error)
    return { error: 'Failed to update post' }
  }
}

export async function updateReply(replyId: string, content: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  if (!content.trim()) {
    return { error: 'Content cannot be empty' }
  }

  try {
    const reply = await prisma.channelPostReply.findUnique({
      where: { id: replyId },
    })

    if (!reply) {
      return { error: 'Reply not found' }
    }

    // Only author or admin can edit
    if (reply.authorId !== session.user.id && session.user.role !== 'ADMIN') {
      return { error: 'Unauthorized' }
    }

    const updated = await prisma.channelPostReply.update({
      where: { id: replyId },
      data: {
        content: content.trim(),
        isEdited: true,
        editedAt: new Date(),
      },
    })

    revalidateCollaboration()
    return {
      success: true,
      reply: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        editedAt: updated.editedAt?.toISOString() || null,
      }
    }
  } catch (error) {
    console.error('Error updating reply:', error)
    return { error: 'Failed to update reply' }
  }
}

// ============ UNREAD TRACKING ============

export async function markChannelAsRead(channelId: string) {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId,
          userId: session.user.id,
        }
      },
      data: { lastReadAt: new Date() },
    })

    return { success: true }
  } catch (error) {
    console.error('Error marking channel as read:', error)
    return { error: 'Failed to mark channel as read' }
  }
}

export async function getUnreadCounts() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    // Get all channels user is a member of
    const memberships = await prisma.channelMember.findMany({
      where: { userId: session.user.id },
      include: {
        channel: {
          include: {
            _count: {
              select: { posts: true }
            },
            posts: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            }
          }
        }
      }
    })

    const unreadCounts: Record<string, number> = {}

    for (const membership of memberships) {
      // Count posts created after lastReadAt
      const unreadPosts = await prisma.channelPost.count({
        where: {
          channelId: membership.channelId,
          createdAt: { gt: membership.lastReadAt },
        }
      })
      if (unreadPosts > 0) {
        unreadCounts[membership.channelId] = unreadPosts
      }
    }

    // Get unread mentions count
    const unreadMentions = await prisma.postMention.count({
      where: {
        mentionedUserId: session.user.id,
        isRead: false,
      }
    })

    return {
      channels: unreadCounts,
      mentions: unreadMentions,
    }
  } catch (error) {
    console.error('Error fetching unread counts:', error)
    return { error: 'Failed to fetch unread counts' }
  }
}
