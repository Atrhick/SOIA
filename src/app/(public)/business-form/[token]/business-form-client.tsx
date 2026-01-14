'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  User,
  Eye,
  Target,
  Briefcase,
  DollarSign,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { submitBusinessForm } from '@/lib/actions/prospects'

interface Prospect {
  id: string
  firstName: string
  lastName: string
  email: string
  status: string
}

interface Props {
  prospect: Prospect
  token: string
}

const SERVICES = [
  { id: 'coaching', label: 'Life Coaching' },
  { id: 'mentoring', label: 'Mentoring Services' },
  { id: 'training', label: 'Training & Workshops' },
  { id: 'consulting', label: 'Business Consulting' },
  { id: 'speaking', label: 'Public Speaking' },
  { id: 'writing', label: 'Writing & Content' },
]

export function BusinessFormClient({ prospect, token }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)

  const [formData, setFormData] = useState({
    companyName: '',
    bio: '',
    visionStatement: '',
    missionStatement: '',
    servicesInterested: [] as string[],
    proposedCostOfServices: '',
  })
  const [otherService, setOtherService] = useState('')
  const [showOtherInput, setShowOtherInput] = useState(false)

  const handleChange = (field: keyof typeof formData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleService = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      servicesInterested: prev.servicesInterested.includes(serviceId)
        ? prev.servicesInterested.filter(id => id !== serviceId)
        : [...prev.servicesInterested, serviceId],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Include custom "Other" service if provided
      const services = [...formData.servicesInterested]
      if (showOtherInput && otherService.trim()) {
        services.push(`Other: ${otherService.trim()}`)
      }

      const result = await submitBusinessForm(token, {
        ...formData,
        servicesInterested: services,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setIsComplete(true)
      }
    } catch {
      setError('Failed to submit form. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Form Submitted Successfully!
          </h1>
          <p className="text-gray-600 mb-6">
            Thank you for completing your business development form. Our team will review your submission and schedule an interview with you soon.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Business Development Form
        </h1>
        <p className="text-gray-600">
          Welcome, {prospect.firstName}! Please complete this form to help us understand your business goals and vision.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          {/* Company Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Building2 className="w-4 h-4" />
              Company/Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Your company or business name"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4" />
              Professional Bio <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              minLength={10}
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[120px]"
              placeholder="Tell us about yourself and your professional background..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum 10 characters. This will be used for your coach profile.
            </p>
          </div>

          {/* Vision Statement */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Eye className="w-4 h-4" />
              Vision Statement <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              minLength={10}
              value={formData.visionStatement}
              onChange={(e) => handleChange('visionStatement', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[100px]"
              placeholder="What is your long-term vision? Where do you see yourself and your coaching practice in 5-10 years?"
            />
          </div>

          {/* Mission Statement */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Target className="w-4 h-4" />
              Mission Statement <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              minLength={10}
              value={formData.missionStatement}
              onChange={(e) => handleChange('missionStatement', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[100px]"
              placeholder="What is your mission? How will you serve your clients and make an impact?"
            />
          </div>

          {/* Services Interested */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Briefcase className="w-4 h-4" />
              Services You Plan to Offer <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SERVICES.map(service => {
                const isSelected = formData.servicesInterested.includes(service.id)
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className={`text-sm ${isSelected ? 'text-primary-700' : 'text-gray-700'}`}>
                        {service.label}
                      </span>
                    </div>
                  </button>
                )
              })}
              {/* Other Option */}
              <button
                type="button"
                onClick={() => setShowOtherInput(!showOtherInput)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  showOtherInput
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    showOtherInput ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                  }`}>
                    {showOtherInput && (
                      <CheckCircle className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className={`text-sm ${showOtherInput ? 'text-primary-700' : 'text-gray-700'}`}>
                    Other
                  </span>
                </div>
              </button>
            </div>
            {/* Other Service Input */}
            {showOtherInput && (
              <div className="mt-3">
                <input
                  type="text"
                  value={otherService}
                  onChange={(e) => setOtherService(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Please describe your service..."
                />
              </div>
            )}
            {formData.servicesInterested.length === 0 && !showOtherInput && (
              <p className="text-xs text-gray-500 mt-2">
                Select at least one service
              </p>
            )}
          </div>

          {/* Proposed Cost */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4" />
              Proposed Pricing Structure <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={formData.proposedCostOfServices}
              onChange={(e) => handleChange('proposedCostOfServices', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[100px]"
              placeholder="Describe your proposed pricing structure for your services (e.g., hourly rates, package pricing, subscription models, etc.)"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={isSubmitting || (formData.servicesInterested.length === 0 && !(showOtherInput && otherService.trim()))}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Submit Form
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
