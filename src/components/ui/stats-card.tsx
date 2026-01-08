import { cn } from '@/lib/utils'
import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { Badge } from './badge'
import { type ReactNode } from 'react'

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: 'primary' | 'green' | 'yellow' | 'red' | 'purple' | 'blue'
  trend?: {
    value: number
    label?: string
    direction?: 'up' | 'down'
  }
  footer?: {
    label: string
    value?: string | number
    variant?: 'default' | 'success' | 'warning' | 'destructive' | 'secondary'
    href?: string
  }
  children?: ReactNode
  className?: string
}

const iconColorMap = {
  primary: 'bg-primary-100 text-primary-600',
  green: 'bg-green-100 text-green-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-600',
  blue: 'bg-blue-100 text-blue-600',
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  iconColor = 'primary',
  trend,
  footer,
  children,
  className,
}: StatsCardProps) {
  const showTrendUp = trend?.direction === 'up' || (trend?.direction === undefined && trend?.value !== undefined && trend.value >= 0)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300',
        className
      )}
    >
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-50 to-transparent rounded-bl-full opacity-50" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {title}
          </span>
          <div className={cn('rounded-lg p-2.5', iconColorMap[iconColor])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {/* Value */}
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-gray-900">{value}</span>
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 text-sm font-medium mb-1',
                showTrendUp ? 'text-green-600' : 'text-red-600'
              )}
            >
              {showTrendUp ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>
                {trend.value >= 0 ? '+' : ''}
                {trend.value}%
              </span>
              {trend.label && (
                <span className="text-gray-400 font-normal">{trend.label}</span>
              )}
            </div>
          )}
        </div>

        {/* Children (e.g., Progress bar) */}
        {children}

        {/* Footer */}
        {footer && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{footer.label}</span>
              {footer.href ? (
                <Link
                  href={footer.href}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {footer.value || 'View all'}
                </Link>
              ) : footer.value !== undefined ? (
                <Badge variant={footer.variant || 'secondary'}>
                  {footer.value}
                </Badge>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Compact variant for smaller displays
interface CompactStatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: 'primary' | 'green' | 'yellow' | 'red' | 'purple' | 'blue'
  subtitle?: string
  className?: string
}

export function CompactStatsCard({
  title,
  value,
  icon: Icon,
  iconColor = 'primary',
  subtitle,
  className,
}: CompactStatsCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md',
        className
      )}
    >
      <div className={cn('rounded-lg p-2.5 shrink-0', iconColorMap[iconColor])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-gray-400 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
