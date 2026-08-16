import type { LucideIcon } from 'lucide-react'
import { Lock } from 'lucide-react'

interface FeatureDisabledProps {
  /** Feature name shown as the heading, e.g. "Program Pages" */
  title: string
  /** Icon for the feature. Falls back to a padlock. */
  icon?: LucideIcon
  /** Overrides the default explanatory line. */
  message?: string
}

/**
 * Shown in place of a page when a feature is not enabled for the current user.
 *
 * The existing gated pages each inline their own copy of this markup; this is
 * the shared version. New gated pages should use it rather than adding a
 * fifteenth duplicate.
 */
export function FeatureDisabled({
  title,
  icon: Icon = Lock,
  message = 'This feature is not currently enabled.',
}: FeatureDisabledProps) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <Icon className="h-12 w-12 text-gray-300 mx-auto mb-4" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="text-gray-500 mt-2">{message}</p>
      </div>
    </div>
  )
}
