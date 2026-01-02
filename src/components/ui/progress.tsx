import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  showLabel?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, showLabel = false, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    return (
      <div className="w-full">
        <div
          ref={ref}
          className={cn(
            'relative h-3 w-full overflow-hidden rounded-full bg-secondary-100',
            className
          )}
          {...props}
        >
          <div
            className={cn(
              'h-full transition-all duration-300 ease-in-out rounded-full',
              percentage >= 100
                ? 'bg-green-500'
                : percentage >= 75
                ? 'bg-primary-500'
                : percentage >= 50
                ? 'bg-yellow-500'
                : 'bg-red-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showLabel && (
          <p className="mt-1 text-sm text-gray-600">
            {Math.round(percentage)}% complete
          </p>
        )}
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
