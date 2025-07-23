import { forwardRef, HTMLAttributes } from 'react'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
  removable?: boolean
  onRemove?: () => void
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className = '',
      variant = 'default',
      size = 'md',
      dot = false,
      removable = false,
      onRemove,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = [
      'inline-flex items-center font-medium rounded-full',
      'transition-colors duration-200',
    ].join(' ')

    const variantClasses = {
      default: 'bg-gray-100 text-gray-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      danger: 'bg-red-100 text-red-800',
      info: 'bg-blue-100 text-blue-800',
      neutral: 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/10',
    }

    const sizeClasses = {
      sm: dot ? 'h-5 w-5' : 'px-2 py-0.5 text-xs',
      md: dot ? 'h-6 w-6' : 'px-2.5 py-0.5 text-xs',
      lg: dot ? 'h-7 w-7' : 'px-3 py-1 text-sm',
    }

    const classes = [baseClasses, variantClasses[variant], sizeClasses[size], className]
      .filter(Boolean)
      .join(' ')

    if (dot) {
      return <span ref={ref} className={classes} {...props} />
    }

    return (
      <span ref={ref} className={classes} {...props}>
        {children}
        {removable && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-current hover:bg-opacity-20"
            aria-label="Remove badge"
          >
            <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M1 1l6 6m0-6L1 7"
              />
            </svg>
          </button>
        )}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

// Status Badge component for common status indicators
export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: 'active' | 'inactive' | 'pending' | 'success' | 'failed' | 'paused' | 'draft' | 'archived'
}

const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(({ status, ...props }, ref) => {
  const statusVariantMap = {
    active: 'success' as const,
    inactive: 'neutral' as const,
    pending: 'warning' as const,
    success: 'success' as const,
    failed: 'danger' as const,
    paused: 'warning' as const,
    draft: 'neutral' as const,
    archived: 'danger' as const,
  }

  const statusTextMap = {
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    success: 'Success',
    failed: 'Failed',
    paused: 'Paused',
    draft: 'Draft',
    archived: 'Archived',
  }

  return (
    <Badge ref={ref} variant={statusVariantMap[status]} {...props}>
      {statusTextMap[status]}
    </Badge>
  )
})

StatusBadge.displayName = 'StatusBadge'

// Number Badge component for counts and notifications
export interface NumberBadgeProps extends Omit<BadgeProps, 'children'> {
  count: number
  max?: number
  showZero?: boolean
}

const NumberBadge = forwardRef<HTMLSpanElement, NumberBadgeProps>(
  ({ count, max = 99, showZero = false, ...props }, ref) => {
    if (count === 0 && !showZero) {
      return null
    }

    const displayCount = count > max ? `${max}+` : count.toString()

    return (
      <Badge ref={ref} {...props}>
        {displayCount}
      </Badge>
    )
  }
)

NumberBadge.displayName = 'NumberBadge'

export { Badge, StatusBadge, NumberBadge }
export default Badge
