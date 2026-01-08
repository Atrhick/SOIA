import { cn } from '@/lib/utils'
import { type LucideIcon, Inbox } from 'lucide-react'
import Link from 'next/link'
import { Button } from './button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  secondaryAction?: {
    label: string
    href?: string
    onClick?: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <Icon className="h-10 w-10 text-gray-400" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 text-center">{title}</h3>

      {description && (
        <p className="text-sm text-gray-500 text-center mt-1 max-w-sm">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-6">
          {secondaryAction && (
            secondaryAction.href ? (
              <Link href={secondaryAction.href}>
                <Button variant="outline">{secondaryAction.label}</Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )
          )}

          {action && (
            action.href ? (
              <Link href={action.href}>
                <Button>{action.label}</Button>
              </Link>
            ) : (
              <Button onClick={action.onClick}>{action.label}</Button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// Inline empty state for smaller areas (like card content)
interface InlineEmptyStateProps {
  icon?: LucideIcon
  message: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  className?: string
}

export function InlineEmptyState({
  icon: Icon = Inbox,
  message,
  action,
  className,
}: InlineEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-8 text-center', className)}>
      <Icon className="h-8 w-8 text-gray-300 mb-2" />
      <p className="text-sm text-gray-500">{message}</p>
      {action && (
        <div className="mt-3">
          {action.href ? (
            <Link href={action.href}>
              <Button variant="outline" size="sm">{action.label}</Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
