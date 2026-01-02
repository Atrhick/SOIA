'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Plus,
  Target,
  TrendingUp,
  Users,
  MessageSquare,
  Share2,
  Handshake,
  Trash2,
} from 'lucide-react'
import {
  toggleCRMActivation,
  updateWebsiteContent,
  setOutreachTarget,
  logOutreachActivity,
  deleteOutreachLog,
} from '@/lib/actions/business-excellence'

interface CRMData {
  crmActivated: boolean
  crmSubscriptionActive: boolean
  crmProvider: string | null
  lastLoginDate: string | null
}

interface WebsiteData {
  logoSubmitted: boolean
  servicesSubmitted: boolean
  productsSubmitted: boolean
  pricingSubmitted: boolean
  targetAudienceSubmitted: boolean
  contactSubmitted: boolean
  aboutSubmitted: boolean
  visionMissionSubmitted: boolean
  bioSubmitted: boolean
}

interface OutreachTarget {
  id: string
  category: string
  period: string
  target: number
}

interface OutreachLog {
  id: string
  date: string
  category: string
  quantity: number
  notes: string | null
}

interface BusinessExcellenceClientProps {
  crm: CRMData | null
  website: WebsiteData | null
  outreachTargets: OutreachTarget[]
  outreachLogs: OutreachLog[]
}

const OUTREACH_CATEGORIES = [
  { id: 'NEW_CONTACTS', label: 'New Contacts', icon: Users },
  { id: 'FOLLOW_UPS', label: 'Follow Ups', icon: MessageSquare },
  { id: 'INVITATIONS_PRESENTATIONS', label: 'Invitations & Presentations', icon: Target },
  { id: 'SOCIAL_MEDIA_POSTS', label: 'Social Media Posts', icon: Share2 },
  { id: 'REFERRALS_INTRODUCTIONS', label: 'Referrals & Introductions', icon: Handshake },
  { id: 'COLLABORATION_OUTREACH', label: 'Collaboration Outreach', icon: TrendingUp },
]

export function BusinessExcellenceClient({
  crm,
  website,
  outreachTargets,
  outreachLogs,
}: BusinessExcellenceClientProps) {
  const [showCRMForm, setShowCRMForm] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)
  const [showTargetForm, setShowTargetForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // CRM form state
  const [crmActivated, setCrmActivated] = useState(crm?.crmActivated || false)
  const [crmProvider, setCrmProvider] = useState(crm?.crmProvider || '')

  // Log form state
  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'NEW_CONTACTS',
    quantity: 1,
    notes: '',
  })

  // Target form state
  const [targetForm, setTargetForm] = useState({
    category: 'NEW_CONTACTS',
    period: 'WEEKLY',
    target: 10,
  })

  const websiteItems = website
    ? [
        { label: 'Logo', submitted: website.logoSubmitted },
        { label: 'Services', submitted: website.servicesSubmitted },
        { label: 'Products', submitted: website.productsSubmitted },
        { label: 'Pricing', submitted: website.pricingSubmitted },
        { label: 'Target Audience', submitted: website.targetAudienceSubmitted },
        { label: 'Contact Info', submitted: website.contactSubmitted },
        { label: 'About', submitted: website.aboutSubmitted },
        { label: 'Vision & Mission', submitted: website.visionMissionSubmitted },
        { label: 'Bio', submitted: website.bioSubmitted },
      ]
    : []

  const submittedCount = websiteItems.filter((i) => i.submitted).length

  const handleCRMUpdate = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      const result = await toggleCRMActivation(crmActivated, crmProvider)
      if (result.error) {
        setError(result.error)
      } else {
        setShowCRMForm(false)
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    const formData = new FormData()
    formData.set('date', logForm.date)
    formData.set('category', logForm.category)
    formData.set('quantity', String(logForm.quantity))
    formData.set('notes', logForm.notes)

    try {
      const result = await logOutreachActivity(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setShowLogForm(false)
        setLogForm({
          date: new Date().toISOString().split('T')[0],
          category: 'NEW_CONTACTS',
          quantity: 1,
          notes: '',
        })
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const result = await setOutreachTarget(targetForm)
      if (result.error) {
        setError(result.error)
      } else {
        setShowTargetForm(false)
      }
    } catch {
      setError('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Delete this activity log?')) return
    try {
      await deleteOutreachLog(logId)
    } catch {
      setError('Failed to delete')
    }
  }

  // Calculate weekly progress
  const weeklyProgress = OUTREACH_CATEGORIES.map((cat) => {
    const target = outreachTargets.find(
      (t) => t.category === cat.id && t.period === 'WEEKLY'
    )?.target || 0
    const actual = outreachLogs
      .filter((l) => l.category === cat.id)
      .reduce((sum, l) => sum + l.quantity, 0)
    return {
      ...cat,
      target,
      actual,
      progress: target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0,
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Excellence</h1>
        <p className="text-gray-600">Track your CRM, website content, and marketing outreach</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* CRM Status */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">CRM Activation & Subscription</h2>
              <p className="text-sm text-gray-500">Track your CRM usage and subscription status</p>
            </div>
            <button
              onClick={() => setShowCRMForm(!showCRMForm)}
              className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50"
            >
              {showCRMForm ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>
        <div className="p-4">
          {showCRMForm ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={crmActivated}
                  onChange={(e) => setCrmActivated(e.target.checked)}
                  className="rounded"
                />
                <label className="text-sm">CRM Activated</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CRM Provider
                </label>
                <input
                  type="text"
                  value={crmProvider}
                  onChange={(e) => setCrmProvider(e.target.value)}
                  className="w-full rounded-lg border p-2"
                  placeholder="e.g., HubSpot, Salesforce"
                />
              </div>
              <button
                onClick={handleCRMUpdate}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">CRM Activated</span>
                  {crm?.crmActivated ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  crm?.crmActivated ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {crm?.crmActivated ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Subscription Active</span>
                  {crm?.crmSubscriptionActive ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  crm?.crmSubscriptionActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {crm?.crmSubscriptionActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Provider</span>
                <p className="font-medium mt-1">{crm?.crmProvider || 'Not set'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Last Login</span>
                <p className="font-medium mt-1">
                  {crm?.lastLoginDate
                    ? new Date(crm.lastLoginDate).toLocaleDateString()
                    : 'Unknown'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Website Content */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Website Content Submission</h2>
          <p className="text-sm text-gray-500">
            {submittedCount} of {websiteItems.length} items submitted
          </p>
        </div>
        <div className="p-4">
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{Math.round((submittedCount / 9) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${(submittedCount / 9) * 100}%` }}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {websiteItems.map((item) => (
              <div
                key={item.label}
                className={`p-3 rounded-lg border ${
                  item.submitted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.submitted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-300" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Marketing Outreach */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Marketing Outreach</h2>
              <p className="text-sm text-gray-500">Track your weekly outreach activities</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTargetForm(!showTargetForm)}
                className="flex items-center gap-1 px-3 py-1 text-sm border rounded-lg hover:bg-gray-50"
              >
                <Target className="h-4 w-4" />
                Set Targets
              </button>
              <button
                onClick={() => setShowLogForm(!showLogForm)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Log Activity
              </button>
            </div>
          </div>
        </div>
        <div className="p-4">
          {/* Target Form */}
          {showTargetForm && (
            <form onSubmit={handleTargetSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <h3 className="font-medium">Set Outreach Target</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={targetForm.category}
                    onChange={(e) => setTargetForm({ ...targetForm, category: e.target.value })}
                    className="w-full rounded-lg border p-2"
                  >
                    {OUTREACH_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                  <select
                    value={targetForm.period}
                    onChange={(e) => setTargetForm({ ...targetForm, period: e.target.value })}
                    className="w-full rounded-lg border p-2"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
                  <input
                    type="number"
                    value={targetForm.target}
                    onChange={(e) => setTargetForm({ ...targetForm, target: parseInt(e.target.value) || 0 })}
                    min={0}
                    className="w-full rounded-lg border p-2"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Target'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTargetForm(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Log Form */}
          {showLogForm && (
            <form onSubmit={handleLogSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <h3 className="font-medium">Log Outreach Activity</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={logForm.date}
                    onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                    className="w-full rounded-lg border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={logForm.category}
                    onChange={(e) => setLogForm({ ...logForm, category: e.target.value })}
                    className="w-full rounded-lg border p-2"
                  >
                    {OUTREACH_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={logForm.quantity}
                    onChange={(e) => setLogForm({ ...logForm, quantity: parseInt(e.target.value) || 1 })}
                    min={1}
                    className="w-full rounded-lg border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={logForm.notes}
                    onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                    className="w-full rounded-lg border p-2"
                    placeholder="Add notes..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Log Activity'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogForm(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Weekly Progress */}
          <div className="mb-6">
            <h3 className="font-medium mb-3">Weekly Progress</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {weeklyProgress.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.id} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-500">
                        {item.actual} / {item.target || '—'}
                      </span>
                      {item.target > 0 && (
                        <span className={item.progress >= 100 ? 'text-green-600' : 'text-blue-600'}>
                          {item.progress}%
                        </span>
                      )}
                    </div>
                    {item.target > 0 ? (
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.progress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">No target set</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent Activity Logs */}
          {outreachLogs.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Recent Activity</h3>
              <div className="space-y-2">
                {outreachLogs.slice(0, 10).map((log) => {
                  const cat = OUTREACH_CATEGORIES.find((c) => c.id === log.category)
                  const Icon = cat?.icon || Target
                  return (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium">{cat?.label || log.category}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(log.date).toLocaleDateString()}
                            {log.notes && ` — ${log.notes}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                          +{log.quantity}
                        </span>
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
