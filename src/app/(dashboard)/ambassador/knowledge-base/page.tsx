import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getKBCategories, getKBArticles } from '@/lib/actions/knowledge-base'
import { isFeatureEnabled } from '@/lib/actions/feature-config'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { BookOpen, FolderOpen, Search, ArrowRight, Eye } from 'lucide-react'

export default async function AmbassadorKnowledgeBasePage() {
  const session = await auth()

  if (!session || session.user.role !== 'AMBASSADOR') {
    redirect('/login')
  }

  // Check if feature is enabled
  const featureEnabled = await isFeatureEnabled('KNOWLEDGE_BASE', 'AMBASSADOR', session.user.id)
  if (!featureEnabled) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Knowledge Base</h2>
          <p className="text-gray-500 mt-2">This feature is not currently enabled.</p>
        </div>
      </div>
    )
  }

  const [categoriesResult, articlesResult] = await Promise.all([
    getKBCategories('AMBASSADOR'),
    getKBArticles({ role: 'AMBASSADOR', status: 'PUBLISHED', limit: 10 }),
  ])

  const categories = categoriesResult.categories || []
  const recentArticles = articlesResult.articles || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-gray-600">
          Browse articles and resources to help you grow
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search articles..."
              className="pl-10 h-12"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Categories */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No categories available
                </p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/ambassador/knowledge-base/category/${category.slug}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium">{category.name}</span>
                      <Badge variant="secondary">{category._count.articles}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Articles */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Recent Articles
              </CardTitle>
              <CardDescription>
                Latest published articles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentArticles.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No articles available yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentArticles.map((article) => (
                    <Link
                      key={article.id}
                      href={`/ambassador/knowledge-base/${article.slug}`}
                      className="block p-4 rounded-lg border hover:border-primary hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {article.title}
                          </h3>
                          {article.excerpt && (
                            <p className="text-sm text-gray-500 line-clamp-2">
                              {article.excerpt}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            {article.category && (
                              <span className="flex items-center gap-1">
                                <FolderOpen className="h-3 w-3" />
                                {article.category.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {article.viewCount} views
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
