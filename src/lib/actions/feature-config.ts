'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import type { FeatureName } from '@/lib/feature-names'

// Default feature configurations
const DEFAULT_FEATURES: {
  feature: FeatureName
  isEnabled: boolean
  enabledForCoaches: boolean
  enabledForAmbassadors: boolean
}[] = [
  { feature: 'CRM', isEnabled: true, enabledForCoaches: true, enabledForAmbassadors: false },
  { feature: 'PROJECT_MANAGEMENT', isEnabled: true, enabledForCoaches: true, enabledForAmbassadors: false },
  { feature: 'COLLABORATION', isEnabled: true, enabledForCoaches: true, enabledForAmbassadors: true },
  { feature: 'TIME_CLOCK', isEnabled: true, enabledForCoaches: true, enabledForAmbassadors: true },
  { feature: 'SCHEDULING', isEnabled: true, enabledForCoaches: true, enabledForAmbassadors: true },
  { feature: 'KNOWLEDGE_BASE', isEnabled: true, enabledForCoaches: true, enabledForAmbassadors: true },
]

export async function getAllFeatureConfigs() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  // Ensure all default features exist
  for (const defaultFeature of DEFAULT_FEATURES) {
    await prisma.featureConfig.upsert({
      where: { feature: defaultFeature.feature },
      update: {},
      create: defaultFeature,
    })
  }

  const configs = await prisma.featureConfig.findMany({
    orderBy: { feature: 'asc' },
  })

  return {
    configs: configs.map(c => ({
      id: c.id,
      feature: c.feature,
      isEnabled: c.isEnabled,
      enabledForCoaches: c.enabledForCoaches,
      enabledForAmbassadors: c.enabledForAmbassadors,
    }))
  }
}

export async function updateFeatureConfig(
  feature: string,
  data: {
    isEnabled?: boolean
    enabledForCoaches?: boolean
    enabledForAmbassadors?: boolean
    settings?: Record<string, unknown>
  }
) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const config = await prisma.featureConfig.upsert({
      where: { feature },
      update: {
        isEnabled: data.isEnabled,
        enabledForCoaches: data.enabledForCoaches,
        enabledForAmbassadors: data.enabledForAmbassadors,
        settings: data.settings ? (data.settings as Prisma.InputJsonValue) : undefined,
      },
      create: {
        feature,
        isEnabled: data.isEnabled ?? true,
        enabledForCoaches: data.enabledForCoaches ?? true,
        enabledForAmbassadors: data.enabledForAmbassadors ?? false,
        settings: data.settings ? (data.settings as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_FEATURE_CONFIG',
        entityType: 'FeatureConfig',
        entityId: config.id,
        details: JSON.stringify({ feature, ...data }),
      },
    })

    revalidatePath('/admin/features')
    return { success: true, config }
  } catch (error) {
    console.error('Error updating feature config:', error)
    return { error: 'Failed to update feature configuration' }
  }
}

export async function toggleFeature(feature: string) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  try {
    const existing = await prisma.featureConfig.findUnique({
      where: { feature },
    })

    if (!existing) {
      return { error: 'Feature not found' }
    }

    const updated = await prisma.featureConfig.update({
      where: { feature },
      data: { isEnabled: !existing.isEnabled },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: existing.isEnabled ? 'DISABLE_FEATURE' : 'ENABLE_FEATURE',
        entityType: 'FeatureConfig',
        entityId: updated.id,
        details: JSON.stringify({ feature }),
      },
    })

    revalidatePath('/admin/features')
    return { success: true, isEnabled: updated.isEnabled }
  } catch (error) {
    console.error('Error toggling feature:', error)
    return { error: 'Failed to toggle feature' }
  }
}

export async function isFeatureEnabled(feature: string, role?: string, userId?: string): Promise<boolean> {
  try {
    const config = await prisma.featureConfig.findUnique({
      where: { feature },
    })

    // Feature must be globally enabled
    if (!config || !config.isEnabled) {
      return false
    }

    // Check for user-specific override first
    if (userId) {
      const userOverride = await prisma.userFeaturePermission.findUnique({
        where: {
          userId_feature: { userId, feature }
        }
      })

      if (userOverride) {
        return userOverride.granted
      }
    }

    // Fall back to role-based permissions
    if (role === 'ADMIN') {
      return true
    }

    if (role === 'COACH') {
      return config.enabledForCoaches
    }

    if (role === 'AMBASSADOR') {
      return config.enabledForAmbassadors
    }

    return false
  } catch (error) {
    console.error('Error checking feature status:', error)
    return false
  }
}

export async function getEnabledFeaturesForRole(role: string, userId?: string) {
  try {
    const configs = await prisma.featureConfig.findMany({
      where: { isEnabled: true },
    })

    // Get user-specific overrides if userId provided
    let userOverrides: { feature: string; granted: boolean }[] = []
    if (userId) {
      const overrides = await prisma.userFeaturePermission.findMany({
        where: { userId }
      })
      userOverrides = overrides.map(o => ({ feature: o.feature, granted: o.granted }))
    }

    return configs.filter((config) => {
      // Check for user override first
      const override = userOverrides.find(o => o.feature === config.feature)
      if (override) {
        return override.granted
      }

      // Fall back to role-based
      if (role === 'ADMIN') return true
      if (role === 'COACH') return config.enabledForCoaches
      if (role === 'AMBASSADOR') return config.enabledForAmbassadors
      return false
    }).map((config) => config.feature)
  } catch (error) {
    console.error('Error getting enabled features:', error)
    return []
  }
}
