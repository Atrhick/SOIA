import { notFound } from 'next/navigation'
import { getProspectByToken } from '@/lib/actions/prospects'
import { BusinessFormClient } from './business-form-client'

export default async function BusinessFormPage({
  params,
}: {
  params: { token: string }
}) {
  const result = await getProspectByToken(params.token, 'business')

  if (result.error || !result.prospect) {
    notFound()
  }

  // Check if form was already submitted
  if (result.prospect.status !== 'BUSINESS_FORM_PENDING') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Form Already Submitted
          </h1>
          <p className="text-gray-600">
            This business development form has already been submitted. If you need to make changes, please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  return <BusinessFormClient prospect={result.prospect} token={params.token} />
}
