'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Shield,
  AlertTriangle,
  CreditCard,
  Building2,
  Banknote,
  CheckCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { acceptTerms } from '@/lib/actions/prospects'

interface Prospect {
  id: string
  firstName: string
  lastName: string
  email: string
  status: string
  termsAcceptedAt: string | null
  payment: {
    status: string
    amount: number
    method: string
  } | null
}

interface Props {
  prospect: Prospect
  token: string
}

type PaymentMethod = 'stripe' | 'paypal' | 'manual'

export function AcceptanceClient({ prospect, token }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<'terms' | 'payment'>(prospect.termsAcceptedAt ? 'payment' : 'terms')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Terms state
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [nonRefundAcknowledged, setNonRefundAcknowledged] = useState(false)

  // Payment state
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null)

  const programFee = process.env.NEXT_PUBLIC_COACH_PROGRAM_FEE || '500'

  const handleAcceptTerms = async () => {
    if (!termsAccepted || !privacyAccepted || !nonRefundAcknowledged) {
      setError('Please accept all terms and conditions')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const result = await acceptTerms(token, {
        termsAccepted,
        privacyAccepted,
        nonRefundAcknowledged,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setStep('payment')
      }
    } catch {
      setError('Failed to process. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePayment = async () => {
    if (!selectedPayment) {
      setError('Please select a payment method')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      if (selectedPayment === 'stripe') {
        // Redirect to Stripe checkout
        router.push(`/api/payment/stripe/checkout?token=${token}`)
      } else if (selectedPayment === 'paypal') {
        // Redirect to PayPal
        router.push(`/api/payment/paypal/checkout?token=${token}`)
      } else if (selectedPayment === 'manual') {
        // Show manual payment instructions
        router.push(`/payment/manual?token=${token}`)
      }
    } catch {
      setError('Failed to process payment. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to the Coach Program
        </h1>
        <p className="text-gray-600">
          Congratulations, {prospect.firstName}! You&apos;ve been approved to join our coaching program.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            step === 'terms' ? 'bg-primary-600 text-white' : 'bg-green-500 text-white'
          }`}>
            {step === 'payment' ? <CheckCircle className="w-5 h-5" /> : '1'}
          </div>
          <span className="ml-2 text-sm font-medium text-gray-700">Accept Terms</span>
        </div>
        <div className="w-16 h-px bg-gray-300 mx-4" />
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            step === 'payment' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            2
          </div>
          <span className="ml-2 text-sm font-medium text-gray-700">Payment</span>
        </div>
      </div>

      {/* Terms Step */}
      {step === 'terms' && (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Terms & Conditions
          </h2>

          {/* Acceptance Letter */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6 prose prose-sm max-w-none">
            <p className="text-gray-700">
              Dear {prospect.firstName},
            </p>
            <p className="text-gray-700">
              We are pleased to welcome you to the StageOneInAction Coaching Program.
              As a member of our community, you will have access to comprehensive training,
              resources, and support to build your coaching practice.
            </p>
            <p className="text-gray-700">
              The program fee is <strong>${programFee} USD</strong> and includes:
            </p>
            <ul className="text-gray-700">
              <li>Complete coaching certification program</li>
              <li>Personal development workbook</li>
              <li>Access to our coaching platform</li>
              <li>Ongoing mentorship and support</li>
              <li>Marketing and business development resources</li>
            </ul>
            <p className="text-gray-700">
              Please review and accept the following terms to proceed.
            </p>
          </div>

          {/* Terms Checkboxes */}
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-900">Terms of Service</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  I have read and agree to the{' '}
                  <a href="/terms" target="_blank" className="text-primary-600 hover:underline">
                    Terms of Service
                  </a>
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-900">Privacy Policy</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  I have read and agree to the{' '}
                  <a href="/privacy" target="_blank" className="text-primary-600 hover:underline">
                    Privacy Policy
                  </a>
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={nonRefundAcknowledged}
                onChange={(e) => setNonRefundAcknowledged(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="font-medium text-gray-900">Non-Refundable Policy</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  I understand that the program fee is <strong>non-refundable</strong> once payment is made.
                </p>
              </div>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Continue Button */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleAcceptTerms}
              disabled={isSubmitting || !termsAccepted || !privacyAccepted || !nonRefundAcknowledged}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue to Payment
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Payment Step */}
      {step === 'payment' && (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Complete Payment
          </h2>
          <p className="text-gray-600 mb-6">
            Program Fee: <span className="font-bold text-2xl text-gray-900">${programFee}</span> USD
          </p>

          {/* Payment Methods */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => setSelectedPayment('stripe')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedPayment === 'stripe'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  selectedPayment === 'stripe' ? 'bg-primary-100' : 'bg-gray-100'
                }`}>
                  <CreditCard className={`w-6 h-6 ${
                    selectedPayment === 'stripe' ? 'text-primary-600' : 'text-gray-500'
                  }`} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Credit/Debit Card</div>
                  <div className="text-sm text-gray-500">Pay securely with Stripe</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPayment('paypal')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedPayment === 'paypal'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  selectedPayment === 'paypal' ? 'bg-primary-100' : 'bg-gray-100'
                }`}>
                  <Building2 className={`w-6 h-6 ${
                    selectedPayment === 'paypal' ? 'text-primary-600' : 'text-gray-500'
                  }`} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">PayPal</div>
                  <div className="text-sm text-gray-500">Pay with your PayPal account</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPayment('manual')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedPayment === 'manual'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  selectedPayment === 'manual' ? 'bg-primary-100' : 'bg-gray-100'
                }`}>
                  <Banknote className={`w-6 h-6 ${
                    selectedPayment === 'manual' ? 'text-primary-600' : 'text-gray-500'
                  }`} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Manual Payment</div>
                  <div className="text-sm text-gray-500">Bank transfer, check, or other</div>
                </div>
              </div>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Pay Button */}
          <button
            onClick={handlePayment}
            disabled={isSubmitting || !selectedPayment}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {selectedPayment === 'manual' ? 'View Payment Instructions' : `Pay $${programFee}`}
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>

          {/* Security Note */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Your payment information is encrypted and secure.
          </p>
        </div>
      )}
    </div>
  )
}
