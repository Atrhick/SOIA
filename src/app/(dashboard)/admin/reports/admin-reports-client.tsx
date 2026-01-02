'use client'

import { useState } from 'react'
import {
  BarChart3,
  Users,
  UserCheck,
  DollarSign,
  Calendar,
  BookOpen,
  Building2,
  Download,
  TrendingUp,
} from 'lucide-react'

interface Stats {
  coaches: {
    total: number
    active: number
    pending: number
    newThisMonth: number
  }
  ambassadors: {
    total: number
    approved: number
    pending: number
    newThisMonth: number
  }
  sponsorships: {
    total: number
    pending: number
    approved: number
    totalApprovedAmount: number
  }
  events: {
    total: number
    upcoming: number
    totalRSVPs: number
  }
  courses: {
    total: number
    quizAttempts: number
    passedAttempts: number
    passRate: number
  }
  income: {
    totalEntries: number
    thisMonth: number
  }
  resourceCenters: {
    total: number
    pendingApplications: number
  }
}

interface CoachReport {
  id: string
  name: string
  email: string
  status: string
  ambassadorCount: number
  recruitedCount: number
  monthlyIncome: number
  coursesCompleted: number
  createdAt: string
}

interface AmbassadorReport {
  id: string
  name: string
  email: string
  status: string
  coachName: string
  createdAt: string
}

interface SponsorshipReport {
  id: string
  type: string
  coachName: string
  requestedAmount: number
  approvedAmount: number | null
  status: string
  createdAt: string
}

interface EventReport {
  id: string
  name: string
  startDate: string
  location: string | null
  yesCount: number
  maybeCount: number
}

interface Reports {
  coaches: CoachReport[]
  ambassadors: AmbassadorReport[]
  sponsorships: SponsorshipReport[]
  events: EventReport[]
}

interface AdminReportsClientProps {
  stats: Stats
  reports: Reports
}

export function AdminReportsClient({ stats, reports }: AdminReportsClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'coaches' | 'ambassadors' | 'sponsorships' | 'events'>('overview')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) =>
        headers.map((header) => {
          const value = row[header]
          const strValue = String(value ?? '')
          // Escape quotes and wrap in quotes if contains comma
          if (strValue.includes(',') || strValue.includes('"')) {
            return `"${strValue.replace(/"/g, '""')}"`
          }
          return strValue
        }).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      DECLINED: 'bg-red-100 text-red-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600">Platform statistics and exportable reports</p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex gap-4 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'coaches', label: 'Coaches', icon: Users },
            { id: 'ambassadors', label: 'Ambassadors', icon: UserCheck },
            { id: 'sponsorships', label: 'Sponsorships', icon: DollarSign },
            { id: 'events', label: 'Events', icon: Calendar },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Coach Stats */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Coaches</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Coaches</p>
                    <p className="text-2xl font-bold">{stats.coaches.total}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.coaches.active}</p>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.coaches.pending}</p>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-gray-600">New This Month</p>
                </div>
                <p className="text-2xl font-bold">{stats.coaches.newThisMonth}</p>
              </div>
            </div>
          </div>

          {/* Ambassador Stats */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Ambassadors</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <UserCheck className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Ambassadors</p>
                    <p className="text-2xl font-bold">{stats.ambassadors.total}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.ambassadors.approved}</p>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.ambassadors.pending}</p>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-gray-600">New This Month</p>
                </div>
                <p className="text-2xl font-bold">{stats.ambassadors.newThisMonth}</p>
              </div>
            </div>
          </div>

          {/* Other Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sponsorships */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">Sponsorships</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Requests</span>
                  <span className="font-medium">{stats.sponsorships.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending</span>
                  <span className="font-medium text-yellow-600">{stats.sponsorships.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Approved</span>
                  <span className="font-medium text-green-600">{stats.sponsorships.approved}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Approved</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(stats.sponsorships.totalApprovedAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Events */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Events</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Events</span>
                  <span className="font-medium">{stats.events.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Upcoming</span>
                  <span className="font-medium text-blue-600">{stats.events.upcoming}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total RSVPs (Yes)</span>
                  <span className="font-medium text-green-600">{stats.events.totalRSVPs}</span>
                </div>
              </div>
            </div>

            {/* Courses */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold">Courses</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Courses</span>
                  <span className="font-medium">{stats.courses.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quiz Attempts</span>
                  <span className="font-medium">{stats.courses.quizAttempts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Passed</span>
                  <span className="font-medium text-green-600">{stats.courses.passedAttempts}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pass Rate</span>
                    <span className="font-bold">{stats.courses.passRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resource Centers & Income */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold">Resource Centers</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Centers</span>
                  <span className="font-medium">{stats.resourceCenters.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending Applications</span>
                  <span className="font-medium text-yellow-600">{stats.resourceCenters.pendingApplications}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">Coach Income (This Month)</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Entries</span>
                  <span className="font-medium">{stats.income.totalEntries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-bold text-green-600">{formatCurrency(stats.income.thisMonth)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coaches Tab */}
      {activeTab === 'coaches' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Coaches Report</h2>
            <button
              onClick={() => downloadCSV(reports.coaches, 'coaches_report')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ambassadors</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recruited</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Income</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Courses</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reports.coaches.map((coach) => (
                    <tr key={coach.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{coach.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{coach.email}</td>
                      <td className="px-4 py-3">{getStatusBadge(coach.status)}</td>
                      <td className="px-4 py-3 text-sm">{coach.ambassadorCount}</td>
                      <td className="px-4 py-3 text-sm">{coach.recruitedCount}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {formatCurrency(coach.monthlyIncome)}
                      </td>
                      <td className="px-4 py-3 text-sm">{coach.coursesCompleted}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(coach.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ambassadors Tab */}
      {activeTab === 'ambassadors' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Ambassadors Report</h2>
            <button
              onClick={() => downloadCSV(reports.ambassadors, 'ambassadors_report')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coach</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reports.ambassadors.map((ambassador) => (
                    <tr key={ambassador.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{ambassador.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ambassador.email}</td>
                      <td className="px-4 py-3">{getStatusBadge(ambassador.status)}</td>
                      <td className="px-4 py-3 text-sm">{ambassador.coachName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(ambassador.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sponsorships Tab */}
      {activeTab === 'sponsorships' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Sponsorships Report</h2>
            <button
              onClick={() => downloadCSV(reports.sponsorships, 'sponsorships_report')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coach</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approved</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reports.sponsorships.map((sponsorship) => (
                    <tr key={sponsorship.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{sponsorship.type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 font-medium">{sponsorship.coachName}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(sponsorship.requestedAmount)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {sponsorship.approvedAmount ? formatCurrency(sponsorship.approvedAmount) : '-'}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(sponsorship.status)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(sponsorship.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Events Report</h2>
            <button
              onClick={() => downloadCSV(reports.events, 'events_report')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yes RSVPs</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Maybe RSVPs</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reports.events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{event.name}</td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(event.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{event.location || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">{event.yesCount}</td>
                      <td className="px-4 py-3 text-sm text-yellow-600">{event.maybeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
