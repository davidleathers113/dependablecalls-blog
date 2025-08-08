/**
 * Comprehensive form validation schemas for DCE Platform
 * 
 * All validation uses Zod + validator.js (NO regex patterns)
 * Follows DCE security patterns and TypeScript 5.8 strict typing
 */

export * from './auth'
export * from './campaigns'
export * from './contact'
export * from './settings'
export * from './common'
export * from './utils'

// Re-export legacy schemas for backward compatibility
export { 
  emailSchema,
  phoneSchema,
  passwordSchema,
  urlSchema,
  routingNumberSchema,
  accountNumberSchema,
  taxIdSchema
} from '../validation'