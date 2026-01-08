import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllFeatureConfigs } from '@/lib/actions/feature-config'
import { FeaturesConfigClient } from './features-config-client'

export default async function AdminFeaturesPage() {
  const session = await auth()

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  const result = await getAllFeatureConfigs()

  if (result.error || !result.configs) {
    return (
      <div className="p-6">
        <p className="text-red-500">Error loading feature configurations</p>
      </div>
    )
  }

  const serializedConfigs = result.configs.map((config) => ({
    id: config.id,
    feature: config.feature,
    isEnabled: config.isEnabled,
    enabledForCoaches: config.enabledForCoaches,
    enabledForAmbassadors: config.enabledForAmbassadors,
    settings: config.settings as Record<string, unknown> | null,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feature Configuration</h1>
        <p className="text-gray-600">
          Enable or disable features for coaches and ambassadors
        </p>
      </div>

      <FeaturesConfigClient configs={serializedConfigs} />
    </div>
  )
}
