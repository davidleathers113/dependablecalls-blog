/**
 * DCE Platform Validation System Examples
 * 
 * This file demonstrates how to use the comprehensive validation system
 * with various forms throughout the DCE platform.
 * 
 * CRITICAL: NO regex patterns - uses Zod + validator.js only
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  // Authentication
  loginSchema,
  registerSchema,
  LoginFormData,
  RegisterFormData,
  
  // Contact
  contactFormSchema,
  ContactFormData,
  
  // Campaign
  campaignBasicInfoSchema,
  CampaignBasicInfoFormData,
  
  // Settings (available but not used in current examples)
  accountSettingsSchema as _accountSettingsSchema,
  AccountSettingsFormData as _AccountSettingsFormData
} from './index'

/**
 * Example 1: Login Form with Validation
 */
export function LoginFormExample() {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange'
  })

  const onSubmit = (data: LoginFormData) => {
    console.log('✅ Valid login data:', data)
    // Data is fully typed and validated:
    // data.email: string (valid email)
    // data.password: string (8+ chars, strong)
    // data.rememberMe?: boolean
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email Address
        </label>
        <input
          {...register('email')}
          id="email"
          type="email"
          className="mt-1 block w-full px-3 py-2 border rounded-md"
          placeholder="user@example.com"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          {...register('password')}
          id="password"
          type="password"
          className="mt-1 block w-full px-3 py-2 border rounded-md"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
        )}
      </div>

      <div className="flex items-center">
        <input
          {...register('rememberMe')}
          id="rememberMe"
          type="checkbox"
          className="h-4 w-4"
        />
        <label htmlFor="rememberMe" className="ml-2 block text-sm">
          Remember me
        </label>
      </div>

      <button
        type="submit"
        disabled={!isValid}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md disabled:opacity-50"
      >
        Sign In
      </button>
    </form>
  )
}

/**
 * Example 2: Contact Form with Advanced Validation
 */
export function ContactFormExample() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    mode: 'onChange'
  })

  const onSubmit = (data: ContactFormData) => {
    console.log('✅ Valid contact data:', data)
    // Fully validated and typed data:
    // data.name: string (1-100 chars)
    // data.email: string (valid email)
    // data.phone?: string (10 digits, US format)
    // data.contactReason: enum
    // data.message: string (20-2000 chars)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium">Name *</label>
        <input
          {...register('name')}
          type="text"
          className="mt-1 block w-full px-3 py-2 border rounded-md"
        />
        {errors.name && <p className="text-red-600 text-sm">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Email *</label>
        <input
          {...register('email')}
          type="email"
          className="mt-1 block w-full px-3 py-2 border rounded-md"
        />
        {errors.email && <p className="text-red-600 text-sm">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Phone (Optional)</label>
        <input
          {...register('phone')}
          type="tel"
          placeholder="(555) 123-4567"
          className="mt-1 block w-full px-3 py-2 border rounded-md"
        />
        {errors.phone && <p className="text-red-600 text-sm">{errors.phone.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Reason for Contact *</label>
        <select {...register('contactReason')} className="mt-1 block w-full px-3 py-2 border rounded-md">
          <option value="">Select a reason...</option>
          <option value="general_inquiry">General Inquiry</option>
          <option value="sales">Sales Question</option>
          <option value="support">Technical Support</option>
          <option value="partnership">Partnership</option>
          <option value="billing">Billing Issue</option>
        </select>
        {errors.contactReason && <p className="text-red-600 text-sm">{errors.contactReason.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Subject *</label>
        <input
          {...register('subject')}
          type="text"
          className="mt-1 block w-full px-3 py-2 border rounded-md"
        />
        {errors.subject && <p className="text-red-600 text-sm">{errors.subject.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Message *</label>
        <textarea
          {...register('message')}
          rows={6}
          className="mt-1 block w-full px-3 py-2 border rounded-md"
          placeholder="Please describe your inquiry in detail..."
        />
        {errors.message && <p className="text-red-600 text-sm">{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md"
      >
        Send Message
      </button>
    </form>
  )
}

/**
 * Example 3: Campaign Creation (Step 1 - Basic Info)
 */
export function CampaignBasicInfoExample() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<CampaignBasicInfoFormData>({
    resolver: zodResolver(campaignBasicInfoSchema),
    mode: 'onChange'
  })

  const onSubmit = (data: CampaignBasicInfoFormData) => {
    console.log('✅ Valid campaign data:', data)
    // Proceed to next step with validated data
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium">Campaign Name *</label>
        <input
          {...register('name')}
          type="text"
          placeholder="Enter campaign name (3-100 characters)"
          className="mt-1 block w-full px-3 py-2 border rounded-md"
        />
        {errors.name && <p className="text-red-600 text-sm">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          {...register('description')}
          rows={3}
          className="mt-1 block w-full px-3 py-2 border rounded-md"
        />
        {errors.description && <p className="text-red-600 text-sm">{errors.description.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Industry Vertical *</label>
        <select {...register('vertical')} className="mt-1 block w-full px-3 py-2 border rounded-md">
          <option value="">Select industry...</option>
          <option value="home_improvement">Home Improvement</option>
          <option value="insurance">Insurance</option>
          <option value="legal">Legal Services</option>
          <option value="financial">Financial Services</option>
          <option value="healthcare">Healthcare</option>
          <option value="automotive">Automotive</option>
          <option value="real_estate">Real Estate</option>
          <option value="solar">Solar/Energy</option>
          <option value="other">Other</option>
        </select>
        {errors.vertical && <p className="text-red-600 text-sm">{errors.vertical.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Campaign Type *</label>
        <select {...register('campaignType')} className="mt-1 block w-full px-3 py-2 border rounded-md">
          <option value="">Select type...</option>
          <option value="inbound">Inbound Calls</option>
          <option value="outbound">Outbound Calls</option>
          <option value="both">Both Inbound & Outbound</option>
        </select>
        {errors.campaignType && <p className="text-red-600 text-sm">{errors.campaignType.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Call Intent *</label>
        <select {...register('callIntent')} className="mt-1 block w-full px-3 py-2 border rounded-md">
          <option value="">Select intent...</option>
          <option value="sales">Sales</option>
          <option value="leads">Lead Generation</option>
          <option value="support">Customer Support</option>
          <option value="survey">Survey/Research</option>
        </select>
        {errors.callIntent && <p className="text-red-600 text-sm">{errors.callIntent.message}</p>}
      </div>

      <button
        type="submit"
        className="w-full py-2 px-4 bg-green-600 text-white rounded-md"
      >
        Continue to Targeting
      </button>
    </form>
  )
}

/**
 * Example 4: Programmatic Validation (Server-side/API)
 */
// eslint-disable-next-line react-refresh/only-export-components
export function programmaticValidationExample() {
  // Example of using validation in API endpoints or server functions
  const validateUserRegistration = (userData: unknown) => {
    const result = registerSchema.safeParse(userData)
    
    if (result.success) {
      // Data is fully typed and validated
      const validatedData: RegisterFormData = result.data
      console.log('✅ Registration data is valid:', validatedData)
      
      // Proceed with user creation
      return {
        success: true,
        user: validatedData
      }
    } else {
      // Handle validation errors
      console.error('❌ Validation failed:', result.error.issues)
      
      return {
        success: false,
        errors: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      }
    }
  }

  // Example usage
  const userData = {
    email: 'newuser@example.com',
    password: 'SecurePass123',
    confirmPassword: 'SecurePass123',
    firstName: 'John',
    lastName: 'Doe',
    role: 'supplier',
    acceptTerms: true
  }

  const result = validateUserRegistration(userData)
  return result
}

/**
 * Example 5: Custom Validation Hook
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFormValidation<T extends Record<string, unknown>>(
  schema: z.ZodSchema<T>,
  defaultValues?: Partial<T>
) {
  const methods = useForm<T>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: defaultValues as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  const validateField = (fieldName: keyof T, value: unknown) => {
    // Real-time field validation
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (schema as any).pick({ [fieldName]: true }).parse({ [fieldName]: value })
      return null // No error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return error.issues?.[0]?.message || 'Invalid value'
    }
  }

  const validateForm = (data: T) => {
    const result = schema.safeParse(data)
    return {
      isValid: result.success,
      errors: result.success ? null : result.error.issues,
      data: result.success ? result.data : null
    }
  }

  return {
    ...methods,
    validateField,
    validateForm
  }
}

export default {
  LoginFormExample,
  ContactFormExample,
  CampaignBasicInfoExample,
  programmaticValidationExample,
  useFormValidation
}