import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getKBCategories, getKBArticles } from '@/lib/actions/knowledge-base'
import { KnowledgeBaseAdminClient } from './knowledge-base-admin-client'

export default async function AdminKnowledgeBasePage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const [categoriesResult, articlesResult] = await Promise.all([
    getKBCategories(),
    getKBArticles({ role: 'ADMIN' }),
  ])

  const categories = categoriesResult.categories?.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    sortOrder: cat.sortOrder,
    parentId: cat.parentId,
    allowedRoles: cat.allowedRoles,
    articleCount: cat._count.articles,
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
  })) || []

  const articles = articlesResult.articles?.map((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    status: article.status,
    viewCount: article.viewCount,
    tags: article.tags,
    allowedRoles: article.allowedRoles,
    category: article.category,
    publishedAt: article.publishedAt?.toISOString() || null,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  })) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-gray-600">
          Manage articles and documentation for coaches and ambassadors
        </p>
      </div>

      <KnowledgeBaseAdminClient
        categories={categories}
        articles={articles}
      />
    </div>
  )
}
