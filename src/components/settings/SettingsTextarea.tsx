import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

/**
 * Props for the SettingsTextarea component
 */
export interface SettingsTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * The label for the textarea
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
   * Help text to display below the textarea
   */
  helpText?: string
  /**
   * Whether to show character count
   * @default false
   */
  showCharCount?: boolean
  /**
   * Maximum character length (used with showCharCount)
   */
  maxLength?: number
  /**
   * Whether the textarea should auto-resize
   * @default false
   */
  autoResize?: boolean
  /**
   * Minimum number of rows
   * @default 3
   */
  minRows?: number
  /**
   * Maximum number of rows (for autoResize)
   * @default 10
   */
  maxRows?: number
}

/**
 * A textarea wrapper for longer text settings.
 * Supports auto-resize and character counting.
 *
 * @example
 * ```tsx
 * <SettingsTextarea
 *   label="Bio"
 *   description="Tell us about yourself"
 *   showCharCount
 *   maxLength={500}
 *   autoResize
 *   value={bio}
 *   onChange={(e) => setBio(e.target.value)}
 * />
 * ```
 */
const SettingsTextarea = forwardRef<HTMLTextAreaElement, SettingsTextareaProps>(
  (
    {
      label,
      description,
      error,
      helpText,
      showCharCount = false,
      maxLength,
      autoResize = false,
      minRows = 3,
      maxRows = 10,
      disabled = false,
      className = '',
      id,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`
    const charCount = value ? String(value).length : 0

    const baseClasses = [
      'block w-full rounded-md border-0 shadow-sm ring-1 ring-inset',
      'placeholder:text-gray-400 focus:ring-2 focus:ring-inset',
      'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
      'transition-colors duration-200',
      'py-2 px-3 text-sm',
      autoResize && 'resize-none overflow-hidden',
    ]
      .filter(Boolean)
      .join(' ')

    const stateClasses = error
      ? 'ring-red-300 focus:ring-red-500 bg-red-50'
      : 'ring-gray-300 focus:ring-blue-500 bg-white'

    const textareaClasses = [baseClasses, stateClasses, className].filter(Boolean).join(' ')

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        const target = e.target
        target.style.height = 'auto'
        const scrollHeight = target.scrollHeight
        const minHeight = minRows * 24 // Approximate line height
        const maxHeight = maxRows * 24
        target.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`
      }
      onChange?.(e)
    }

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        {description && <p className="mb-2 text-sm text-gray-500">{description}</p>}
        <div className="relative">
          <textarea
            ref={ref}
            id={textareaId}
            className={textareaClasses}
            disabled={disabled}
            rows={minRows}
            value={value}
            onChange={handleChange}
            maxLength={maxLength}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? `${textareaId}-error` : helpText ? `${textareaId}-help` : undefined
            }
            {...props}
          />
          {showCharCount && maxLength && (
            <div className="absolute bottom-2 right-2 pointer-events-none">
              <span
                className={`text-xs ${
                  charCount > maxLength * 0.9
                    ? 'text-red-600'
                    : charCount > maxLength * 0.75
                      ? 'text-yellow-600'
                      : 'text-gray-400'
                }`}
              >
                {charCount}/{maxLength}
              </span>
            </div>
          )}
        </div>
        {error && (
          <p id={`${textareaId}-error`} className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {helpText && !error && (
          <p id={`${textareaId}-help`} className="mt-2 text-sm text-gray-500">
            {helpText}
          </p>
        )}
      </div>
    )
  }
)

SettingsTextarea.displayName = 'SettingsTextarea'

export { SettingsTextarea }
export default SettingsTextarea
