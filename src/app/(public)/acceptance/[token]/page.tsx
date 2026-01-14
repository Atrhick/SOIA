import { notFound } from 'next/navigation'
import { getProspectByToken } from '@/lib/actions/prospects'
import { AcceptanceClient } from './acceptance-client'

export default async function AcceptancePage({
  params,
}: {
  params: { token: string }
}) {
  const result = await getProspectByToken(params.token, 'acceptance')

  if (result.error || !result.prospect) {
    notFound()
  }

  // Check if already completed payment
  if (result.prospect.status === 'PAYMENT_COMPLETED' || result.prospect.status === 'ACCOUNT_CREATED') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Already Completed
          </h1>
          <p className="text-gray-600">
            Your payment has already been processed. If you have questions, please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  return <AcceptanceClient prospect={result.prospect} token={params.token} />
}
