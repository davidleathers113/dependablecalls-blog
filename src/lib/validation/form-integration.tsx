/**
 * Form Integration Examples and Utilities
 * Demonstrates how to use DCE validation schemas with React Hook Form
 * 
 * CRITICAL: NO regex patterns anywhere - uses Zod + validator.js only
 * Follows DCE security patterns and TypeScript 5.8 strict typing
 */

import { useForm, SubmitHandler, FormProvider, useFormContext } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ReactNode, forwardRef } from 'react'
import {
  LoginFormData,
  loginSchema,
  ContactFormData,
  contactFormSchema
} from './index'
import { formatValidationErrors, ValidationErrors, getFieldError } from './utils'

/**
 * Generic form wrapper component with validation
 */
interface FormWrapperProps<T extends Record<string, unknown>> {
  schema: z.ZodSchema<T>
  onSubmit: SubmitHandler<T>
  defaultValues?: Partial<T>
  mode?: 'onChange' | 'onBlur' | 'onSubmit' | 'onTouched' | 'all'
  children: ReactNode
  className?: string
}

export function FormWrapper<T extends Record<string, unknown>>({
  schema,
  onSubmit,
  defaultValues,
  mode = 'onChange',
  children,
  className = ''
}: FormWrapperProps<T>) {
  const methods = useForm({
    resolver: zodResolver(schema),
    mode,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: defaultValues as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const handleSubmit = (data: T) => {
    onSubmit(data)
  }

  return (
    <FormProvider {...methods}>
      <form 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSubmit={methods.handleSubmit(handleSubmit as any)} 
        className={className}
        noValidate
      >
        {children}
      </form>
    </FormProvider>
  )
}

/**
 * Input field component with integrated validation
 */
interface FormInputProps {
  name: string
  label: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number'
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  description?: string
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(({
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  className = '',
  description,
  ...props
}, ref) => {
  const { 
    register, 
    formState: { errors } 
  } = useFormContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const error = getFieldError(errors as any, name)
  const hasError = Boolean(error)

  return (
    <div className="space-y-1">
      <label 
        htmlFor={name} 
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}
      
      <input
        {...register(name)}
        ref={ref}
        id={name}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          mt-1 block w-full px-3 py-2 border rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${hasError 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          ${className}
        `}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : undefined}
        {...props}
      />
      
      {hasError && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

FormInput.displayName = 'FormInput'

/**
 * Select field component with validation
 */
interface FormSelectProps {
  name: string
  label: string
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(({
  name,
  label,
  options,
  placeholder = 'Select an option...',
  required = false,
  disabled = false,
  className = ''
}, ref) => {
  const { 
    register, 
    formState: { errors } 
  } = useFormContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const error = getFieldError(errors as any, name)
  const hasError = Boolean(error)

  return (
    <div className="space-y-1">
      <label 
        htmlFor={name} 
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <select
        {...register(name)}
        ref={ref}
        id={name}
        disabled={disabled}
        className={`
          mt-1 block w-full px-3 py-2 border rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${hasError 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          ${className}
        `}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {hasError && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

FormSelect.displayName = 'FormSelect'

/**
 * Textarea component with validation
 */
interface FormTextareaProps {
  name: string
  label: string
  placeholder?: string
  rows?: number
  required?: boolean
  disabled?: boolean
  className?: string
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(({
  name,
  label,
  placeholder,
  rows = 4,
  required = false,
  disabled = false,
  className = ''
}, ref) => {
  const { 
    register, 
    formState: { errors } 
  } = useFormContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const error = getFieldError(errors as any, name)
  const hasError = Boolean(error)

  return (
    <div className="space-y-1">
      <label 
        htmlFor={name} 
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <textarea
        {...register(name)}
        ref={ref}
        id={name}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          mt-1 block w-full px-3 py-2 border rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${hasError 
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          ${className}
        `}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : undefined}
      />
      
      {hasError && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

FormTextarea.displayName = 'FormTextarea'

/**
 * Checkbox component with validation
 */
interface FormCheckboxProps {
  name: string
  label: string
  description?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(({
  name,
  label,
  description,
  required = false,
  disabled = false,
  className = ''
}, ref) => {
  const { 
    register, 
    formState: { errors } 
  } = useFormContext()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const error = getFieldError(errors as any, name)
  const hasError = Boolean(error)

  return (
    <div className="space-y-1">
      <div className="flex items-start">
        <input
          {...register(name)}
          ref={ref}
          id={name}
          type="checkbox"
          disabled={disabled}
          className={`
            h-4 w-4 rounded border-gray-300 text-primary-600 
            focus:ring-primary-500 focus:ring-offset-0
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
            ${className}
          `}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${name}-error` : undefined}
        />
        <div className="ml-3">
          <label 
            htmlFor={name} 
            className={`text-sm font-medium text-gray-700 ${
              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>
      
      {hasError && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

FormCheckbox.displayName = 'FormCheckbox'

/**
 * Submit button component
 */
interface FormSubmitProps {
  children: ReactNode
  disabled?: boolean
  loading?: boolean
  className?: string
}

export function FormSubmit({ 
  children, 
  disabled = false, 
  loading = false,
  className = '' 
}: FormSubmitProps) {
  const { formState: { isSubmitting, isValid } } = useFormContext()
  
  const isDisabled = disabled || isSubmitting || loading || !isValid

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={`
        w-full flex justify-center py-3 px-4 border border-transparent 
        text-sm font-medium rounded-md text-white 
        bg-primary-600 hover:bg-primary-700 
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {(isSubmitting || loading) && (
        <svg 
          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}

/**
 * Example: Login Form Implementation
 */
export function LoginFormExample() {
  const handleSubmit: SubmitHandler<LoginFormData> = async (data) => {
    console.log('Login data:', data)
    // Handle login logic
  }

  return (
    <FormWrapper 
      schema={loginSchema as z.ZodSchema<LoginFormData>} 
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <FormInput
        name="email"
        label="Email Address"
        type="email"
        placeholder="Enter your email"
        required
      />
      
      <FormInput
        name="password"
        label="Password"
        type="password"
        placeholder="Enter your password"
        required
      />
      
      <FormCheckbox
        name="rememberMe"
        label="Remember me"
        description="Keep me signed in for 30 days"
      />
      
      <FormSubmit>Sign In</FormSubmit>
    </FormWrapper>
  )
}

/**
 * Example: Contact Form Implementation
 */
export function ContactFormExample() {
  const handleSubmit: SubmitHandler<ContactFormData> = async (data) => {
    console.log('Contact data:', data)
    // Handle contact form submission
  }

  const contactReasonOptions = [
    { value: 'general_inquiry', label: 'General Inquiry' },
    { value: 'sales', label: 'Sales Question' },
    { value: 'support', label: 'Technical Support' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'billing', label: 'Billing Issue' },
    { value: 'other', label: 'Other' }
  ]

  return (
    <FormWrapper 
      schema={contactFormSchema as z.ZodSchema<ContactFormData>} 
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <FormInput
        name="name"
        label="Full Name"
        placeholder="Enter your full name"
        required
      />
      
      <FormInput
        name="email"
        label="Email Address"
        type="email"
        placeholder="Enter your email"
        required
      />
      
      <FormInput
        name="phone"
        label="Phone Number"
        type="tel"
        placeholder="(555) 123-4567"
        description="Optional - we'll call you back if needed"
      />
      
      <FormSelect
        name="contactReason"
        label="Reason for Contact"
        options={contactReasonOptions}
        required
      />
      
      <FormInput
        name="subject"
        label="Subject"
        placeholder="Brief description of your inquiry"
        required
      />
      
      <FormTextarea
        name="message"
        label="Message"
        placeholder="Please provide details about your inquiry..."
        rows={6}
        required
      />
      
      <FormCheckbox
        name="subscribeNewsletter"
        label="Subscribe to our newsletter"
        description="Get updates on new features and industry insights"
      />
      
      <FormSubmit>Send Message</FormSubmit>
    </FormWrapper>
  )
}

/**
 * Custom hook for form validation with debounced real-time feedback
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useValidatedForm<T extends Record<string, unknown>>(
  schema: z.ZodSchema<T>,
  options: {
    mode?: 'onChange' | 'onBlur' | 'onSubmit'
    defaultValues?: Partial<T>
    onSubmit: SubmitHandler<T>
    onError?: (errors: ValidationErrors) => void
  }
) {
  const methods = useForm<T>({
    resolver: zodResolver(schema),
    mode: options.mode || 'onChange',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: options.defaultValues as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const handleSubmit = methods.handleSubmit(
    options.onSubmit as SubmitHandler<Record<string, unknown>>,
    (errors) => {
      if (options.onError && errors) {
        const errorEntries = Object.entries(errors as Record<string, unknown>)
        const formattedErrors = formatValidationErrors(
          new z.ZodError(errorEntries.map(([key, error]) => ({
            code: 'custom' as const,
            message: typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Invalid value',
            path: [key]
          })))
        )
        options.onError(formattedErrors)
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any

  return {
    ...methods,
    handleSubmit,
    isValid: methods.formState.isValid,
    errors: methods.formState.errors as unknown as ValidationErrors,
    isDirty: methods.formState.isDirty,
    isSubmitting: methods.formState.isSubmitting
  }
}

// Individual exports only for React Fast Refresh compatibility
// No default export with mixed components/utilities