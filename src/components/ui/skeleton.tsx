import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className
      )}
    />
  )
}

// Pre-built skeleton variants
export function SkeletonText({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-4 w-full', className)} />
}

export function SkeletonHeading({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-6 w-3/4', className)} />
}

export function SkeletonCircle({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />
}

export function SkeletonAvatar({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-12 w-12 rounded-full', className)} />
}

// Skeleton for stats card
export function SkeletonStatsCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-xl border bg-white p-6 shadow-sm', className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-24 mb-4" />
      <div className="pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// Skeleton for table row
export function SkeletonTableRow({ columns = 4, className }: SkeletonProps & { columns?: number }) {
  return (
    <div className={cn('flex items-center gap-4 p-4 border-b', className)}>
      <SkeletonCircle className="h-10 w-10" />
      <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns - 1}, 1fr)` }}>
        {Array.from({ length: columns - 1 }).map((_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>
    </div>
  )
}

// Skeleton for card content
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-xl border bg-white p-6 shadow-sm space-y-4', className)}>
      <div className="flex items-center justify-between">
        <SkeletonHeading className="w-1/3" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
      <div className="space-y-3">
        <SkeletonText />
        <SkeletonText className="w-5/6" />
        <SkeletonText className="w-4/6" />
      </div>
    </div>
  )
}

// Skeleton for list item
export function SkeletonListItem({ className }: SkeletonProps) {
  return (
    <div className={cn('flex items-center gap-4 p-4', className)}>
      <SkeletonAvatar />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}

// Grid of skeleton cards
interface SkeletonGridProps {
  count?: number
  columns?: { sm?: number; md?: number; lg?: number }
  className?: string
}

export function SkeletonStatsGrid({
  count = 4,
  columns = { sm: 2, lg: 4 },
  className,
}: SkeletonGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns.sm && `sm:grid-cols-${columns.sm}`,
        columns.md && `md:grid-cols-${columns.md}`,
        columns.lg && `lg:grid-cols-${columns.lg}`,
        className
      )}
      style={{
        gridTemplateColumns: `repeat(${columns.lg || columns.md || columns.sm || 1}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStatsCard key={i} />
      ))}
    </div>
  )
}
