import { z } from 'zod'
import validator from 'validator'

/**
 * Common validation schemas for forms
 */

// URL validation using validator.js (NO REGEX)
export const urlSchema = z
  .string()
  .refine(
    (val) => validator.isURL(val, { protocols: ['http', 'https'] }),
    { message: 'Please enter a valid URL starting with http:// or https://' }
  )

// Bank routing number validation using validator.js
export const routingNumberSchema = z
  .string()
  .refine(
    (val) => validator.isLength(val, { min: 9, max: 9 }) && validator.isNumeric(val),
    { message: 'Routing number must be 9 digits' }
  )

// Bank account number validation
export const accountNumberSchema = z
  .string()
  .refine(
    (val) => validator.isLength(val, { min: 4, max: 17 }) && validator.isNumeric(val),
    { message: 'Account number must be 4-17 digits' }
  )

// Tax ID validation (flexible format)
export const taxIdSchema = z
  .string()
  .min(1, 'Tax ID is required')
  .refine(
    (val) => {
      // Remove all non-alphanumeric characters for validation
      const clean = val.replace(/[^a-zA-Z0-9]/g, '')
      return clean.length >= 9 // Basic length check
    },
    { message: 'Please enter a valid Tax ID' }
  )

// Email validation
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')

// Password validation
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be less than 72 characters')

// Phone validation (no regex!)
export const phoneSchema = z
  .string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 10, {
    message: 'Phone number must be 10 digits'
  })

// Magic link login schema
export const magicLinkLoginSchema = z.object({
  email: emailSchema
})

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  rememberMe: z.boolean().optional()
})

// Alias for Netlify functions compatibility
export const LoginSchema = loginSchema
export type LoginData = z.infer<typeof loginSchema>

// Register schema
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  company: z.string().optional(),
  role: z.enum(['supplier', 'buyer', 'network']),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions'
  })
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
})

// Contact form schema
export const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: emailSchema,
  phone: phoneSchema.optional(),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters')
})

// Reset password schema
export const resetPasswordSchema = z.object({
  email: emailSchema
})

// Campaign schema
export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  target_cpa: z.number().positive('Target CPA must be positive'),
  daily_budget: z.number().positive('Daily budget must be positive'),
  status: z.enum(['active', 'paused', 'ended']).default('active')
})

// Aliases for Netlify functions
export const CreateCampaignSchema = createCampaignSchema
export type CreateCampaignData = z.infer<typeof createCampaignSchema>

// Export types
export type MagicLinkLoginData = z.infer<typeof magicLinkLoginSchema>
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterData = z.infer<typeof registerSchema>
export type ContactFormData = z.infer<typeof contactSchema>
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>

// Tracking number configuration schema
const trackingNumberConfigSchema = z.object({
  number: z.string(),
  provider: z.string(),
  campaigns: z.array(z.string()),
  active: z.boolean()
})

// Settings validation schemas
export const callTrackingSettingsSchema = z.object({
  defaultProvider: z.string().min(1, 'Please select a call tracking provider'),
  trackingNumbers: z.array(trackingNumberConfigSchema).default([]),
  recordCalls: z.boolean().default(false),
  transcribeCalls: z.boolean().default(false),
  webhookUrl: z.string().optional().refine(
    (val) => !val || validator.isURL(val, { protocols: ['http', 'https'] }),
    { message: 'Please enter a valid URL starting with http:// or https://' }
  ),
  retryAttempts: z.number().min(0, 'Must be 0 or greater').max(10, 'Maximum 10 retry attempts').default(3),
  timeoutSeconds: z.number().min(5, 'Minimum 5 seconds').max(120, 'Maximum 120 seconds').default(30),
  dataRetentionDays: z.number().positive('Must be positive').default(30),
  // Provider-specific fields for form
  providerApiKey: z.string().optional(),
  providerApiSecret: z.string().optional(),
  providerAccountId: z.string().optional()
})

export const payoutSettingsSchema = z.object({
  preferredMethod: z.enum(['bank_transfer', 'wire', 'paypal', 'check']),
  minimumPayout: z.number().positive('Must be positive'),
  payoutSchedule: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'net30']),
  bankDetails: z.object({
    accountName: z.string().min(1, 'Account holder name is required'),
    bankName: z.string().min(1, 'Bank name is required'),
    routingNumber: routingNumberSchema,
    accountNumber: accountNumberSchema
  }).optional(),
  taxInformation: z.object({
    taxId: taxIdSchema,
    vatNumber: z.string().optional(),
    taxExempt: z.boolean().default(false),
    w9Filed: z.boolean().default(false)
  }),
  invoiceSettings: z.object({
    generateAutomatically: z.boolean().default(true),
    emailTo: z.array(z.string().email()).default([]),
    includeDetails: z.boolean().default(true),
    customTemplate: z.string().optional()
  }),
  // Form-specific fields
  confirmAccountNumber: z.string().optional(),
  confirmRoutingNumber: z.string().optional(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms to save payout settings'
  })
}).refine(
  (data) => {
    // If bank_transfer is selected and bank details exist, validate confirmation fields
    if (data.preferredMethod === 'bank_transfer' && data.bankDetails) {
      return data.bankDetails.accountNumber === data.confirmAccountNumber &&
             data.bankDetails.routingNumber === data.confirmRoutingNumber
    }
    return true
  },
  {
    message: 'Account and routing number confirmations must match',
    path: ['confirmAccountNumber']
  }
)

// Export types for the settings schemas
export type CallTrackingFormData = z.infer<typeof callTrackingSettingsSchema>
export type PayoutFormData = z.infer<typeof payoutSettingsSchema>

/**
 * Safe validation utility that returns either success or error
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}

/**
 * Sanitize input by removing potentially dangerous characters
 * This is a basic implementation - in production, use a proper sanitization library
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
}