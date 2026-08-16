import { validateResetToken } from '@/lib/actions/password-reset'
import { ResetPasswordForm } from './reset-password-form'
import Link from 'next/link'
import { XCircle } from 'lucide-react'

interface Props {
  params: { token: string }
}

export default async function ResetPasswordPage({ params }: Props) {
  const result = await validateResetToken(params.token)

  if (!result.valid) {
    return (
      <div className="animate-scale-in">
        <div className="glass rounded-3xl shadow-2xl shadow-black/20 overflow-hidden">
          <div className="px-8 py-12 text-center">
            <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30">
              <XCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Link Expired</h1>
            <p className="mt-3 text-gray-600 max-w-sm mx-auto">
              This password reset link is invalid or has already expired.
            </p>
            <div className="mt-8">
              <Link
                href="/forgot-password"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl transition-all duration-300 hover:bg-primary-700"
              >
                Request a new link
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <ResetPasswordForm token={params.token} email={result.email} />
}
