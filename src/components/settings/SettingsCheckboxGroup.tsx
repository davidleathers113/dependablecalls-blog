import { forwardRef, useId } from 'react'

/**
 * Option type for checkbox items
 */
export interface CheckboxOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

/**
 * Props for the SettingsCheckboxGroup component
 */
export interface SettingsCheckboxGroupProps {
  /**
   * The label for the checkbox group
   */
  label?: string
  /**
   * Optional description text
   */
  description?: string
  /**
   * Checkbox options
   */
  options: CheckboxOption[]
  /**
   * Selected values
   */
  values?: string[]
  /**
   * Callback when selection changes
   */
  onChange?: (values: string[]) => void
  /**
   * Error message to display
   */
  error?: string
  /**
   * Whether the group is disabled
   * @default false
   */
  disabled?: boolean
  /**
   * Layout direction for options
   * @default 'vertical'
   */
  layout?: 'vertical' | 'horizontal' | 'grid'
  /**
   * Number of columns for grid layout
   * @default 2
   */
  gridCols?: 1 | 2 | 3 | 4
  /**
   * Size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * A checkbox group for multiple selections.
 * Supports various layouts including grid.
 *
 * @example
 * ```tsx
 * <SettingsCheckboxGroup
 *   label="Email Preferences"
 *   options={[
 *     { value: 'marketing', label: 'Marketing emails' },
 *     { value: 'updates', label: 'Product updates' },
 *     { value: 'digest', label: 'Weekly digest' },
 *     { value: 'tips', label: 'Tips and tutorials' }
 *   ]}
 *   values={emailPrefs}
 *   onChange={setEmailPrefs}
 *   layout="grid"
 *   gridCols={2}
 * />
 * ```
 */
const SettingsCheckboxGroup = forwardRef<HTMLDivElement, SettingsCheckboxGroupProps>(
  (
    {
      label,
      description,
      options,
      values = [],
      onChange,
      error,
      disabled = false,
      layout = 'vertical',
      gridCols = 2,
      size = 'md',
      className = '',
    },
    ref
  ) => {
    const groupId = useId()

    const sizeClasses = {
      sm: {
        checkbox: 'h-4 w-4',
        label: 'text-sm',
        description: 'text-xs',
        spacing: 'space-y-2',
      },
      md: {
        checkbox: 'h-5 w-5',
        label: 'text-sm',
        description: 'text-sm',
        spacing: 'space-y-3',
      },
      lg: {
        checkbox: 'h-6 w-6',
        label: 'text-base',
        description: 'text-sm',
        spacing: 'space-y-4',
      },
    }

    const sizes = sizeClasses[size]

    const layoutClasses = {
      vertical: sizes.spacing,
      horizontal: 'flex flex-wrap gap-6',
      grid: `grid gap-4 grid-cols-1 sm:grid-cols-${gridCols}`,
    }

    const handleCheckboxChange = (optionValue: string, checked: boolean) => {
      if (!onChange) return

      if (checked) {
        onChange([...values, optionValue])
      } else {
        onChange(values.filter((v) => v !== optionValue))
      }
    }

    return (
      <div ref={ref} className={className}>
        {label && <h3 className="block text-sm font-medium text-gray-700 mb-1">{label}</h3>}
        {description && <p className="text-sm text-gray-500 mb-3">{description}</p>}
        <div
          className={`mt-2 ${layoutClasses[layout]}`}
          role="group"
          aria-labelledby={label ? `${groupId}-label` : undefined}
          aria-describedby={error ? `${groupId}-error` : undefined}
        >
          {options.map((option) => {
            const optionId = `${groupId}-${option.value}`
            const isChecked = values.includes(option.value)
            const isDisabled = disabled || option.disabled

            return (
              <div
                key={option.value}
                className={`relative flex ${option.description ? 'items-start' : 'items-center'}`}
              >
                <div className="flex items-center h-5">
                  <input
                    id={optionId}
                    type="checkbox"
                    value={option.value}
                    checked={isChecked}
                    onChange={(e) => handleCheckboxChange(option.value, e.target.checked)}
                    disabled={isDisabled}
                    className={`
                      ${sizes.checkbox} rounded border-gray-300 text-blue-600
                      focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                      disabled:opacity-50 disabled:cursor-not-allowed
                      cursor-pointer transition-colors duration-200
                    `}
                    aria-describedby={option.description ? `${optionId}-description` : undefined}
                  />
                </div>
                <div className="ml-3">
                  <label
                    htmlFor={optionId}
                    className={`
                      ${sizes.label} font-medium text-gray-700
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {option.label}
                  </label>
                  {option.description && (
                    <p
                      id={`${optionId}-description`}
                      className={`mt-1 ${sizes.description} text-gray-500`}
                    >
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {error && (
          <p id={`${groupId}-error`} className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

SettingsCheckboxGroup.displayName = 'SettingsCheckboxGroup'

export { SettingsCheckboxGroup }
export default SettingsCheckboxGroup
