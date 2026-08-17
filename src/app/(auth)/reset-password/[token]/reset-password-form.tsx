'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { confirmPasswordReset } from '@/lib/actions/password-reset'

interface Props {
  token: string
  email: string
}

export function ResetPasswordForm({ token, email }: Props) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordsMatch = confirmPassword === '' || password === confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    setError(null)

    const result = await confirmPasswordReset(token, password)

    if ('error' in result) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    setIsSuccess(true)
    setIsLoading(false)

    // Redirect to login after 2 seconds
    setTimeout(() => router.push('/login'), 2000)
  }

  if (isSuccess) {
    return (
      <div className="animate-scale-in">
        <div className="glass rounded-3xl shadow-2xl shadow-black/20 overflow-hidden">
          <div className="px-8 py-12 text-center">
            <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Password Updated</h1>
            <p className="mt-3 text-gray-600">
              Your password has been changed successfully. Redirecting you to login...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-scale-in">
      <div className="glass rounded-3xl shadow-2xl shadow-black/20 overflow-hidden">
        {/* Header */}
        <div className="relative px-8 pt-10 pb-8 text-center">
          <div className="animate-slide-up">
            <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Lock className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 animate-slide-up animation-delay-100">
            Choose New Password
          </h1>
          <p className="mt-2 text-gray-500 text-sm animate-slide-up animation-delay-200">
            {email}
          </p>
        </div>

        {/* Form */}
        <div className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* New Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 8 chars, upper, lower, number"
                  className="w-full h-12 pl-12 pr-12 rounded-xl border-2 border-gray-200 bg-white/50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat your new password"
                  className={`w-full h-12 pl-12 pr-4 rounded-xl border-2 bg-white/50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 transition-colors ${
                    !passwordsMatch
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                      : 'border-gray-200 focus:border-primary-500 focus:ring-primary-500/10'
                  }`}
                />
              </div>
              {!passwordsMatch && (
                <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || !password || !confirmPassword || !passwordsMatch}
                className="relative w-full h-12 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 overflow-hidden group transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/40 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Updating...</span>
                    </>
                  ) : (
                    'Set New Password'
                  )}
                </span>
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
