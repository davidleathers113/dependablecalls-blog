import { z } from 'zod'

/**
 * Common validation schemas for forms
 */

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