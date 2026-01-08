import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getKBCategories } from '@/lib/actions/knowledge-base'
import { ArticleEditor } from '../article-editor'

export default async function NewArticlePage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const categoriesResult = await getKBCategories()
  const categories = categoriesResult.categories?.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
  })) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Article</h1>
        <p className="text-gray-600">
          Create a new knowledge base article
        </p>
      </div>

      <ArticleEditor categories={categories} />
    </div>
  )
}
