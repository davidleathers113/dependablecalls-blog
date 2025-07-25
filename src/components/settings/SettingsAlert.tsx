import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'

/**
 * Props for the SettingsAlert component
 */
export interface SettingsAlertProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Alert variant
   * @default 'info'
   */
  variant?: 'info' | 'success' | 'warning' | 'error'
  /**
   * Alert title
   */
  title?: string
  /**
   * Whether to show an icon
   * @default true
   */
  showIcon?: boolean
  /**
   * Custom icon (overrides default variant icon)
   */
  icon?: React.ReactNode
  /**
   * Whether the alert can be dismissed
   * @default false
   */
  dismissible?: boolean
  /**
   * Callback when alert is dismissed
   */
  onDismiss?: () => void
  /**
   * Actions to display in the alert
   */
  actions?: React.ReactNode
  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * An alert component for displaying important settings notices.
 * Supports multiple variants and dismissible behavior.
 *
 * @example
 * ```tsx
 * <SettingsAlert
 *   variant="warning"
 *   title="API Rate Limits"
 *   dismissible
 *   actions={
 *     <Button size="sm" variant="outline">View Documentation</Button>
 *   }
 * >
 *   You're approaching your monthly API call limit. Consider upgrading your plan.
 * </SettingsAlert>
 * ```
 */
const SettingsAlert = forwardRef<HTMLDivElement, SettingsAlertProps>(
  (
    {
      className = '',
      variant = 'info',
      title,
      showIcon = true,
      icon,
      dismissible = false,
      onDismiss,
      actions,
      size = 'md',
      children,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      info: {
        container: 'bg-blue-50 border-blue-200',
        icon: 'text-blue-400',
        title: 'text-blue-800',
        content: 'text-blue-700',
        dismiss: 'text-blue-500 hover:bg-blue-100 focus:ring-blue-600',
      },
      success: {
        container: 'bg-green-50 border-green-200',
        icon: 'text-green-400',
        title: 'text-green-800',
        content: 'text-green-700',
        dismiss: 'text-green-500 hover:bg-green-100 focus:ring-green-600',
      },
      warning: {
        container: 'bg-yellow-50 border-yellow-200',
        icon: 'text-yellow-400',
        title: 'text-yellow-800',
        content: 'text-yellow-700',
        dismiss: 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600',
      },
      error: {
        container: 'bg-red-50 border-red-200',
        icon: 'text-red-400',
        title: 'text-red-800',
        content: 'text-red-700',
        dismiss: 'text-red-500 hover:bg-red-100 focus:ring-red-600',
      },
    }

    const defaultIcons = {
      info: InformationCircleIcon,
      success: CheckCircleIcon,
      warning: ExclamationTriangleIcon,
      error: XCircleIcon,
    }

    const sizeClasses = {
      sm: {
        padding: 'p-3',
        icon: 'h-4 w-4',
        title: 'text-sm',
        content: 'text-xs',
        dismiss: 'h-4 w-4',
      },
      md: {
        padding: 'p-4',
        icon: 'h-5 w-5',
        title: 'text-sm',
        content: 'text-sm',
        dismiss: 'h-5 w-5',
      },
      lg: {
        padding: 'p-5',
        icon: 'h-6 w-6',
        title: 'text-base',
        content: 'text-sm',
        dismiss: 'h-5 w-5',
      },
    }

    const sizes = sizeClasses[size]
    const colors = variantClasses[variant]
    const DefaultIcon = defaultIcons[variant]

    const alertClasses = ['rounded-lg border', sizes.padding, colors.container, className]
      .filter(Boolean)
      .join(' ')

    return (
      <div ref={ref} className={alertClasses} role="alert" {...props}>
        <div className="flex">
          {showIcon && (
            <div className="flex-shrink-0">
              {icon || (
                <DefaultIcon className={`${sizes.icon} ${colors.icon}`} aria-hidden="true" />
              )}
            </div>
          )}
          <div className={`${showIcon ? 'ml-3' : ''} flex-1`}>
            {title && (
              <h3 className={`font-medium ${sizes.title} ${colors.title} mb-1`}>{title}</h3>
            )}
            {children && <div className={`${sizes.content} ${colors.content}`}>{children}</div>}
            {actions && <div className="mt-3">{actions}</div>}
          </div>
          {dismissible && (
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  type="button"
                  onClick={onDismiss}
                  className={`
                    inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${colors.dismiss}
                  `}
                  aria-label="Dismiss"
                >
                  <XMarkIcon className={sizes.dismiss} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
)

SettingsAlert.displayName = 'SettingsAlert'

export { SettingsAlert }
export default SettingsAlert
