// Feature names as constants - separate file to avoid "use server" export issues

export const FEATURES = {
  CRM: 'CRM',
  PROJECT_MANAGEMENT: 'PROJECT_MANAGEMENT',
  COLLABORATION: 'COLLABORATION',
  TIME_CLOCK: 'TIME_CLOCK',
  SCHEDULING: 'SCHEDULING',
  KNOWLEDGE_BASE: 'KNOWLEDGE_BASE',
} as const

export type FeatureName = (typeof FEATURES)[keyof typeof FEATURES]
