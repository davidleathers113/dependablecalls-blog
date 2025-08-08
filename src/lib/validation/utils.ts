import { z, ZodError } from 'zod'
import validator from 'validator'

/**
 * Validation utilities and helpers
 * Common functions for form validation and data sanitization
 */

// Validation result types
export type ValidationResult<T> = 
  | { success: true; data: T; errors?: never }
  | { success: false; data?: never; errors: ZodError }

export type FieldError = {
  field: string
  message: string
}

export type ValidationErrors = {
  [field: string]: string | string[]
}

/**
 * Safe validation utility that returns either success or error
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, errors: result.error }
}

/**
 * Format Zod errors into a more user-friendly format
 */
export function formatValidationErrors(error: ZodError): ValidationErrors {
  const errors: ValidationErrors = {}
  
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (!errors[path]) {
      errors[path] = []
    }
    
    if (Array.isArray(errors[path])) {
      (errors[path] as string[]).push(issue.message)
    } else {
      errors[path] = [errors[path] as string, issue.message]
    }
  }
  
  // Convert single-item arrays to strings
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value) && value.length === 1) {
      errors[key] = value[0]
    }
  }
  
  return errors
}

/**
 * Get the first error message for a field
 */
export function getFieldError(errors: ValidationErrors, field: string): string | undefined {
  const error = errors[field]
  if (!error) return undefined
  return Array.isArray(error) ? error[0] : error
}

/**
 * Check if field has any errors
 */
export function hasFieldError(errors: ValidationErrors, field: string): boolean {
  return field in errors
}

/**
 * Sanitize input by removing potentially dangerous characters
 * This is a basic implementation - in production, use a proper sanitization library
 */
export function sanitizeInput(input: string): string {
  return validator.escape(input.trim())
}

/**
 * Sanitize HTML content while preserving safe tags
 */
export function sanitizeHtml(input: string, allowedTags: string[] = []): string {
  // Basic HTML sanitization - in production use DOMPurify or similar
  let sanitized = input
  
  if (allowedTags.length === 0) {
    // Remove all HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '')
  } else {
    // Remove unsafe tags while keeping allowed ones
    // This is a simplified implementation
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g
    sanitized = sanitized.replace(tagRegex, (match, tagName) => {
      return allowedTags.includes(tagName.toLowerCase()) ? match : ''
    })
  }
  
  return validator.escape(sanitized)
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  return validator.isEmail(trimmed) ? validator.normalizeEmail(trimmed) || trimmed : trimmed
}

/**
 * Validate and format phone number
 */
export function formatPhoneNumber(phone: string, country: string = 'US'): string {
  const cleaned = phone.replace(/\D/g, '')
  
  if (country === 'US' && cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  
  return cleaned
}

/**
 * Validate URL and ensure it has a protocol
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  
  if (!trimmed) return ''
  
  // Add protocol if missing
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`
  }
  
  return trimmed
}

/**
 * Create a validation schema that allows partial updates
 */
export function createPartialSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  return schema.partial()
}

/**
 * Merge validation schemas with proper error handling
 */
export function mergeValidationResults<T, U>(
  result1: ValidationResult<T>,
  result2: ValidationResult<U>
): ValidationResult<T & U> {
  if (result1.success && result2.success) {
    return { 
      success: true, 
      data: { ...result1.data, ...result2.data } 
    }
  }
  
  const errors = new ZodError([])
  
  if (!result1.success) {
    errors.addIssues(result1.errors.issues)
  }
  
  if (!result2.success) {
    errors.addIssues(result2.errors.issues)
  }
  
  return { success: false, errors }
}

/**
 * Validate array of items with individual error tracking
 */
export function validateArray<T>(
  items: unknown[],
  schema: z.ZodSchema<T>
): {
  success: boolean
  data: T[]
  errors: { index: number; error: ZodError }[]
} {
  const data: T[] = []
  const errors: { index: number; error: ZodError }[] = []
  
  for (let i = 0; i < items.length; i++) {
    const result = schema.safeParse(items[i])
    if (result.success) {
      data.push(result.data)
    } else {
      errors.push({ index: i, error: result.error })
    }
  }
  
  return {
    success: errors.length === 0,
    data,
    errors
  }
}

/**
 * Create conditional validation based on another field
 */
export function createConditionalSchema<T>(
  baseSchema: z.ZodSchema<T>,
  condition: (data: unknown) => boolean,
  conditionalSchema: z.ZodSchema<unknown>
): z.ZodSchema<T> {
  return z.any().superRefine((data, ctx) => {
    // First validate with base schema
    const baseResult = baseSchema.safeParse(data)
    if (!baseResult.success) {
      for (const issue of baseResult.error.issues) {
        ctx.addIssue(issue)
      }
      return
    }
    
    // Apply conditional validation if condition is met
    if (condition(data)) {
      const conditionalResult = conditionalSchema.safeParse(data)
      if (!conditionalResult.success) {
        for (const issue of conditionalResult.error.issues) {
          ctx.addIssue(issue)
        }
      }
    }
  }) as z.ZodSchema<T>
}

/**
 * Debounced validation for real-time form validation
 */
export function createDebouncedValidator<T>(
  schema: z.ZodSchema<T>,
  delay: number = 300
) {
  let timeoutId: NodeJS.Timeout | undefined
  
  return (
    data: unknown,
    callback: (result: ValidationResult<T>) => void
  ): void => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      const result = safeValidate(schema, data)
      callback(result)
    }, delay)
  }
}

/**
 * Transform validation errors for React Hook Form
 */
export function toReactHookFormErrors(error: ZodError): Record<string, { message: string }> {
  const errors: Record<string, { message: string }> = {}
  
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (!errors[path]) {
      errors[path] = { message: issue.message }
    }
  }
  
  return errors
}

/**
 * Custom refinement for password strength
 */
export const passwordStrengthRefinement = (password: string) => {
  const strength = {
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSymbols: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    hasMinLength: password.length >= 8
  }
  
  const score = Object.values(strength).filter(Boolean).length
  return { strength, score }
}

/**
 * File validation utilities
 */
export const fileValidationUtils = {
  isValidImageType: (type: string) => 
    ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type),
    
  isValidDocumentType: (type: string) =>
    ['application/pdf', 'application/msword', 
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'text/plain'].includes(type),
     
  formatFileSize: (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

/**
 * Date validation utilities
 */
export const dateValidationUtils = {
  isBusinessDay: (date: Date) => {
    const day = date.getDay()
    return day >= 1 && day <= 5 // Monday to Friday
  },
  
  isWithinBusinessHours: (date: Date, start: string = '09:00', end: string = '17:00') => {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const currentTime = hours * 60 + minutes
    
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    
    const startTime = startHour * 60 + startMin
    const endTime = endHour * 60 + endMin
    
    return currentTime >= startTime && currentTime <= endTime
  },
  
  addBusinessDays: (date: Date, days: number) => {
    const result = new Date(date)
    let addedDays = 0
    
    while (addedDays < days) {
      result.setDate(result.getDate() + 1)
      if (dateValidationUtils.isBusinessDay(result)) {
        addedDays++
      }
    }
    
    return result
  }
}

export default {
  safeValidate,
  formatValidationErrors,
  getFieldError,
  hasFieldError,
  sanitizeInput,
  sanitizeHtml,
  sanitizeEmail,
  formatPhoneNumber,
  normalizeUrl,
  createPartialSchema,
  mergeValidationResults,
  validateArray,
  createConditionalSchema,
  createDebouncedValidator,
  toReactHookFormErrors,
  passwordStrengthRefinement,
  fileValidationUtils,
  dateValidationUtils
}