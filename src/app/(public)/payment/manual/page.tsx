import { Suspense } from 'react'
import { ManualPaymentClient } from './manual-client'

function LoadingFallback() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
      </div>
      <div className="bg-white rounded-xl shadow-lg p-8 animate-pulse">
        <div className="h-24 bg-gray-200 rounded mb-6" />
        <div className="space-y-4">
          <div className="h-16 bg-gray-200 rounded" />
          <div className="h-16 bg-gray-200 rounded" />
          <div className="h-16 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}

export default function ManualPaymentPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ManualPaymentClient />
    </Suspense>
  )
}
