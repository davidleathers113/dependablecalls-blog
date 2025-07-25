import { forwardRef } from 'react'
import { RadioGroup } from '@headlessui/react'

/**
 * Option type for radio items
 */
export interface RadioOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

/**
 * Props for the SettingsRadioGroup component
 */
export interface SettingsRadioGroupProps {
  /**
   * The label for the radio group
   */
  label?: string
  /**
   * Optional description text
   */
  description?: string
  /**
   * Radio options
   */
  options: RadioOption[]
  /**
   * Selected value
   */
  value?: string
  /**
   * Callback when selection changes
   */
  onChange?: (value: string) => void
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
  layout?: 'vertical' | 'horizontal'
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
 * A radio button group for exclusive choices.
 * Uses Headless UI RadioGroup for accessibility.
 *
 * @example
 * ```tsx
 * <SettingsRadioGroup
 *   label="Notification Frequency"
 *   options={[
 *     { value: 'instant', label: 'Instant', description: 'Get notified immediately' },
 *     { value: 'daily', label: 'Daily Digest', description: 'Once per day summary' },
 *     { value: 'weekly', label: 'Weekly', description: 'Weekly roundup' }
 *   ]}
 *   value={frequency}
 *   onChange={setFrequency}
 * />
 * ```
 */
const SettingsRadioGroup = forwardRef<HTMLDivElement, SettingsRadioGroupProps>(
  (
    {
      label,
      description,
      options,
      value,
      onChange,
      error,
      disabled = false,
      layout = 'vertical',
      size = 'md',
      className = '',
    },
    ref
  ) => {
    const sizeClasses = {
      sm: {
        radio: 'h-4 w-4',
        label: 'text-sm',
        description: 'text-xs',
      },
      md: {
        radio: 'h-5 w-5',
        label: 'text-sm',
        description: 'text-sm',
      },
      lg: {
        radio: 'h-6 w-6',
        label: 'text-base',
        description: 'text-sm',
      },
    }

    const sizes = sizeClasses[size]

    const optionsContainerClasses = [
      'mt-2',
      layout === 'horizontal' ? 'flex flex-wrap gap-6' : 'space-y-3',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div ref={ref} className={className}>
        <RadioGroup value={value} onChange={onChange} disabled={disabled}>
          {label && (
            <RadioGroup.Label className="block text-sm font-medium text-gray-700">
              {label}
            </RadioGroup.Label>
          )}
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          <div className={optionsContainerClasses}>
            {options.map((option) => (
              <RadioGroup.Option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={({ active, checked }) =>
                  [
                    'relative flex cursor-pointer rounded-lg px-4 py-3',
                    'focus:outline-none',
                    disabled || option.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer',
                    checked
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-white border-2 border-gray-200',
                    active && !disabled && !option.disabled
                      ? 'ring-2 ring-blue-500 ring-offset-2'
                      : '',
                    layout === 'horizontal' ? 'flex-1 min-w-[200px]' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
              >
                {({ checked }) => (
                  <div className="flex items-start w-full">
                    <div className="flex items-center">
                      <div
                        className={`
                          ${sizes.radio} rounded-full border-2 flex items-center justify-center
                          ${checked ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'}
                        `}
                      >
                        {checked && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <RadioGroup.Label
                        as="p"
                        className={`font-medium ${sizes.label} ${
                          checked ? 'text-blue-900' : 'text-gray-900'
                        }`}
                      >
                        {option.label}
                      </RadioGroup.Label>
                      {option.description && (
                        <RadioGroup.Description
                          as="p"
                          className={`mt-1 ${sizes.description} ${
                            checked ? 'text-blue-700' : 'text-gray-500'
                          }`}
                        >
                          {option.description}
                        </RadioGroup.Description>
                      )}
                    </div>
                  </div>
                )}
              </RadioGroup.Option>
            ))}
          </div>
        </RadioGroup>
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

SettingsRadioGroup.displayName = 'SettingsRadioGroup'

export { SettingsRadioGroup }
export default SettingsRadioGroup
