import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  'rounded-xl border bg-white text-card-foreground',
  {
    variants: {
      variant: {
        default: 'shadow-sm',
        elevated: 'shadow-md',
        interactive:
          'shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer',
        ghost: 'border-transparent shadow-none bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, className }))}
      {...props}
    />
  )
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

// Card header with colored background
interface ColoredCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: 'primary' | 'green' | 'yellow' | 'red' | 'purple' | 'blue' | 'gray'
}

const colorMap = {
  primary: 'bg-primary-50 border-b border-primary-100',
  green: 'bg-green-50 border-b border-green-100',
  yellow: 'bg-yellow-50 border-b border-yellow-100',
  red: 'bg-red-50 border-b border-red-100',
  purple: 'bg-purple-50 border-b border-purple-100',
  blue: 'bg-blue-50 border-b border-blue-100',
  gray: 'bg-gray-50 border-b border-gray-100',
}

const ColoredCardHeader = React.forwardRef<HTMLDivElement, ColoredCardHeaderProps>(
  ({ className, color = 'gray', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-1.5 p-6 rounded-t-xl -m-px mb-0',
        colorMap[color],
        className
      )}
      {...props}
    />
  )
)
ColoredCardHeader.displayName = 'ColoredCardHeader'

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export {
  Card,
  CardHeader,
  ColoredCardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
}
