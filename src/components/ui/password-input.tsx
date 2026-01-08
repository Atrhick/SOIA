'use client'

import * as React from 'react'
import { Eye, EyeOff, RefreshCw, Copy, Check, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'At least one uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'At least one lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'At least one number', test: (p) => /\d/.test(p) },
  { label: 'At least one special character (!@#$%^&*)', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

function calculateStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0

  // Length scoring
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1

  // Character variety scoring
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1

  // Bonus for mixing
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) score += 1

  // Normalize to 0-4
  const normalizedScore = Math.min(Math.floor(score / 2), 4)

  const strengthLevels = [
    { label: '', color: '' },
    { label: 'Weak', color: 'bg-red-500' },
    { label: 'Fair', color: 'bg-orange-500' },
    { label: 'Good', color: 'bg-yellow-500' },
    { label: 'Strong', color: 'bg-green-500' },
  ]

  return { score: normalizedScore, ...strengthLevels[normalizedScore] }
}

function generateSecurePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*'
  const allChars = lowercase + uppercase + numbers + symbols

  let password = ''

  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

interface PasswordInputProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  showGenerator?: boolean
  showRequirements?: boolean
  showStrengthMeter?: boolean
  minLength?: number
}

export function PasswordInput({
  value = '',
  onChange,
  placeholder = 'Enter password',
  disabled,
  className,
  id,
  name,
  showGenerator = true,
  showRequirements = true,
  showStrengthMeter = true,
  minLength = 8,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [showHelp, setShowHelp] = React.useState(false)

  const strength = calculateStrength(value)
  const meetsRequirements = passwordRequirements.map((req) => ({
    ...req,
    met: req.test(value),
  }))

  const handleGenerate = () => {
    const newPassword = generateSecurePassword()
    onChange?.(newPassword)
    setShowPassword(true)
  }

  const handleCopy = async () => {
    if (value) {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          minLength={minLength}
          className={cn(
            'w-full px-3 py-2 pr-24 border rounded-md',
            'border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'placeholder:text-gray-400',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-50'
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {showGenerator && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={disabled}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Generate secure password"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Copy password"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Strength Meter */}
      {showStrengthMeter && value && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  level <= strength.score ? strength.color : 'bg-gray-200'
                )}
              />
            ))}
          </div>
          {strength.label && (
            <p
              className={cn(
                'text-xs font-medium',
                strength.score === 1 && 'text-red-600',
                strength.score === 2 && 'text-orange-600',
                strength.score === 3 && 'text-yellow-600',
                strength.score === 4 && 'text-green-600'
              )}
            >
              Password strength: {strength.label}
            </p>
          )}
        </div>
      )}

      {/* Requirements Help */}
      {showRequirements && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <Info className="h-3.5 w-3.5" />
            <span>Password requirements</span>
          </button>

          {showHelp && (
            <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-2">
                A secure password should have:
              </p>
              <ul className="space-y-1">
                {meetsRequirements.map((req, index) => (
                  <li
                    key={index}
                    className={cn(
                      'flex items-center gap-2 text-xs',
                      req.met ? 'text-green-600' : 'text-gray-500'
                    )}
                  >
                    {req.met ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-current" />
                    )}
                    {req.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
