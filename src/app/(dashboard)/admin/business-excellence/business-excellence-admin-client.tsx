'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Briefcase,
  Search,
  CheckCircle2,
  XCircle,
  Globe,
  Target,
  Users,
  TrendingUp,
  Eye,
  Database,
} from 'lucide-react'

interface Coach {
  id: string
  firstName: string
  lastName: string
  email: string
  coachStatus: string
  crm: {
    crmActivated: boolean
    crmSubscriptionActive: boolean
    crmProvider: string | null
    lastLoginDate: string | null
    activationDate: string | null
  } | null
  website: {
    logoSubmitted: boolean
    servicesSubmitted: boolean
    productsSubmitted: boolean
    pricingSubmitted: boolean
    targetAudienceSubmitted: boolean
    contactSubmitted: boolean
    aboutSubmitted: boolean
    visionMissionSubmitted: boolean
    bioSubmitted: boolean
  } | null
  outreachTargetsCount: number
  recentOutreachCount: number
}

interface BusinessExcellenceAdminClientProps {
  coaches: Coach[]
}

export function BusinessExcellenceAdminClient({ coaches }: BusinessExcellenceAdminClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null)

  const filteredCoaches = coaches.filter((coach) => {
    const matchesSearch =
      search === '' ||
      `${coach.firstName} ${coach.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      coach.email.toLowerCase().includes(search.toLowerCase())

    if (statusFilter === 'all') return matchesSearch
    if (statusFilter === 'crm_active') return matchesSearch && coach.crm?.crmActivated
    if (statusFilter === 'crm_inactive') return matchesSearch && !coach.crm?.crmActivated
    if (statusFilter === 'website_complete') {
      const complete = coach.website && getWebsiteProgress(coach.website) === 100
      return matchesSearch && complete
    }
    if (statusFilter === 'website_incomplete') {
      const incomplete = !coach.website || getWebsiteProgress(coach.website) < 100
      return matchesSearch && incomplete
    }
    return matchesSearch
  })

  // Calculate stats
  const totalCoaches = coaches.length
  const crmActiveCount = coaches.filter((c) => c.crm?.crmActivated).length
  const websiteCompleteCount = coaches.filter(
    (c) => c.website && getWebsiteProgress(c.website) === 100
  ).length
  const totalOutreach = coaches.reduce((sum, c) => sum + c.recentOutreachCount, 0)

  function getWebsiteProgress(website: Coach['website']): number {
    if (!website) return 0
    const fields = [
      website.logoSubmitted,
      website.servicesSubmitted,
      website.productsSubmitted,
      website.pricingSubmitted,
      website.targetAudienceSubmitted,
      website.contactSubmitted,
      website.aboutSubmitted,
      website.visionMissionSubmitted,
      website.bioSubmitted,
    ]
    const completed = fields.filter(Boolean).length
    return Math.round((completed / fields.length) * 100)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Excellence Overview</h1>
        <p className="text-gray-600 mt-1">
          Monitor coaches' CRM activation, website readiness, and outreach activities
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalCoaches}</p>
                <p className="text-sm text-gray-500">Total Coaches</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Database className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{crmActiveCount}</p>
                <p className="text-sm text-gray-500">CRM Activated</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Globe className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{websiteCompleteCount}</p>
                <p className="text-sm text-gray-500">Website Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalOutreach}</p>
                <p className="text-sm text-gray-500">Outreach (30 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Coaches</SelectItem>
            <SelectItem value="crm_active">CRM Active</SelectItem>
            <SelectItem value="crm_inactive">CRM Inactive</SelectItem>
            <SelectItem value="website_complete">Website Complete</SelectItem>
            <SelectItem value="website_incomplete">Website Incomplete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Coaches List */}
      {filteredCoaches.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No coaches found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCoaches.map((coach) => {
            const websiteProgress = getWebsiteProgress(coach.website)

            return (
              <Card
                key={coach.id}
                className="hover:border-primary-200 transition-colors cursor-pointer"
                onClick={() => setSelectedCoach(coach)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-gray-600">
                          {coach.firstName[0]}
                          {coach.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {coach.firstName} {coach.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">{coach.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* CRM Status */}
                      <div className="flex items-center gap-2">
                        {coach.crm?.crmActivated ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            CRM Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">
                            <XCircle className="w-3 h-3 mr-1" />
                            CRM Inactive
                          </Badge>
                        )}
                      </div>

                      {/* Website Progress */}
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                websiteProgress === 100
                                  ? 'bg-green-500'
                                  : websiteProgress >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${websiteProgress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 w-8">{websiteProgress}%</span>
                      </div>

                      {/* Outreach */}
                      <div className="flex items-center gap-1 text-sm text-gray-600 min-w-[80px]">
                        <Target className="w-4 h-4" />
                        <span>{coach.recentOutreachCount}</span>
                      </div>

                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedCoach} onOpenChange={(open) => !open && setSelectedCoach(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary-500" />
              {selectedCoach?.firstName} {selectedCoach?.lastName}
            </DialogTitle>
            <DialogDescription>{selectedCoach?.email}</DialogDescription>
          </DialogHeader>

          {selectedCoach && (
            <div className="space-y-6 py-4">
              {/* CRM Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  CRM Status
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <p className="font-medium">
                        {selectedCoach.crm?.crmActivated ? (
                          <span className="text-green-600">Active</span>
                        ) : (
                          <span className="text-gray-500">Inactive</span>
                        )}
                      </p>
                    </div>
                    {selectedCoach.crm?.crmProvider && (
                      <div>
                        <p className="text-sm text-gray-500">Provider</p>
                        <p className="font-medium">{selectedCoach.crm.crmProvider}</p>
                      </div>
                    )}
                    {selectedCoach.crm?.activationDate && (
                      <div>
                        <p className="text-sm text-gray-500">Activated On</p>
                        <p className="font-medium">
                          {new Date(selectedCoach.crm.activationDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {selectedCoach.crm?.lastLoginDate && (
                      <div>
                        <p className="text-sm text-gray-500">Last Login</p>
                        <p className="font-medium">
                          {new Date(selectedCoach.crm.lastLoginDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Website Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website Content ({getWebsiteProgress(selectedCoach.website)}% Complete)
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {selectedCoach.website ? (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Logo', value: selectedCoach.website.logoSubmitted },
                        { label: 'Services', value: selectedCoach.website.servicesSubmitted },
                        { label: 'Products', value: selectedCoach.website.productsSubmitted },
                        { label: 'Pricing', value: selectedCoach.website.pricingSubmitted },
                        { label: 'Target Audience', value: selectedCoach.website.targetAudienceSubmitted },
                        { label: 'Contact', value: selectedCoach.website.contactSubmitted },
                        { label: 'About', value: selectedCoach.website.aboutSubmitted },
                        { label: 'Vision/Mission', value: selectedCoach.website.visionMissionSubmitted },
                        { label: 'Bio', value: selectedCoach.website.bioSubmitted },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          {item.value ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-300" />
                          )}
                          <span className={`text-sm ${item.value ? 'text-gray-700' : 'text-gray-400'}`}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No website content submitted yet</p>
                  )}
                </div>
              </div>

              {/* Outreach Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Outreach Activity
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Active Targets</p>
                      <p className="font-medium">{selectedCoach.outreachTargetsCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Activities (Last 30 Days)</p>
                      <p className="font-medium">{selectedCoach.recentOutreachCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
