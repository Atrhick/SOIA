'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  FolderKanban,
  MessageSquare,
  Clock,
  Calendar,
  BookOpen,
  Settings2,
  Loader2
} from 'lucide-react'
import { updateFeatureConfig } from '@/lib/actions/feature-config'

type FeatureConfig = {
  id: string
  feature: string
  isEnabled: boolean
  enabledForCoaches: boolean
  enabledForAmbassadors: boolean
  settings: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

const FEATURE_META: Record<string, {
  label: string
  description: string
  icon: typeof Users
  color: string
}> = {
  CRM: {
    label: 'CRM',
    description: 'Manage contacts, deals, and sales pipeline',
    icon: Users,
    color: 'bg-blue-500',
  },
  PROJECT_MANAGEMENT: {
    label: 'Project Management',
    description: 'Create projects, tasks, and track milestones',
    icon: FolderKanban,
    color: 'bg-purple-500',
  },
  COLLABORATION: {
    label: 'Collaboration',
    description: 'Team discussions and document sharing',
    icon: MessageSquare,
    color: 'bg-green-500',
  },
  TIME_CLOCK: {
    label: 'Time Clock',
    description: 'Clock in/out and track time on projects',
    icon: Clock,
    color: 'bg-orange-500',
  },
  SCHEDULING: {
    label: 'Scheduling',
    description: 'Calendar events and appointments',
    icon: Calendar,
    color: 'bg-pink-500',
  },
  KNOWLEDGE_BASE: {
    label: 'Knowledge Base',
    description: 'Articles and documentation',
    icon: BookOpen,
    color: 'bg-indigo-500',
  },
}

export function FeaturesConfigClient({ configs }: { configs: FeatureConfig[] }) {
  const [features, setFeatures] = useState(configs)
  const [updating, setUpdating] = useState<string | null>(null)

  const handleToggle = async (
    feature: string,
    field: 'isEnabled' | 'enabledForCoaches' | 'enabledForAmbassadors',
    currentValue: boolean
  ) => {
    setUpdating(`${feature}-${field}`)

    try {
      const result = await updateFeatureConfig(feature, {
        [field]: !currentValue,
      })

      if (result.success) {
        setFeatures((prev) =>
          prev.map((f) =>
            f.feature === feature ? { ...f, [field]: !currentValue } : f
          )
        )
      }
    } catch (error) {
      console.error('Error updating feature:', error)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="grid gap-4">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Settings2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {features.filter((f) => f.isEnabled).length}
                </p>
                <p className="text-sm text-gray-500">Features Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {features.filter((f) => f.isEnabled && f.enabledForCoaches).length}
                </p>
                <p className="text-sm text-gray-500">For Coaches</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {features.filter((f) => f.isEnabled && f.enabledForAmbassadors).length}
                </p>
                <p className="text-sm text-gray-500">For Ambassadors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((config) => {
          const meta = FEATURE_META[config.feature] || {
            label: config.feature,
            description: 'Feature configuration',
            icon: Settings2,
            color: 'bg-gray-500',
          }
          const Icon = meta.icon

          return (
            <Card key={config.id} className={!config.isEnabled ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${meta.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{meta.label}</CardTitle>
                      <CardDescription className="text-xs">
                        {meta.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Main Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Enabled</span>
                    {config.isEnabled ? (
                      <Badge variant="success" className="text-xs">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Disabled</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {updating === `${config.feature}-isEnabled` && (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    )}
                    <Switch
                      checked={config.isEnabled}
                      onCheckedChange={() => handleToggle(config.feature, 'isEnabled', config.isEnabled)}
                      disabled={updating === `${config.feature}-isEnabled`}
                    />
                  </div>
                </div>

                {/* Role Toggles */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600">Available to Coaches</span>
                    <div className="flex items-center gap-2">
                      {updating === `${config.feature}-enabledForCoaches` && (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      )}
                      <Switch
                        checked={config.enabledForCoaches}
                        onCheckedChange={() => handleToggle(config.feature, 'enabledForCoaches', config.enabledForCoaches)}
                        disabled={!config.isEnabled || updating === `${config.feature}-enabledForCoaches`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600">Available to Ambassadors</span>
                    <div className="flex items-center gap-2">
                      {updating === `${config.feature}-enabledForAmbassadors` && (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      )}
                      <Switch
                        checked={config.enabledForAmbassadors}
                        onCheckedChange={() => handleToggle(config.feature, 'enabledForAmbassadors', config.enabledForAmbassadors)}
                        disabled={!config.isEnabled || updating === `${config.feature}-enabledForAmbassadors`}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
