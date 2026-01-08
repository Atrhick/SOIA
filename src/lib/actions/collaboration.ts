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

// ============ CHANNELS ============

export async function getChannels() {
  const session = await auth()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  try {
    const channels = await prisma.collaborationChannel.findMany({
      where: session.user.role === 'ADMIN'
        ? {}
        : { allowedRoles: { has: session.user.role } },
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

    revalidatePath('/admin/collaboration')
    revalidatePath('/coach/collaboration')
    revalidatePath('/ambassador/collaboration')
    return { success: true }
  } catch (error) {
    console.error('Error leaving channel:', error)
    return { error: 'Failed to leave channel' }
  }
}
