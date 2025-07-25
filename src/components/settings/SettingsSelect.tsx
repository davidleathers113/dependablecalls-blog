import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'

/**
 * Option type for select items
 */
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

/**
 * Props for the SettingsSelect component
 */
export interface SettingsSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * The label for the select
   */
  label?: string
  /**
   * Options for the select dropdown
   */
  options: SelectOption[]
  /**
   * Optional description text
   */
  description?: string
  /**
   * Error message to display
   */
  error?: string
  /**
   * Help text to display below the select
   */
  helpText?: string
  /**
   * Whether to show a placeholder option
   * @default true
   */
  showPlaceholder?: boolean
  /**
   * Placeholder text
   * @default 'Select an option'
   */
  placeholder?: string
  /**
   * Size variant
   * @default 'md'
   */
  selectSize?: 'sm' | 'md' | 'lg'
}

/**
 * A select dropdown component for enum-type settings.
 * Provides consistent styling with other form components.
 *
 * @example
 * ```tsx
 * <SettingsSelect
 *   label="Time Zone"
 *   options={[
 *     { value: 'EST', label: 'Eastern Time' },
 *     { value: 'PST', label: 'Pacific Time' }
 *   ]}
 *   value={timezone}
 *   onChange={(e) => setTimezone(e.target.value)}
 * />
 * ```
 */
const SettingsSelect = forwardRef<HTMLSelectElement, SettingsSelectProps>(
  (
    {
      label,
      options,
      description,
      error,
      helpText,
      showPlaceholder = true,
      placeholder = 'Select an option',
      selectSize = 'md',
      disabled = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`

    const baseClasses = [
      'block w-full rounded-md border-0 shadow-sm ring-1 ring-inset',
      'appearance-none bg-white pr-10',
      'placeholder:text-gray-400 focus:ring-2 focus:ring-inset',
      'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
      'transition-colors duration-200',
    ].join(' ')

    const stateClasses = error
      ? 'ring-red-300 focus:ring-red-500 bg-red-50 text-red-900'
      : 'ring-gray-300 focus:ring-blue-500 text-gray-900'

    const sizeClasses = {
      sm: 'py-1.5 pl-3 pr-10 text-sm',
      md: 'py-2 pl-3 pr-10 text-sm',
      lg: 'py-3 pl-4 pr-10 text-base',
    }

    const selectClasses = [baseClasses, stateClasses, sizeClasses[selectSize], className]
      .filter(Boolean)
      .join(' ')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        {description && <p className="mb-2 text-sm text-gray-500">{description}</p>}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={selectClasses}
            disabled={disabled}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined
            }
            {...props}
          >
            {showPlaceholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <ChevronDownIcon
              className={`h-5 w-5 ${error ? 'text-red-400' : 'text-gray-400'}`}
              aria-hidden="true"
            />
          </div>
        </div>
        {error && (
          <p id={`${selectId}-error`} className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {helpText && !error && (
          <p id={`${selectId}-help`} className="mt-2 text-sm text-gray-500">
            {helpText}
          </p>
        )}
      </div>
    )
  }
)

SettingsSelect.displayName = 'SettingsSelect'

export { SettingsSelect }
export default SettingsSelect
