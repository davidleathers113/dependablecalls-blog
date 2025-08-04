/**
 * Auth Store Schema Definitions - Phase 3.1b
 * Versioned schemas for authentication state persistence
 */

import { z } from 'zod'
import { registerSchema } from './index'

// Auth preferences schema (what gets persisted)
const AuthPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  emailNotifications: z.boolean().optional(),
})

// Full auth state schema (for validation, but not persistence)
const AuthStateSchema = z.object({
  user: z.unknown().nullable(), // User type is complex, using unknown for now
  session: z.unknown().nullable(), // Session type is complex
  userType: z.enum(['supplier', 'buyer', 'admin', 'network']).nullable(),
  loading: z.boolean(),
  isAuthenticated: z.boolean(),
  preferences: AuthPreferencesSchema,
})

// Persisted auth data schema (only preferences)
const AuthPersistedSchema = z.object({
  preferences: AuthPreferencesSchema,
})

// Register version 1 of auth store schema
registerSchema(
  'auth-store',
  1,
  AuthPersistedSchema,
  {
    createdAt: new Date().toISOString(),
    description: 'Initial auth store schema - persists only user preferences',
    isBreaking: false,
  },
  ['preferences'] // Only preferences are persisted
)

// Export schemas for use in tests and migrations
export {
  AuthPreferencesSchema,
  AuthStateSchema,
  AuthPersistedSchema,
}

// Export types
export type AuthPreferences = z.infer<typeof AuthPreferencesSchema>
export type AuthState = z.infer<typeof AuthStateSchema>
export type AuthPersisted = z.infer<typeof AuthPersistedSchema>