import { z } from 'zod'
import { emailSchema, passwordSchema, nameSchema, userRoleSchema } from './common'

/**
 * Authentication form validation schemas
 * Supports both traditional and magic link authentication
 */

// Login schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  rememberMe: z.boolean().optional().default(false)
})

export const magicLinkLoginSchema = z.object({
  email: emailSchema
})

// Registration schemas
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  firstName: nameSchema.refine(
    (val) => val.length >= 2,
    { message: 'First name must be at least 2 characters' }
  ),
  lastName: nameSchema.refine(
    (val) => val.length >= 2,
    { message: 'Last name must be at least 2 characters' }
  ),
  company: z.string().max(200).optional(),
  role: userRoleSchema.refine(
    (val) => ['supplier', 'buyer', 'network'].includes(val),
    { message: 'Please select a valid account type' }
  ),
  acceptTerms: z.boolean().refine(
    (val) => val === true,
    { message: 'You must accept the terms and conditions to register' }
  ),
  acceptPrivacy: z.boolean().refine(
    (val) => val === true,
    { message: 'You must accept the privacy policy to register' }
  ).optional()
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ['confirmPassword']
  }
)

export const magicLinkRegisterSchema = z.object({
  email: emailSchema,
  role: userRoleSchema.refine(
    (val) => ['supplier', 'buyer', 'network'].includes(val),
    { message: 'Please select a valid account type' }
  ),
  acceptTerms: z.boolean().refine(
    (val) => val === true,
    { message: 'You must accept the terms and conditions to register' }
  )
})

// Password management schemas
export const resetPasswordSchema = z.object({
  email: emailSchema
})

export const newPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ['confirmPassword']
  }
)

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmNewPassword: z.string().min(1, 'Please confirm your new password')
}).refine(
  (data) => data.newPassword === data.confirmNewPassword,
  {
    message: "New passwords don't match",
    path: ['confirmNewPassword']
  }
).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: "New password must be different from current password",
    path: ['newPassword']
  }
)

// Multi-factor authentication schemas
export const mfaSetupSchema = z.object({
  method: z.enum(['totp', 'sms', 'email'], {
    errorMap: () => ({ message: 'Please select a valid MFA method' })
  }),
  phoneNumber: z.string().optional(),
  backupCodes: z.array(z.string()).optional()
}).refine(
  (data) => {
    // If SMS is selected, phone number is required
    if (data.method === 'sms' && !data.phoneNumber) {
      return false
    }
    return true
  },
  {
    message: 'Phone number is required for SMS authentication',
    path: ['phoneNumber']
  }
)

export const mfaVerifySchema = z.object({
  code: z.string()
    .min(6, 'Verification code must be 6 digits')
    .max(6, 'Verification code must be 6 digits')
    .refine(
      (val) => /^\d{6}$/.test(val),
      { message: 'Verification code must contain only numbers' }
    )
})

// Profile management schemas
export const updateProfileSchema = z.object({
  firstName: nameSchema.refine(
    (val) => val.length >= 2,
    { message: 'First name must be at least 2 characters' }
  ),
  lastName: nameSchema.refine(
    (val) => val.length >= 2,
    { message: 'Last name must be at least 2 characters' }
  ),
  company: z.string().max(200).optional(),
  email: emailSchema,
  currentPassword: z.string().optional()
}).refine(
  (_data) => {
    // If email is being changed, current password is required
    return true // This validation should be handled server-side
  }
)

// Email verification schemas
export const resendVerificationSchema = z.object({
  email: emailSchema
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  email: emailSchema.optional()
})

// Account deletion schema
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required to delete account'),
  confirmation: z.string().refine(
    (val) => val === 'DELETE',
    { message: 'Please type "DELETE" to confirm account deletion' }
  ),
  reason: z.enum([
    'not_using',
    'found_alternative',
    'privacy_concerns',
    'technical_issues',
    'cost',
    'other'
  ]).optional()
})

// Type exports for form integration
export type LoginFormData = z.infer<typeof loginSchema>
export type MagicLinkLoginFormData = z.infer<typeof magicLinkLoginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type MagicLinkRegisterFormData = z.infer<typeof magicLinkRegisterSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type NewPasswordFormData = z.infer<typeof newPasswordSchema>
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
export type MfaSetupFormData = z.infer<typeof mfaSetupSchema>
export type MfaVerifyFormData = z.infer<typeof mfaVerifySchema>
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>
export type ResendVerificationFormData = z.infer<typeof resendVerificationSchema>
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>
export type DeleteAccountFormData = z.infer<typeof deleteAccountSchema>

// Legacy exports for backward compatibility
export { loginSchema as LoginSchema }
export { registerSchema as RegisterSchema }
export type { LoginFormData as LoginData }
export type { RegisterFormData as RegisterData }
export type { MagicLinkLoginFormData as MagicLinkLoginData }
export type { MagicLinkRegisterFormData as MagicLinkRegisterData }