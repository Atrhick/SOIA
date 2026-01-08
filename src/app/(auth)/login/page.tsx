'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="animate-scale-in">
      {/* Card with glassmorphism */}
      <div className="glass rounded-3xl shadow-2xl shadow-black/20 overflow-hidden">
        {/* Header section */}
        <div className="relative px-8 pt-10 pb-8 text-center">
          {/* Animated logo */}
          <div className="animate-slide-up">
            <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 transform hover:scale-105 transition-transform duration-300">
              <span className="text-3xl font-bold text-white">S1</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 animate-slide-up animation-delay-100">
            Welcome Back
          </h1>
          <p className="mt-2 text-gray-600 animate-slide-up animation-delay-200">
            Sign in to your StageOneInAction account
          </p>
        </div>

        {/* Form section */}
        <div className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl animate-slide-up flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                {error}
              </div>
            )}

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

            {/* Password field */}
            <div className="animate-slide-up animation-delay-300 opacity-0" style={{ animationFillMode: 'forwards' }}>
              <label
                htmlFor="password"
                className={`block text-sm font-medium mb-2 transition-colors duration-200 ${
                  focusedField === 'password' ? 'text-primary-600' : 'text-gray-700'
                }`}
              >
                Password
              </label>
              <div className="relative group">
                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-200 ${
                  focusedField === 'password' ? 'text-primary-500' : 'text-gray-400'
                }`}>
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
                  className="w-full h-12 pl-12 pr-12 rounded-xl border-2 border-gray-200 bg-white/50 text-gray-900 placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 hover:border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <div className={`absolute inset-0 rounded-xl bg-primary-500/5 opacity-0 transition-opacity duration-200 pointer-events-none ${
                  focusedField === 'password' ? 'opacity-100' : ''
                }`} />
              </div>
            </div>

            {/* Submit button */}
            <div className="animate-slide-up animation-delay-400 opacity-0 pt-2" style={{ animationFillMode: 'forwards' }}>
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
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-8 animate-slide-up animation-delay-500 opacity-0" style={{ animationFillMode: 'forwards' }}>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white/70 text-gray-500">Need help?</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <Link
                href="/forgot-password"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors group"
              >
                <span>Forgot your password?</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/ambassador-login"
                className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors group"
              >
                <span>Ambassador Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom text */}
      <p className="mt-8 text-center text-sm text-white/60 animate-fade-in animation-delay-500">
        Empowering coaches to transform lives
      </p>
    </div>
  )
}
