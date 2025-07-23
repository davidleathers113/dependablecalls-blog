import { forwardRef, HTMLAttributes } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  clickable?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className = '',
      variant = 'default',
      padding = 'md',
      hover = false,
      clickable = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = [
      'rounded-lg transition-all duration-200',
      hover && 'hover:shadow-md',
      clickable && 'cursor-pointer',
    ]
      .filter(Boolean)
      .join(' ')

    const variantClasses = {
      default: 'bg-white shadow-sm',
      bordered: 'bg-white border border-gray-200',
      elevated: 'bg-white shadow-lg',
    }

    const paddingClasses = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    }

    const classes = [baseClasses, variantClasses[variant], paddingClasses[padding], className]
      .filter(Boolean)
      .join(' ')

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

// Card sub-components
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  actions?: React.ReactNode
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', title, description, actions, children, ...props }, ref) => {
    const classes = `flex items-center justify-between pb-4 border-b border-gray-200 ${className}`

    return (
      <div ref={ref} className={classes} {...props}>
        <div className="min-w-0 flex-1">
          {title && <h3 className="text-lg font-semibold text-gray-900 truncate">{title}</h3>}
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          {children}
        </div>
        {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
      </div>
    )
  }
)

CardHeader.displayName = 'CardHeader'

export type CardContentProps = HTMLAttributes<HTMLDivElement>

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', ...props }, ref) => {
    const classes = `py-4 ${className}`
    return <div ref={ref} className={classes} {...props} />
  }
)

CardContent.displayName = 'CardContent'

export type CardFooterProps = HTMLAttributes<HTMLDivElement>

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', ...props }, ref) => {
    const classes = `pt-4 border-t border-gray-200 ${className}`
    return <div ref={ref} className={classes} {...props} />
  }
)

CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardContent, CardFooter }
export default Card
