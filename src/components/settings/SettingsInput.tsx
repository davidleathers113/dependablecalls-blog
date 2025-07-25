import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

/**
 * Props for the SettingsInput component
 */
export interface SettingsInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * The label for the input
   */
  label?: string
  /**
   * Optional description text
   */
  description?: string
  /**
   * Error message to display
   */
  error?: string
  /**
   * Help text to display below the input
   */
  helpText?: string
  /**
   * Icon to display on the left side
   */
  leftIcon?: React.ReactNode
  /**
   * Icon to display on the right side
   */
  rightIcon?: React.ReactNode
  /**
   * Addon text or element to display on the left
   */
  leftAddon?: React.ReactNode
  /**
   * Addon text or element to display on the right
   */
  rightAddon?: React.ReactNode
  /**
   * Size variant
   * @default 'md'
   */
  inputSize?: 'sm' | 'md' | 'lg'
}

/**
 * An input field wrapper for text/number settings.
 * Extends basic input with settings-specific features.
 *
 * @example
 * ```tsx
 * <SettingsInput
 *   label="API Key"
 *   type="password"
 *   leftIcon={<KeyIcon className="h-5 w-5" />}
 *   rightAddon={
 *     <Button size="sm" variant="ghost">Copy</Button>
 *   }
 *   value={apiKey}
 *   onChange={(e) => setApiKey(e.target.value)}
 * />
 * ```
 */
const SettingsInput = forwardRef<HTMLInputElement, SettingsInputProps>(
  (
    {
      label,
      description,
      error,
      helpText,
      leftIcon,
      rightIcon,
      leftAddon,
      rightAddon,
      inputSize = 'md',
      disabled = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

    const baseClasses = [
      'block w-full rounded-md border-0 shadow-sm ring-1 ring-inset',
      'placeholder:text-gray-400 focus:ring-2 focus:ring-inset',
      'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
      'transition-colors duration-200',
    ].join(' ')

    const stateClasses = error
      ? 'ring-red-300 focus:ring-red-500 bg-red-50'
      : 'ring-gray-300 focus:ring-blue-500 bg-white'

    const sizeClasses = {
      sm: {
        input: leftIcon || rightIcon ? 'py-1.5 pl-8 pr-3 text-sm' : 'py-1.5 px-3 text-sm',
        icon: 'h-4 w-4',
        iconPosition: { left: 'left-2.5', right: 'right-2.5' },
      },
      md: {
        input: leftIcon || rightIcon ? 'py-2 pl-10 pr-4 text-sm' : 'py-2 px-4 text-sm',
        icon: 'h-5 w-5',
        iconPosition: { left: 'left-3', right: 'right-3' },
      },
      lg: {
        input: leftIcon || rightIcon ? 'py-3 pl-12 pr-4 text-base' : 'py-3 px-4 text-base',
        icon: 'h-6 w-6',
        iconPosition: { left: 'left-4', right: 'right-4' },
      },
    }

    const sizes = sizeClasses[inputSize]

    const inputClasses = [
      baseClasses,
      stateClasses,
      sizes.input,
      leftAddon && 'rounded-l-none',
      rightAddon && 'rounded-r-none',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const addonClasses = [
      'inline-flex items-center px-3 text-gray-500 bg-gray-50 border border-gray-300',
      inputSize === 'sm' && 'text-sm',
      inputSize === 'md' && 'text-sm',
      inputSize === 'lg' && 'text-base',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        {description && <p className="mb-2 text-sm text-gray-500">{description}</p>}
        <div className="relative flex">
          {leftAddon && (
            <span className={`${addonClasses} rounded-l-md border-r-0`}>{leftAddon}</span>
          )}
          <div className="relative flex-1">
            {leftIcon && !leftAddon && (
              <div
                className={`pointer-events-none absolute inset-y-0 left-0 flex items-center ${sizes.iconPosition.left}`}
              >
                <span className={`text-gray-400 ${sizes.icon}`}>{leftIcon}</span>
              </div>
            )}
            <input
              ref={ref}
              id={inputId}
              className={inputClasses}
              disabled={disabled}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={
                error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined
              }
              {...props}
            />
            {rightIcon && !rightAddon && (
              <div
                className={`pointer-events-none absolute inset-y-0 right-0 flex items-center ${sizes.iconPosition.right}`}
              >
                <span className={`text-gray-400 ${sizes.icon}`}>{rightIcon}</span>
              </div>
            )}
          </div>
          {rightAddon && (
            <span className={`${addonClasses} rounded-r-md border-l-0`}>{rightAddon}</span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {helpText && !error && (
          <p id={`${inputId}-help`} className="mt-2 text-sm text-gray-500">
            {helpText}
          </p>
        )}
      </div>
    )
  }
)

SettingsInput.displayName = 'SettingsInput'

export { SettingsInput }
export default SettingsInput
