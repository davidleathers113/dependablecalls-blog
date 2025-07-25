import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Switch } from '@headlessui/react'

/**
 * Props for the SettingsToggle component
 */
export interface SettingsToggleProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  /**
   * The label for the toggle
   */
  label: string
  /**
   * Optional description text
   */
  description?: string
  /**
   * Whether the toggle is checked
   */
  checked?: boolean
  /**
   * Callback when toggle state changes
   */
  onChange?: (checked: boolean) => void
  /**
   * Error message to display
   */
  error?: string
  /**
   * Size of the toggle
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Layout direction
   * @default 'horizontal'
   */
  layout?: 'horizontal' | 'vertical'
}

/**
 * A toggle switch component for boolean settings.
 * Uses Headless UI Switch for accessibility.
 *
 * @example
 * ```tsx
 * <SettingsToggle
 *   label="Enable notifications"
 *   description="Receive alerts about important events"
 *   checked={notifications}
 *   onChange={setNotifications}
 * />
 * ```
 */
const SettingsToggle = forwardRef<HTMLInputElement, SettingsToggleProps>(
  (
    {
      label,
      description,
      checked = false,
      onChange,
      error,
      disabled = false,
      size = 'md',
      layout = 'horizontal',
      className = '',
      ...props
    },
    ref
  ) => {
    const id = useId()

    const sizeClasses = {
      sm: {
        switch: 'h-5 w-9',
        thumb: 'h-4 w-4',
        translate: 'translate-x-4',
      },
      md: {
        switch: 'h-6 w-11',
        thumb: 'h-5 w-5',
        translate: 'translate-x-5',
      },
      lg: {
        switch: 'h-7 w-14',
        thumb: 'h-6 w-6',
        translate: 'translate-x-7',
      },
    }

    const sizes = sizeClasses[size]

    const containerClasses = [
      layout === 'horizontal' ? 'flex items-start justify-between' : 'space-y-2',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={containerClasses}>
        <div className={layout === 'horizontal' ? 'flex-1 mr-4' : ''}>
          <label htmlFor={id} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          {error && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
        <Switch
          id={id}
          checked={checked}
          onChange={onChange || (() => {})}
          disabled={disabled}
          className={`
            ${checked ? 'bg-blue-600' : 'bg-gray-200'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            relative inline-flex ${sizes.switch} flex-shrink-0 items-center rounded-full 
            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 
            focus:ring-blue-500 focus:ring-offset-2
          `}
        >
          <span className="sr-only">{label}</span>
          <span
            aria-hidden="true"
            className={`
              ${checked ? sizes.translate : 'translate-x-0.5'}
              pointer-events-none inline-block ${sizes.thumb} transform rounded-full 
              bg-white shadow ring-0 transition duration-200 ease-in-out
            `}
          />
        </Switch>
        {/* Hidden input for form libraries like react-hook-form */}
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
      </div>
    )
  }
)

SettingsToggle.displayName = 'SettingsToggle'

export { SettingsToggle }
export default SettingsToggle
