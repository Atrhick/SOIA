import { getSitePage } from '@/lib/actions/site-pages'

export default async function TermsPage() {
  const result = await getSitePage('terms')

  const page = result.page

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {page?.title || 'Terms of Service'}
        </h1>
        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
          {page?.content || 'Terms of Service content is being prepared.'}
        </div>
      </div>
    </div>
  )
}
