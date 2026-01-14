'use client'

import { useSearchParams } from 'next/navigation'
import { CheckCircle, Mail, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Payment Successful!
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          Thank you for joining the StageOneInAction Coach Program. Your payment has been processed successfully.
        </p>

        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">What happens next?</h2>
          <ul className="text-left space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary-600">1</span>
              </div>
              <span className="text-gray-700">
                You will receive a confirmation email with your receipt
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary-600">2</span>
              </div>
              <span className="text-gray-700">
                Our team will create your coach account within 24 hours
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary-600">3</span>
              </div>
              <span className="text-gray-700">
                You will receive login credentials via email to access the platform
              </span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary-600">4</span>
              </div>
              <span className="text-gray-700">
                Complete your onboarding journey to become an active coach
              </span>
            </li>
          </ul>
        </div>

        {email && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
            <Mail className="w-4 h-4" />
            Confirmation sent to: <span className="font-medium">{email}</span>
          </div>
        )}

        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Go to Login
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  )
}
