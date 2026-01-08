import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary-100 text-primary-800',
        secondary:
          'border-transparent bg-secondary-100 text-secondary-800',
        success:
          'border-transparent bg-green-100 text-green-800',
        warning:
          'border-transparent bg-yellow-100 text-yellow-800',
        destructive:
          'border-transparent bg-red-100 text-red-800',
        info:
          'border-transparent bg-blue-100 text-blue-800',
        purple:
          'border-transparent bg-purple-100 text-purple-800',
        outline: 'text-foreground border-gray-300',
        'outline-success': 'text-green-700 border-green-300 bg-green-50',
        'outline-warning': 'text-yellow-700 border-yellow-300 bg-yellow-50',
        'outline-destructive': 'text-red-700 border-red-300 bg-red-50',
        'outline-info': 'text-blue-700 border-blue-300 bg-blue-50',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
  dotColor?: 'green' | 'yellow' | 'red' | 'blue' | 'gray'
}

const dotColorMap = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  gray: 'bg-gray-500',
}

function Badge({ className, variant, size, dot, dotColor = 'green', children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'mr-1.5 h-1.5 w-1.5 rounded-full',
            dotColorMap[dotColor]
          )}
        />
      )}
      {children}
    </div>
  )
}

// Status-specific badge with built-in colors
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'approved' | 'rejected' | 'completed' | 'draft' | 'published' | 'archived'
  className?: string
}

const statusConfig: Record<StatusBadgeProps['status'], { variant: BadgeProps['variant']; label: string; dot?: boolean; dotColor?: BadgeProps['dotColor'] }> = {
  active: { variant: 'success', label: 'Active', dot: true, dotColor: 'green' },
  inactive: { variant: 'secondary', label: 'Inactive', dot: true, dotColor: 'gray' },
  pending: { variant: 'warning', label: 'Pending', dot: true, dotColor: 'yellow' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'destructive', label: 'Rejected' },
  completed: { variant: 'success', label: 'Completed' },
  draft: { variant: 'secondary', label: 'Draft' },
  published: { variant: 'info', label: 'Published' },
  archived: { variant: 'outline', label: 'Archived' },
}

function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge
      variant={config.variant}
      dot={config.dot}
      dotColor={config.dotColor}
      className={className}
    >
      {config.label}
    </Badge>
  )
}

// Count badge (for notification counts, etc.)
interface CountBadgeProps {
  count: number
  max?: number
  variant?: BadgeProps['variant']
  className?: string
}

function CountBadge({ count, max = 99, variant = 'destructive', className }: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count

  if (count === 0) return null

  return (
    <Badge
      variant={variant}
      size="sm"
      className={cn('min-w-[1.25rem] justify-center', className)}
    >
      {displayCount}
    </Badge>
  )
}

export { Badge, StatusBadge, CountBadge, badgeVariants }
