/**
 * Auth Store Migrations - Phase 3.1b
 * Handles backward-compatible migrations for auth store schema changes
 */

import { z } from 'zod'
import { registerMigration, type Migration } from './index'

// ======================
// VERSION 1 -> VERSION 2
// ======================

// V1 Schema (initial - only preferences)
const AuthPersistedV1Schema = z.object({
  preferences: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    locale: z.string().optional(),
    timezone: z.string().optional(),
    emailNotifications: z.boolean().optional(),
  }),
})

// V2 Schema (adds sessionRememberMe flag)
const AuthPersistedV2Schema = z.object({
  preferences: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    locale: z.string().optional(),
    timezone: z.string().optional(),
    emailNotifications: z.boolean().optional(),
    sessionRememberMe: z.boolean().optional(), // NEW FIELD
  }),
})

type AuthPersistedV1 = z.infer<typeof AuthPersistedV1Schema>
type AuthPersistedV2 = z.infer<typeof AuthPersistedV2Schema>

// Migration from V1 to V2: Add sessionRememberMe with default value
const authV1ToV2Migration: Migration<AuthPersistedV1, AuthPersistedV2> = {
  version: 1,
  targetVersion: 2,
  storeName: 'auth-store',
  description: 'Add sessionRememberMe preference with default false',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V1 -> V2
  up: (state: AuthPersistedV1): AuthPersistedV2 => {
    return {
      preferences: {
        ...state.preferences,
        sessionRememberMe: false, // Default to false for security
      },
    }
  },
  
  // Rollback migration: V2 -> V1
  down: (state: AuthPersistedV2): AuthPersistedV1 => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sessionRememberMe, ...restPreferences } = state.preferences
    return {
      preferences: restPreferences,
    }
  },
  
  // Validation schemas
  fromSchema: AuthPersistedV1Schema,
  toSchema: AuthPersistedV2Schema,
}

// ======================
// VERSION 2 -> VERSION 3
// ======================

// V3 Schema (adds security preferences)
const AuthPersistedV3Schema = z.object({
  preferences: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    locale: z.string().optional(),
    timezone: z.string().optional(),
    emailNotifications: z.boolean().optional(),
    sessionRememberMe: z.boolean().optional(),
    // NEW SECURITY PREFERENCES
    twoFactorEnabled: z.boolean().optional(),
    loginNotifications: z.boolean().optional(),
    sessionTimeout: z.number().optional(), // minutes
  }),
})

type AuthPersistedV3 = z.infer<typeof AuthPersistedV3Schema>

// Migration from V2 to V3: Add security preferences
const authV2ToV3Migration: Migration<AuthPersistedV2, AuthPersistedV3> = {
  version: 2,
  targetVersion: 3,
  storeName: 'auth-store',
  description: 'Add security preferences (2FA, login notifications, session timeout)',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V2 -> V3
  up: (state: AuthPersistedV2): AuthPersistedV3 => {
    return {
      preferences: {
        ...state.preferences,
        twoFactorEnabled: false,           // Default disabled
        loginNotifications: true,          // Default enabled for security
        sessionTimeout: 480,               // Default 8 hours
      },
    }
  },
  
  // Rollback migration: V3 -> V2
  down: (state: AuthPersistedV3): AuthPersistedV2 => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { twoFactorEnabled, loginNotifications, sessionTimeout, ...restPreferences } = state.preferences
    return {
      preferences: restPreferences,
    }
  },
  
  // Validation schemas
  fromSchema: AuthPersistedV2Schema,
  toSchema: AuthPersistedV3Schema,
}

// ======================
// EXAMPLE: BREAKING MIGRATION V3 -> V4
// ======================

// V4 Schema (breaking change - restructure preferences)
const AuthPersistedV4Schema = z.object({
  ui: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    locale: z.string().optional(),
    timezone: z.string().optional(),
  }),
  notifications: z.object({
    email: z.boolean().optional(),
    login: z.boolean().optional(),
  }),
  security: z.object({
    twoFactor: z.boolean().optional(),
    sessionRemember: z.boolean().optional(),
    sessionTimeout: z.number().optional(),
  }),
})

type AuthPersistedV4 = z.infer<typeof AuthPersistedV4Schema>

// BREAKING Migration from V3 to V4: Restructure preferences into categories
const authV3ToV4Migration: Migration<AuthPersistedV3, AuthPersistedV4> = {
  version: 3,
  targetVersion: 4,
  storeName: 'auth-store',
  description: 'BREAKING: Restructure preferences into UI, notifications, and security categories',
  createdAt: new Date().toISOString(),
  isBreaking: true, // This is a breaking change
  
  // Forward migration: V3 -> V4
  up: (state: AuthPersistedV3): AuthPersistedV4 => {
    const prefs = state.preferences
    return {
      ui: {
        theme: prefs.theme,
        locale: prefs.locale,
        timezone: prefs.timezone,
      },
      notifications: {
        email: prefs.emailNotifications,
        login: prefs.loginNotifications,
      },
      security: {
        twoFactor: prefs.twoFactorEnabled,
        sessionRemember: prefs.sessionRememberMe,
        sessionTimeout: prefs.sessionTimeout,
      },
    }
  },
  
  // Rollback migration: V4 -> V3
  down: (state: AuthPersistedV4): AuthPersistedV3 => {
    return {
      preferences: {
        theme: state.ui.theme,
        locale: state.ui.locale,
        timezone: state.ui.timezone,
        emailNotifications: state.notifications.email,
        loginNotifications: state.notifications.login,
        twoFactorEnabled: state.security.twoFactor,
        sessionRememberMe: state.security.sessionRemember,
        sessionTimeout: state.security.sessionTimeout,
      },
    }
  },
  
  // Validation schemas
  fromSchema: AuthPersistedV3Schema,
  toSchema: AuthPersistedV4Schema,
}

// Register all migrations
registerMigration(authV1ToV2Migration)
registerMigration(authV2ToV3Migration)
registerMigration(authV3ToV4Migration)

// Export schemas for testing
export {
  AuthPersistedV1Schema,
  AuthPersistedV2Schema,
  AuthPersistedV3Schema,
  AuthPersistedV4Schema,
}

// Export types for testing
export type {
  AuthPersistedV1,
  AuthPersistedV2,
  AuthPersistedV3,
  AuthPersistedV4,
}

// Export migrations for testing
export {
  authV1ToV2Migration,
  authV2ToV3Migration,
  authV3ToV4Migration,
}

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Type-safe window extension for development debugging
  interface WindowWithAuthMigrations extends Window {
    __dceAuthMigrations?: {
      v1ToV2: typeof authV1ToV2Migration
      v2ToV3: typeof authV2ToV3Migration
      v3ToV4: typeof authV3ToV4Migration
      schemas: {
        v1: typeof AuthPersistedV1Schema
        v2: typeof AuthPersistedV2Schema
        v3: typeof AuthPersistedV3Schema
        v4: typeof AuthPersistedV4Schema
      }
    }
  }

  ;(window as WindowWithAuthMigrations).__dceAuthMigrations = {
    v1ToV2: authV1ToV2Migration,
    v2ToV3: authV2ToV3Migration,
    v3ToV4: authV3ToV4Migration,
    schemas: {
      v1: AuthPersistedV1Schema,
      v2: AuthPersistedV2Schema,
      v3: AuthPersistedV3Schema,
      v4: AuthPersistedV4Schema,
    },
  }
}