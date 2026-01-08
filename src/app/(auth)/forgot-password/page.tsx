'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // TODO: Implement password reset logic
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsSubmitted(true)
    setIsLoading(false)
  }

  if (isSubmitted) {
    return (
      <div className="animate-scale-in">
        <div className="glass rounded-3xl shadow-2xl shadow-black/20 overflow-hidden">
          <div className="px-8 py-12 text-center">
            {/* Success icon */}
            <div className="animate-slide-up">
              <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 animate-slide-up animation-delay-100">
              Check Your Email
            </h1>
            <p className="mt-3 text-gray-600 animate-slide-up animation-delay-200 max-w-sm mx-auto">
              If an account exists with <span className="font-medium text-gray-900">{email}</span>, you will receive a password reset link.
            </p>

            <div className="mt-8 animate-slide-up animation-delay-300">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-300 hover:border-gray-300 hover:bg-gray-50 group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span>Return to Login</span>
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-white/60 animate-fade-in animation-delay-400">
          Didn&apos;t receive the email? Check your spam folder.
        </p>
      </div>
    )
  }

  return (
    <div className="animate-scale-in">
      {/* Card with glassmorphism */}
      <div className="glass rounded-3xl shadow-2xl shadow-black/20 overflow-hidden">
        {/* Header section */}
        <div className="relative px-8 pt-10 pb-8 text-center">
          {/* Icon */}
          <div className="animate-slide-up">
            <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 transform hover:scale-105 transition-transform duration-300">
              <Mail className="w-9 h-9 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 animate-slide-up animation-delay-100">
            Reset Password
          </h1>
          <p className="mt-2 text-gray-600 animate-slide-up animation-delay-200">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {/* Form section */}
        <div className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div className="animate-slide-up animation-delay-200 opacity-0" style={{ animationFillMode: 'forwards' }}>
              <label
                htmlFor="email"
                className={`block text-sm font-medium mb-2 transition-colors duration-200 ${
                  focusedField === 'email' ? 'text-primary-600' : 'text-gray-700'
                }`}
              >
                Email Address
              </label>
              <div className="relative group">
                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200 ${
                  focusedField === 'email' ? 'text-primary-500' : 'text-gray-400'
                }`}>
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="w-full h-12 pl-12 pr-4 rounded-xl border-2 border-gray-200 bg-white/50 text-gray-900 placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 hover:border-gray-300"
                />
                <div className={`absolute inset-0 rounded-xl bg-primary-500/5 opacity-0 transition-opacity duration-200 pointer-events-none ${
                  focusedField === 'email' ? 'opacity-100' : ''
                }`} />
              </div>
            </div>

            {/* Submit button */}
            <div className="animate-slide-up animation-delay-300 opacity-0 pt-2" style={{ animationFillMode: 'forwards' }}>
              <button
                type="submit"
                disabled={isLoading}
                className="relative w-full h-12 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 overflow-hidden group transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/40 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {/* Button shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-8 animate-slide-up animation-delay-400 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <div className="text-center">
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

      {/* Bottom text */}
      <p className="mt-8 text-center text-sm text-white/60 animate-fade-in animation-delay-500">
        Remember your password? Sign in instead.
      </p>
    </div>
  )
}
