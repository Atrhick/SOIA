'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ============================================
// CATEGORIES
// ============================================

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().default(0),
  allowedRoles: z.array(z.string()).default(['ADMIN', 'COACH', 'AMBASSADOR']),
})

export async function getKBCategories(role?: string) {
  try {
    const categories = await prisma.kBCategory.findMany({
      where: role && role !== 'ADMIN' ? {
        allowedRoles: { has: role },
      } : undefined,
      include: {
        _count: { select: { articles: true } },
        children: {
          include: {
            _count: { select: { articles: true } },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return { categories }
  } catch (error) {
    console.error('Error getting KB categories:', error)
    return { error: 'Failed to get categories' }
  }
}

export async function createKBCategory(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const rawData = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string || undefined,
    parentId: formData.get('parentId') as string || null,
    sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
    allowedRoles: JSON.parse(formData.get('allowedRoles') as string || '["ADMIN", "COACH", "AMBASSADOR"]'),
  }

  const validated = categorySchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const category = await prisma.kBCategory.create({
      data: validated.data,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_KB_CATEGORY',
        entityType: 'KBCategory',
        entityId: category.id,
        details: JSON.stringify({ name: category.name }),
      },
    })

    revalidatePath('/admin/knowledge-base')
    revalidatePath('/coach/knowledge-base')
    revalidatePath('/ambassador/knowledge-base')

    return { success: true, categoryId: category.id }
  } catch (error) {
    console.error('Error creating KB category:', error)
    return { error: 'Failed to create category' }
  }
}

export async function updateKBCategory(categoryId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const rawData = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string || undefined,
    parentId: formData.get('parentId') as string || null,
    sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
    allowedRoles: JSON.parse(formData.get('allowedRoles') as string || '["ADMIN", "COACH", "AMBASSADOR"]'),
  }

  const validated = categorySchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    await prisma.kBCategory.update({
      where: { id: categoryId },
      data: validated.data,
    })

    revalidatePath('/admin/knowledge-base')
    revalidatePath('/coach/knowledge-base')
    revalidatePath('/ambassador/knowledge-base')

    return { success: true }
  } catch (error) {
    console.error('Error updating KB category:', error)
    return { error: 'Failed to update category' }
  }
}

export async function deleteKBCategory(categoryId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    // Check for articles in this category
    const articleCount = await prisma.kBArticle.count({
      where: { categoryId },
    })

    if (articleCount > 0) {
      return { error: 'Cannot delete category with articles. Move or delete articles first.' }
    }

    await prisma.kBCategory.delete({
      where: { id: categoryId },
    })

    revalidatePath('/admin/knowledge-base')

    return { success: true }
  } catch (error) {
    console.error('Error deleting KB category:', error)
    return { error: 'Failed to delete category' }
  }
}

// ============================================
// ARTICLES
// ============================================

const articleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  tags: z.array(z.string()).default([]),
  allowedRoles: z.array(z.string()).default(['ADMIN', 'COACH', 'AMBASSADOR']),
})

export async function getKBArticles(options?: {
  categoryId?: string
  status?: string
  role?: string
  search?: string
  limit?: number
}) {
  try {
    const where: Record<string, unknown> = {}

    if (options?.categoryId) {
      where.categoryId = options.categoryId
    }

    if (options?.status) {
      where.status = options.status
    } else if (options?.role !== 'ADMIN') {
      where.status = 'PUBLISHED'
    }

    if (options?.role && options.role !== 'ADMIN') {
      where.allowedRoles = { has: options.role }
    }

    if (options?.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { content: { contains: options.search, mode: 'insensitive' } },
        { tags: { has: options.search } },
      ]
    }

    const articles = await prisma.kBArticle.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: options?.limit,
    })

    return { articles }
  } catch (error) {
    console.error('Error getting KB articles:', error)
    return { error: 'Failed to get articles' }
  }
}

export async function getKBArticleBySlug(slug: string, role?: string) {
  try {
    const article = await prisma.kBArticle.findUnique({
      where: { slug },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    if (!article) {
      return { error: 'Article not found' }
    }

    // Check access
    if (role && role !== 'ADMIN' && !article.allowedRoles.includes(role)) {
      return { error: 'Access denied' }
    }

    if (role !== 'ADMIN' && article.status !== 'PUBLISHED') {
      return { error: 'Article not published' }
    }

    // Increment view count
    await prisma.kBArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    })

    return { article }
  } catch (error) {
    console.error('Error getting KB article:', error)
    return { error: 'Failed to get article' }
  }
}

export async function createKBArticle(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const rawData = {
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    content: formData.get('content') as string,
    excerpt: formData.get('excerpt') as string || undefined,
    categoryId: formData.get('categoryId') as string || null,
    status: (formData.get('status') as string) || 'DRAFT',
    tags: JSON.parse(formData.get('tags') as string || '[]'),
    allowedRoles: JSON.parse(formData.get('allowedRoles') as string || '["ADMIN", "COACH", "AMBASSADOR"]'),
  }

  const validated = articleSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const article = await prisma.kBArticle.create({
      data: {
        ...validated.data,
        authorId: session.user.id,
        publishedAt: validated.data.status === 'PUBLISHED' ? new Date() : null,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_KB_ARTICLE',
        entityType: 'KBArticle',
        entityId: article.id,
        details: JSON.stringify({ title: article.title }),
      },
    })

    revalidatePath('/admin/knowledge-base')
    revalidatePath('/coach/knowledge-base')
    revalidatePath('/ambassador/knowledge-base')

    return { success: true, articleId: article.id, slug: article.slug }
  } catch (error) {
    console.error('Error creating KB article:', error)
    return { error: 'Failed to create article' }
  }
}

export async function updateKBArticle(articleId: string, formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const rawData = {
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    content: formData.get('content') as string,
    excerpt: formData.get('excerpt') as string || undefined,
    categoryId: formData.get('categoryId') as string || null,
    status: (formData.get('status') as string) || 'DRAFT',
    tags: JSON.parse(formData.get('tags') as string || '[]'),
    allowedRoles: JSON.parse(formData.get('allowedRoles') as string || '["ADMIN", "COACH", "AMBASSADOR"]'),
  }

  const validated = articleSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Validation failed' }
  }

  try {
    const existing = await prisma.kBArticle.findUnique({
      where: { id: articleId },
    })

    const publishedAt =
      validated.data.status === 'PUBLISHED' && existing?.status !== 'PUBLISHED'
        ? new Date()
        : existing?.publishedAt

    await prisma.kBArticle.update({
      where: { id: articleId },
      data: {
        ...validated.data,
        publishedAt,
      },
    })

    revalidatePath('/admin/knowledge-base')
    revalidatePath('/coach/knowledge-base')
    revalidatePath('/ambassador/knowledge-base')

    return { success: true }
  } catch (error) {
    console.error('Error updating KB article:', error)
    return { error: 'Failed to update article' }
  }
}

export async function deleteKBArticle(articleId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.kBArticle.delete({
      where: { id: articleId },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_KB_ARTICLE',
        entityType: 'KBArticle',
        entityId: articleId,
      },
    })

    revalidatePath('/admin/knowledge-base')

    return { success: true }
  } catch (error) {
    console.error('Error deleting KB article:', error)
    return { error: 'Failed to delete article' }
  }
}

export async function publishKBArticle(articleId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.kBArticle.update({
      where: { id: articleId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    revalidatePath('/admin/knowledge-base')
    revalidatePath('/coach/knowledge-base')
    revalidatePath('/ambassador/knowledge-base')

    return { success: true }
  } catch (error) {
    console.error('Error publishing KB article:', error)
    return { error: 'Failed to publish article' }
  }
}

export async function archiveKBArticle(articleId: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    await prisma.kBArticle.update({
      where: { id: articleId },
      data: { status: 'ARCHIVED' },
    })

    revalidatePath('/admin/knowledge-base')
    revalidatePath('/coach/knowledge-base')
    revalidatePath('/ambassador/knowledge-base')

    return { success: true }
  } catch (error) {
    console.error('Error archiving KB article:', error)
    return { error: 'Failed to archive article' }
  }
}
