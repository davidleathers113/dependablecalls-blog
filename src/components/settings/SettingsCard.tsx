import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

/**
 * Props for the SettingsCard component
 */
export interface SettingsCardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Title for the card
   */
  title?: string
  /**
   * Description text
   */
  description?: string
  /**
   * Icon to display with the title
   */
  icon?: React.ReactNode
  /**
   * Actions to display in the card header
   */
  actions?: React.ReactNode
  /**
   * Footer content
   */
  footer?: React.ReactNode
  /**
   * Variant style
   * @default 'default'
   */
  variant?: 'default' | 'bordered' | 'elevated' | 'warning' | 'info'
  /**
   * Padding size
   * @default 'md'
   */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /**
   * Whether the card is collapsible
   * @default false
   */
  collapsible?: boolean
  /**
   * Whether the card is initially collapsed
   * @default false
   */
  defaultCollapsed?: boolean
}

/**
 * A card component specifically designed for settings sections.
 * Provides consistent styling and optional collapsible behavior.
 *
 * @example
 * ```tsx
 * <SettingsCard
 *   title="Advanced Settings"
 *   description="Configure advanced features"
 *   icon={<CogIcon className="h-5 w-5" />}
 *   variant="warning"
 *   collapsible
 * >
 *   <SettingsToggle label="Developer mode" />
 *   <SettingsToggle label="Experimental features" />
 * </SettingsCard>
 * ```
 */
const SettingsCard = forwardRef<HTMLDivElement, SettingsCardProps>(
  (
    {
      className = '',
      title,
      description,
      icon,
      actions,
      footer,
      variant = 'default',
      padding = 'md',
      collapsible = false,
      defaultCollapsed = false,
      children,
      ...props
    },
    ref
  ) => {
    const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)

    const baseClasses = 'rounded-lg transition-all duration-200'

    const variantClasses = {
      default: 'bg-white shadow-sm border border-gray-200',
      bordered: 'bg-white border-2 border-gray-300',
      elevated: 'bg-white shadow-lg',
      warning: 'bg-yellow-50 border border-yellow-200',
      info: 'bg-blue-50 border border-blue-200',
    }

    const paddingClasses = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    }

    const cardClasses = [baseClasses, variantClasses[variant], paddingClasses[padding], className]
      .filter(Boolean)
      .join(' ')

    const iconColorClasses = {
      default: 'text-gray-400',
      bordered: 'text-gray-400',
      elevated: 'text-gray-400',
      warning: 'text-yellow-600',
      info: 'text-blue-600',
    }

    const titleColorClasses = {
      default: 'text-gray-900',
      bordered: 'text-gray-900',
      elevated: 'text-gray-900',
      warning: 'text-yellow-900',
      info: 'text-blue-900',
    }

    const descriptionColorClasses = {
      default: 'text-gray-600',
      bordered: 'text-gray-600',
      elevated: 'text-gray-600',
      warning: 'text-yellow-700',
      info: 'text-blue-700',
    }

    const hasHeader = title || description || icon || actions || collapsible

    return (
      <div ref={ref} className={cardClasses} {...props}>
        {hasHeader && (
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start">
              {icon && (
                <div className="flex-shrink-0 mr-3">
                  <span className={iconColorClasses[variant]}>{icon}</span>
                </div>
              )}
              <div className="flex-1">
                {title && (
                  <h3 className={`text-lg font-medium ${titleColorClasses[variant]}`}>{title}</h3>
                )}
                {description && (
                  <p className={`mt-1 text-sm ${descriptionColorClasses[variant]}`}>
                    {description}
                  </p>
                )}
              </div>
            </div>
            <div className="ml-4 flex-shrink-0 flex items-center gap-2">
              {actions}
              {collapsible && (
                <button
                  type="button"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className={`
                    p-1 rounded-md transition-colors duration-200
                    ${variant === 'warning' ? 'hover:bg-yellow-100' : ''}
                    ${variant === 'info' ? 'hover:bg-blue-100' : ''}
                    ${variant === 'default' || variant === 'bordered' || variant === 'elevated' ? 'hover:bg-gray-100' : ''}
                  `}
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                >
                  <svg
                    className={`h-5 w-5 transition-transform duration-200 ${
                      isCollapsed ? 'rotate-180' : ''
                    } ${iconColorClasses[variant]}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
        {(!collapsible || !isCollapsed) && (
          <>
            <div className={hasHeader && (icon || collapsible) ? 'ml-8' : ''}>{children}</div>
            {footer && (
              <div
                className={`
                  mt-6 pt-4 border-t
                  ${variant === 'warning' ? 'border-yellow-200' : ''}
                  ${variant === 'info' ? 'border-blue-200' : ''}
                  ${variant === 'default' || variant === 'bordered' || variant === 'elevated' ? 'border-gray-200' : ''}
                `}
              >
                {footer}
              </div>
            )}
          </>
        )}
      </div>
    )
  }
)

SettingsCard.displayName = 'SettingsCard'

// Import React for useState
import React from 'react'

export { SettingsCard }
export default SettingsCard
