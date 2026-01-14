'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Building2,
  Copy,
  CheckCircle,
  AlertCircle,
  Mail,
} from 'lucide-react'

export function ManualPaymentClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [copied, setCopied] = useState<string | null>(null)

  const programFee = process.env.NEXT_PUBLIC_COACH_PROGRAM_FEE || '500'

  const bankDetails = {
    bankName: 'StageOneInAction Bank',
    accountName: 'StageOneInAction LLC',
    accountNumber: '1234567890',
    routingNumber: '987654321',
    reference: token?.slice(0, 12).toUpperCase() || 'COACH-PAYMENT',
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
  }

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Manual Payment Instructions
        </h1>
        <p className="text-gray-600">
          Please follow the instructions below to complete your payment.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* Amount */}
        <div className="bg-primary-50 rounded-lg p-4 mb-6">
          <div className="text-sm text-primary-700 mb-1">Amount Due</div>
          <div className="text-3xl font-bold text-primary-900">${programFee} USD</div>
        </div>

        {/* Bank Transfer Details */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Bank Transfer Details
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-xs text-gray-500">Bank Name</div>
                <div className="font-medium text-gray-900">{bankDetails.bankName}</div>
              </div>
              <button
                onClick={() => copyToClipboard(bankDetails.bankName, 'bank')}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                {copied === 'bank' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-xs text-gray-500">Account Name</div>
                <div className="font-medium text-gray-900">{bankDetails.accountName}</div>
              </div>
              <button
                onClick={() => copyToClipboard(bankDetails.accountName, 'name')}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                {copied === 'name' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-xs text-gray-500">Account Number</div>
                <div className="font-medium text-gray-900">{bankDetails.accountNumber}</div>
              </div>
              <button
                onClick={() => copyToClipboard(bankDetails.accountNumber, 'account')}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                {copied === 'account' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-xs text-gray-500">Routing Number</div>
                <div className="font-medium text-gray-900">{bankDetails.routingNumber}</div>
              </div>
              <button
                onClick={() => copyToClipboard(bankDetails.routingNumber, 'routing')}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                {copied === 'routing' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex justify-between items-center p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div>
                <div className="text-xs text-amber-700">Payment Reference (Required)</div>
                <div className="font-bold text-amber-900">{bankDetails.reference}</div>
              </div>
              <button
                onClick={() => copyToClipboard(bankDetails.reference, 'reference')}
                className="p-2 text-amber-600 hover:text-amber-800"
              >
                {copied === 'reference' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900 mb-1">Important</h3>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>Include the payment reference in your transfer</li>
                <li>Payment verification may take 1-3 business days</li>
                <li>You will receive an email once payment is confirmed</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="text-center pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">
            Need help or have questions?
          </p>
          <a
            href="mailto:support@stageoneinaction.com"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <Mail className="w-4 h-4" />
            support@stageoneinaction.com
          </a>
        </div>
      </div>
    </div>
  )
}
