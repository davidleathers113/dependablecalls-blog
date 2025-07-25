import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

/**
 * Props for the SettingsField component
 */
export interface SettingsFieldProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The label for the field
   */
  label: string
  /**
   * Optional description text for the field
   */
  description?: string
  /**
   * Error message to display
   */
  error?: string
  /**
   * Whether the field is required
   * @default false
   */
  required?: boolean
  /**
   * Layout direction for label and input
   * @default 'vertical'
   */
  layout?: 'vertical' | 'horizontal'
  /**
   * For horizontal layout, the width of the label column
   * @default 'sm'
   */
  labelWidth?: 'sm' | 'md' | 'lg'
  /**
   * HTML for attribute to associate label with input
   */
  htmlFor?: string
}

/**
 * A field wrapper component that handles labels, descriptions, and error states.
 * Provides consistent styling for form fields in settings.
 *
 * @example
 * ```tsx
 * <SettingsField
 *   label="Display Name"
 *   description="This will be shown to other users"
 *   error={errors.displayName}
 *   htmlFor="display-name"
 * >
 *   <Input id="display-name" {...register('displayName')} />
 * </SettingsField>
 * ```
 */
const SettingsField = forwardRef<HTMLDivElement, SettingsFieldProps>(
  (
    {
      className = '',
      label,
      description,
      error,
      required = false,
      layout = 'vertical',
      labelWidth = 'sm',
      htmlFor,
      children,
      ...props
    },
    ref
  ) => {
    const containerClasses = [
      'space-y-1',
      layout === 'horizontal' && 'sm:grid sm:gap-4 sm:items-start',
      layout === 'horizontal' && labelWidth === 'sm' && 'sm:grid-cols-[200px_1fr]',
      layout === 'horizontal' && labelWidth === 'md' && 'sm:grid-cols-[250px_1fr]',
      layout === 'horizontal' && labelWidth === 'lg' && 'sm:grid-cols-[300px_1fr]',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    const labelClasses = [
      'block text-sm font-medium text-gray-700',
      layout === 'horizontal' && 'sm:pt-2',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div ref={ref} className={containerClasses} {...props}>
        <div>
          <label htmlFor={htmlFor} className={labelClasses}>
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
          </label>
          {layout === 'vertical' && description && !error && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
        <div>
          {children}
          {error && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {layout === 'horizontal' && description && !error && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>
    )
  }
)

SettingsField.displayName = 'SettingsField'

export { SettingsField }
export default SettingsField
