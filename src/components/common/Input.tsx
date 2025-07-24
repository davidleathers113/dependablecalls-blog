import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  variant?: 'default' | 'filled'
  inputSize?: 'sm' | 'md' | 'lg'
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      error,
      helpText,
      leftIcon,
      rightIcon,
      variant = 'default',
      inputSize = 'md',
      disabled,
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

    const variantClasses = {
      default: [
        error
          ? 'ring-red-300 focus:ring-red-500 bg-red-50'
          : 'ring-gray-300 focus:ring-blue-500 bg-white',
        'text-gray-900',
      ].join(' '),
      filled: [
        error
          ? 'ring-red-300 focus:ring-red-500 bg-red-50'
          : 'ring-gray-300 focus:ring-blue-500 bg-gray-50',
        'text-gray-900',
      ].join(' '),
    }

    const sizeClasses = {
      sm: leftIcon || rightIcon ? 'py-1.5 pl-8 pr-3 text-sm' : 'py-1.5 px-3 text-sm',
      md: leftIcon || rightIcon ? 'py-2 pl-10 pr-4 text-sm' : 'py-2 px-4 text-sm',
      lg: leftIcon || rightIcon ? 'py-3 pl-12 pr-4 text-base' : 'py-3 px-4 text-base',
    }

    const iconSizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    }

    const iconPositionClasses = {
      sm: { left: 'left-2.5', right: 'right-2.5' },
      md: { left: 'left-3', right: 'right-3' },
      lg: { left: 'left-4', right: 'right-4' },
    }

    const classes = [baseClasses, variantClasses[variant], sizeClasses[inputSize], className]
      .filter(Boolean)
      .join(' ')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div
              className={`pointer-events-none absolute inset-y-0 left-0 flex items-center ${iconPositionClasses[inputSize].left}`}
            >
              <span className={`text-gray-400 ${iconSizeClasses[inputSize]}`}>{leftIcon}</span>
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={classes}
            disabled={disabled}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
            {...props}
          />
          {rightIcon && (
            <div
              className={`pointer-events-none absolute inset-y-0 right-0 flex items-center ${iconPositionClasses[inputSize].right}`}
            >
              <span className={`text-gray-400 ${iconSizeClasses[inputSize]}`}>{rightIcon}</span>
            </div>
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

Input.displayName = 'Input'

export { Input }
export default Input
