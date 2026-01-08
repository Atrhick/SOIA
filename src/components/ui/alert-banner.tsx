'use client'

import { cn } from '@/lib/utils'
import { type LucideIcon, X, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from './button'

type AlertVariant = 'warning' | 'info' | 'success' | 'error'

interface AlertBannerProps {
  variant?: AlertVariant
  icon?: LucideIcon
  title?: string
  message: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

const variantStyles: Record<AlertVariant, {
  container: string
  icon: string
  title: string
  text: string
  button: string
  defaultIcon: LucideIcon
}> = {
  warning: {
    container: 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200',
    icon: 'text-yellow-600',
    title: 'text-yellow-800',
    text: 'text-yellow-700',
    button: 'border-yellow-300 text-yellow-700 hover:bg-yellow-100',
    defaultIcon: AlertTriangle,
  },
  info: {
    container: 'bg-gradient-to-r from-blue-50 to-sky-50 border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-800',
    text: 'text-blue-700',
    button: 'border-blue-300 text-blue-700 hover:bg-blue-100',
    defaultIcon: Info,
  },
  success: {
    container: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200',
    icon: 'text-green-600',
    title: 'text-green-800',
    text: 'text-green-700',
    button: 'border-green-300 text-green-700 hover:bg-green-100',
    defaultIcon: CheckCircle,
  },
  error: {
    container: 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200',
    icon: 'text-red-600',
    title: 'text-red-800',
    text: 'text-red-700',
    button: 'border-red-300 text-red-700 hover:bg-red-100',
    defaultIcon: XCircle,
  },
}

export function AlertBanner({
  variant = 'info',
  icon,
  title,
  message,
  action,
  dismissible = false,
  onDismiss,
  className,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const styles = variantStyles[variant]
  const Icon = icon || styles.defaultIcon

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  if (dismissed) return null

  return (
    <div
      className={cn(
        'relative rounded-xl border p-4 transition-all duration-200',
        styles.container,
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn('shrink-0 mt-0.5', styles.icon)}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={cn('font-semibold mb-1', styles.title)}>{title}</h4>
          )}
          <p className={cn('text-sm', styles.text)}>{message}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {action && (
            action.href ? (
              <Link href={action.href}>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('border', styles.button)}
                >
                  {action.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={action.onClick}
                className={cn('border', styles.button)}
              >
                {action.label}
              </Button>
            )
          )}

          {dismissible && (
            <button
              onClick={handleDismiss}
              className={cn(
                'p-1 rounded-md transition-colors',
                styles.icon,
                'hover:bg-black/5'
              )}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Multiple alerts stacked
interface AlertStackProps {
  alerts: Array<Omit<AlertBannerProps, 'className'>>
  className?: string
}

export function AlertStack({ alerts, className }: AlertStackProps) {
  if (alerts.length === 0) return null

  return (
    <div className={cn('space-y-3', className)}>
      {alerts.map((alert, index) => (
        <AlertBanner key={index} {...alert} />
      ))}
    </div>
  )
}
