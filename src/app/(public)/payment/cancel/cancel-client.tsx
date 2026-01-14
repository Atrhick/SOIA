'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { XCircle, ArrowLeft, Mail } from 'lucide-react'

export function PaymentCancelClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-12 h-12 text-red-600" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Payment Cancelled
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          Your payment was not completed. No charges have been made to your account.
        </p>

        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <p className="text-gray-700 mb-4">
            If you experienced any issues during checkout, please try again or contact our support team.
          </p>
          <a
            href="mailto:support@stageoneinaction.com"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <Mail className="w-4 h-4" />
            support@stageoneinaction.com
          </a>
        </div>

        {token && (
          <button
            onClick={() => router.push(`/acceptance/${token}`)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Return to Payment
          </button>
        )}
      </div>
    </div>
  )
}
