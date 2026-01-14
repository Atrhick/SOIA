import { Suspense } from 'react'
import { PaymentCancelClient } from './cancel-client'

function LoadingFallback() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8 text-center animate-pulse">
        <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-6" />
        <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-4" />
        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto" />
      </div>
    </div>
  )
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentCancelClient />
    </Suspense>
  )
}
