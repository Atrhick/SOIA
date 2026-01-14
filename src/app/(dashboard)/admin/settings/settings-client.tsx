'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Settings,
  Database,
  Users,
  Shield,
  Bell,
  Globe,
  Server,
  HardDrive,
  CheckCircle,
  XCircle,
  ExternalLink,
  Info,
} from 'lucide-react'

interface FeatureConfig {
  feature: string
  isEnabled: boolean
  enabledForCoaches: boolean
  enabledForAmbassadors: boolean
}

interface SystemStats {
  totalUsers: number
  totalCoaches: number
  totalAmbassadors: number
  totalEvents: number
  totalCourses: number
  featureConfigs: FeatureConfig[]
}

interface SettingsClientProps {
  stats: SystemStats
}

const FEATURE_LABELS: Record<string, string> = {
  CRM: 'Customer Relationship Management',
  PROJECT_MANAGEMENT: 'Project Management',
  COLLABORATION: 'Collaboration & Messaging',
  TIME_CLOCK: 'Time Clock',
  SCHEDULING: 'Scheduling & Calendar',
  KNOWLEDGE_BASE: 'Knowledge Base',
}

export function SettingsClient({ stats }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'features' | 'system'>('general')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-500 mt-1">
          Manage application configuration and system preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="h-4 w-4 inline-block mr-2" />
            General
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'features'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="h-4 w-4 inline-block mr-2" />
            Features
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'system'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Server className="h-4 w-4 inline-block mr-2" />
            System Info
          </button>
        </nav>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <Database className="h-5 w-5 inline-block mr-2 text-gray-400" />
              Database Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.totalUsers}</div>
                <div className="text-sm text-gray-500">Total Users</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.totalCoaches}</div>
                <div className="text-sm text-gray-500">Coaches</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.totalAmbassadors}</div>
                <div className="text-sm text-gray-500">Ambassadors</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.totalEvents}</div>
                <div className="text-sm text-gray-500">Events</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.totalCourses}</div>
                <div className="text-sm text-gray-500">Courses</div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <Globe className="h-5 w-5 inline-block mr-2 text-gray-400" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/admin/users"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Users className="h-8 w-8 text-primary-500 mr-3" />
                <div>
                  <div className="font-medium text-gray-900">User Management</div>
                  <div className="text-sm text-gray-500">Manage user accounts</div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 ml-auto" />
              </Link>
              <Link
                href="/admin/features"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Shield className="h-8 w-8 text-primary-500 mr-3" />
                <div>
                  <div className="font-medium text-gray-900">Feature Config</div>
                  <div className="text-sm text-gray-500">Toggle feature access</div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 ml-auto" />
              </Link>
              <Link
                href="/admin/audit-logs"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <HardDrive className="h-8 w-8 text-primary-500 mr-3" />
                <div>
                  <div className="font-medium text-gray-900">Audit Logs</div>
                  <div className="text-sm text-gray-500">View system activity</div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 ml-auto" />
              </Link>
            </div>
          </div>

          {/* Notifications Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <Info className="h-5 w-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">Configuration Note</h3>
                <p className="text-sm text-blue-700 mt-1">
                  System-wide settings like email configuration, authentication providers, and
                  storage settings are managed through environment variables. Contact your
                  system administrator to modify these settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Features Tab */}
      {activeTab === 'features' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Feature Status</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Current status of all configurable features
                  </p>
                </div>
                <Link
                  href="/admin/features"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Manage Features
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </div>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Global Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coaches
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ambassadors
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.featureConfigs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No feature configurations found.
                      <Link href="/admin/features" className="text-primary-600 hover:text-primary-700 ml-1">
                        Configure features
                      </Link>
                    </td>
                  </tr>
                ) : (
                  stats.featureConfigs.map((feature) => (
                    <tr key={feature.feature}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {FEATURE_LABELS[feature.feature] || feature.feature}
                        </div>
                        <div className="text-sm text-gray-500">{feature.feature}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {feature.isEnabled ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {feature.enabledForCoaches ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {feature.enabledForAmbassadors ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <Server className="h-5 w-5 inline-block mr-2 text-gray-400" />
              Application Information
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">Application Name</div>
                  <div className="font-medium text-gray-900">StageOneInAction Back Office</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">Framework</div>
                  <div className="font-medium text-gray-900">Next.js 14 (App Router)</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">Database</div>
                  <div className="font-medium text-gray-900">PostgreSQL with Prisma ORM</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500">Authentication</div>
                  <div className="font-medium text-gray-900">NextAuth.js v5</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <Bell className="h-5 w-5 inline-block mr-2 text-gray-400" />
              Environment Status
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Node Environment</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {process.env.NODE_ENV || 'development'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Database Connection</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Authentication</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Configured
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
