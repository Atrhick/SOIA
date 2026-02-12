'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  User,
  Eye,
  Target,
  Globe,
  Package,
  Users,
  TrendingUp,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Save,
  Plus,
  Trash2,
  Instagram,
  Facebook,
  Linkedin,
} from 'lucide-react'
import { saveBusinessFormDraft, submitBusinessForm } from '@/lib/actions/prospects'

interface Prospect {
  firstName: string
  lastName: string
  email: string
}

interface ServicePackage {
  id: string
  name: string
  description: string
  price: string
  duration?: string
}

interface FormData {
  currentStep: number
  // Step 1: Business Identity
  companyName: string
  tagline: string
  bio: string
  businessType: string
  businessTypeOther: string
  // Step 2: Online Presence
  websiteUrl: string
  needsWebsiteHelp: boolean
  instagramHandle: string
  facebookHandle: string
  linkedinHandle: string
  tiktokHandle: string
  // Step 3: Services & Packages
  servicePackages: ServicePackage[]
  // Step 4: Target Audience
  idealClient: string
  uniqueValue: string
  certifications: string
  // Step 5: Goals
  threeYearRevenueGoal: string
  threeYearClientGoal: string
  visionStatement: string
  missionStatement: string
}

interface Props {
  prospect: Prospect
  token: string
  initialDraft: FormData
  lastSavedAt: string | null
}

const BUSINESS_TYPES = [
  'Life Coaching',
  'Business Coaching',
  'Executive Coaching',
  'Health & Wellness Coaching',
  'Career Coaching',
  'Relationship Coaching',
  'Financial Coaching',
  'Consulting',
  'Training & Workshops',
  'Speaking & Keynotes',
  'Other',
]

const STEPS = [
  { id: 1, title: 'Business Identity', icon: Building2 },
  { id: 2, title: 'Online Presence', icon: Globe },
  { id: 3, title: 'Services & Packages', icon: Package },
  { id: 4, title: 'Target Audience', icon: Users },
  { id: 5, title: 'Goals', icon: TrendingUp },
]

export function BusinessFormClient({ prospect, token, initialDraft, lastSavedAt: initialLastSaved }: Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(initialDraft.currentStep || 0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialLastSaved)
  const [isDirty, setIsDirty] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    ...initialDraft,
    servicePackages: initialDraft.servicePackages?.length > 0
      ? initialDraft.servicePackages
      : [{ id: crypto.randomUUID(), name: '', description: '', price: '', duration: '' }],
  })

  // Auto-save debounce
  useEffect(() => {
    if (!isDirty) return

    const timer = setTimeout(async () => {
      await saveDraft()
    }, 3000) // 3 second debounce

    return () => clearTimeout(timer)
  }, [formData, isDirty])

  const saveDraft = useCallback(async () => {
    setIsSaving(true)
    try {
      const result = await saveBusinessFormDraft(token, {
        ...formData,
        currentStep,
      })
      if (result.success) {
        setLastSavedAt(result.lastSavedAt || new Date().toISOString())
        setIsDirty(false)
      }
    } catch {
      console.error('Failed to save draft')
    } finally {
      setIsSaving(false)
    }
  }, [formData, currentStep, token])

  const handleChange = (field: keyof FormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const updateServicePackage = (id: string, field: keyof ServicePackage, value: string) => {
    setFormData(prev => ({
      ...prev,
      servicePackages: prev.servicePackages.map(pkg =>
        pkg.id === id ? { ...pkg, [field]: value } : pkg
      ),
    }))
    setIsDirty(true)
  }

  const addServicePackage = () => {
    setFormData(prev => ({
      ...prev,
      servicePackages: [
        ...prev.servicePackages,
        { id: crypto.randomUUID(), name: '', description: '', price: '', duration: '' },
      ],
    }))
    setIsDirty(true)
  }

  const removeServicePackage = (id: string) => {
    if (formData.servicePackages.length <= 1) return
    setFormData(prev => ({
      ...prev,
      servicePackages: prev.servicePackages.filter(pkg => pkg.id !== id),
    }))
    setIsDirty(true)
  }

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 0: // Business Identity
        if (!formData.companyName.trim()) return 'Company name is required'
        if (!formData.bio.trim() || formData.bio.length < 10) return 'Bio must be at least 10 characters'
        if (!formData.businessType) return 'Please select a business type'
        if (formData.businessType === 'Other' && !formData.businessTypeOther.trim()) return 'Please specify your business type'
        return null
      case 1: // Online Presence - mostly optional
        if (formData.websiteUrl && !isValidUrl(formData.websiteUrl)) return 'Please enter a valid website URL'
        return null
      case 2: // Services & Packages
        const validPackages = formData.servicePackages.filter(pkg => pkg.name.trim() && pkg.price.trim())
        if (validPackages.length === 0) return 'Add at least one service package with name and price'
        return null
      case 3: // Target Audience
        if (!formData.idealClient.trim() || formData.idealClient.length < 10)
          return 'Please describe your ideal client (at least 10 characters)'
        if (!formData.uniqueValue.trim() || formData.uniqueValue.length < 10)
          return 'Please describe what makes you unique (at least 10 characters)'
        return null
      case 4: // Goals
        if (!formData.threeYearRevenueGoal.trim()) return 'Revenue goal is required'
        if (!formData.threeYearClientGoal.trim()) return 'Client goal is required'
        if (!formData.visionStatement.trim() || formData.visionStatement.length < 10)
          return 'Vision statement must be at least 10 characters'
        if (!formData.missionStatement.trim() || formData.missionStatement.length < 10)
          return 'Mission statement must be at least 10 characters'
        return null
      default:
        return null
    }
  }

  const isValidUrl = (url: string) => {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`)
      return true
    } catch {
      return false
    }
  }

  const handleNext = async () => {
    const validationError = validateStep(currentStep)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
      setFormData(prev => ({ ...prev, currentStep: currentStep + 1 }))
      await saveDraft()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      setFormData(prev => ({ ...prev, currentStep: currentStep - 1 }))
      setError(null)
    }
  }

  const handleSaveAndExit = async () => {
    setIsSaving(true)
    try {
      const result = await saveBusinessFormDraft(token, {
        ...formData,
        currentStep,
      })
      if (result.success) {
        setLastSavedAt(result.lastSavedAt || new Date().toISOString())
        setIsDirty(false)
        setShowExitDialog(true)
      } else {
        setError('Failed to save. Please try again.')
      }
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    const validationError = validateStep(currentStep)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setIsSubmitting(true)

    try {
      // Filter out empty service packages
      const validPackages = formData.servicePackages.filter(pkg => pkg.name.trim() && pkg.price.trim())

      const result = await submitBusinessForm(token, {
        companyName: formData.companyName,
        tagline: formData.tagline || undefined,
        bio: formData.bio,
        businessType: formData.businessType,
        businessTypeOther: formData.businessType === 'Other' ? formData.businessTypeOther : undefined,
        websiteUrl: formData.websiteUrl || undefined,
        needsWebsiteHelp: formData.needsWebsiteHelp || undefined,
        instagramHandle: formData.instagramHandle || undefined,
        facebookHandle: formData.facebookHandle || undefined,
        linkedinHandle: formData.linkedinHandle || undefined,
        tiktokHandle: formData.tiktokHandle || undefined,
        servicePackages: validPackages,
        idealClient: formData.idealClient,
        uniqueValue: formData.uniqueValue,
        certifications: formData.certifications || undefined,
        threeYearRevenueGoal: formData.threeYearRevenueGoal,
        threeYearClientGoal: formData.threeYearClientGoal,
        visionStatement: formData.visionStatement,
        missionStatement: formData.missionStatement,
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

  const formatLastSaved = () => {
    if (!lastSavedAt) return null
    const date = new Date(lastSavedAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins === 1) return '1 minute ago'
    if (diffMins < 60) return `${diffMins} minutes ago`
    return date.toLocaleTimeString()
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

  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Business Development Form
        </h1>
        <p className="text-gray-600">
          Welcome, {prospect.firstName}! Complete this form to help us understand your business goals.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-700">
            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
          </span>
          <span className="text-sm text-gray-500">{Math.round(progress)}% complete</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between mt-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep
            return (
              <div
                key={step.id}
                className={`flex flex-col items-center ${
                  isActive ? 'text-primary-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
                    isActive
                      ? 'bg-primary-100 border-2 border-primary-600'
                      : isCompleted
                        ? 'bg-green-100'
                        : 'bg-gray-100'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className="text-xs hidden sm:block">{step.title}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* Step 1: Business Identity */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4" />
                Company/Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Your company or business name"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                Tagline (Optional)
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => handleChange('tagline', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="A short, memorable description of your business"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4" />
                Professional Bio <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[120px]"
                placeholder="Tell us about yourself and your professional background..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum 10 characters. This will be used for your coach profile.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                Business Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.businessType}
                onChange={(e) => {
                  handleChange('businessType', e.target.value)
                  if (e.target.value !== 'Other') {
                    handleChange('businessTypeOther', '')
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select your primary business type</option>
                {BUSINESS_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {formData.businessType === 'Other' && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  Please specify your business type <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.businessTypeOther}
                  onChange={(e) => handleChange('businessTypeOther', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter your business type"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Online Presence */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Globe className="w-4 h-4" />
                Website URL
              </label>
              <input
                type="text"
                value={formData.websiteUrl}
                onChange={(e) => handleChange('websiteUrl', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="https://yourwebsite.com"
              />
            </div>

            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.needsWebsiteHelp}
                  onChange={(e) => handleChange('needsWebsiteHelp', e.target.checked)}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  I need help creating or improving my website
                </span>
              </label>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Social Media Handles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Instagram className="w-4 h-4" />
                    Instagram
                  </label>
                  <input
                    type="text"
                    value={formData.instagramHandle}
                    onChange={(e) => handleChange('instagramHandle', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="@username"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Facebook className="w-4 h-4" />
                    Facebook
                  </label>
                  <input
                    type="text"
                    value={formData.facebookHandle}
                    onChange={(e) => handleChange('facebookHandle', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="@username or page URL"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                  </label>
                  <input
                    type="text"
                    value={formData.linkedinHandle}
                    onChange={(e) => handleChange('linkedinHandle', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Profile URL or username"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                    TikTok
                  </label>
                  <input
                    type="text"
                    value={formData.tiktokHandle}
                    onChange={(e) => handleChange('tiktokHandle', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="@username"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Services & Packages */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600">
              Add the services and packages you plan to offer. Include at least one package with a name and price.
            </p>

            {formData.servicePackages.map((pkg, index) => (
              <div key={pkg.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-gray-700">Package {index + 1}</h4>
                  {formData.servicePackages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeServicePackage(pkg.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">
                      Package Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pkg.name}
                      onChange={(e) => updateServicePackage(pkg.id, 'name', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g., 1-on-1 Coaching"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">
                      Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pkg.price}
                      onChange={(e) => updateServicePackage(pkg.id, 'price', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="e.g., $500/month"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Description</label>
                  <textarea
                    value={pkg.description}
                    onChange={(e) => updateServicePackage(pkg.id, 'description', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[80px]"
                    placeholder="What's included in this package..."
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Duration (Optional)</label>
                  <input
                    type="text"
                    value={pkg.duration || ''}
                    onChange={(e) => updateServicePackage(pkg.id, 'duration', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., 3 months, 6 sessions"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addServicePackage}
              className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Another Package
            </button>
          </div>
        )}

        {/* Step 4: Target Audience */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4" />
                Ideal Client Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.idealClient}
                onChange={(e) => handleChange('idealClient', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[120px]"
                placeholder="Describe your ideal client. Who are they? What challenges do they face? What are their goals?"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 10 characters</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Target className="w-4 h-4" />
                What Makes You Unique? <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.uniqueValue}
                onChange={(e) => handleChange('uniqueValue', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[120px]"
                placeholder="What sets you apart from other coaches? What unique experience, perspective, or approach do you bring?"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 10 characters</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                Certifications & Credentials (Optional)
              </label>
              <textarea
                value={formData.certifications}
                onChange={(e) => handleChange('certifications', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[100px]"
                placeholder="List any relevant certifications, degrees, or professional credentials..."
              />
            </div>
          </div>
        )}

        {/* Step 5: Goals */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  3-Year Revenue Goal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.threeYearRevenueGoal}
                  onChange={(e) => handleChange('threeYearRevenueGoal', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., $100,000/year"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  3-Year Client Goal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.threeYearClientGoal}
                  onChange={(e) => handleChange('threeYearClientGoal', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., 50 active clients"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Eye className="w-4 h-4" />
                Vision Statement <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.visionStatement}
                onChange={(e) => handleChange('visionStatement', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[100px]"
                placeholder="What is your long-term vision? Where do you see yourself and your coaching practice in 5-10 years?"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 10 characters</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Target className="w-4 h-4" />
                Mission Statement <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.missionStatement}
                onChange={(e) => handleChange('missionStatement', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[100px]"
                placeholder="What is your mission? How will you serve your clients and make an impact?"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 10 characters</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveAndExit}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save & Exit'}
              </button>
            </div>

            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
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
            )}
          </div>

          {/* Last Saved Indicator */}
          <div className="mt-4 text-center">
            {isSaving ? (
              <span className="text-sm text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            ) : lastSavedAt ? (
              <span className="text-sm text-gray-500">
                Last saved: {formatLastSaved()}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Exit Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Progress Saved!
              </h2>
              <p className="text-gray-600 mb-6">
                Your progress has been saved. You can return anytime using the same link to continue where you left off.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => setShowExitDialog(false)}
                  className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Continue Editing
                </button>
                <button
                  onClick={() => {
                    // Copy the current URL for easy return
                    navigator.clipboard.writeText(window.location.href)
                  }}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Copy Link for Later
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Bookmark this page or save the link to return to your form.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
