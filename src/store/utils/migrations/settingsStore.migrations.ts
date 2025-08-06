/**
 * Settings Store Migrations - Phase 3.1b
 * Handles migrations for settings store schema changes
 * Focus: User preferences evolution and privacy enhancements
 */

import { z } from 'zod'
import { registerMigration, type Migration } from './index'
import { 
  UserSettingsSchema
} from '../schemas/settingsStore.schema'

// ======================
// VERSION 1 -> VERSION 2
// ======================

// V1 Schema (initial - basic user settings with proper typing)
const SettingsPersistedV1Schema = z.object({
  userSettings: UserSettingsSchema.nullable(),
  lastSaved: z.string().nullable(),
})

// V2 Schema - properly extends V1 with theme and accessibility using spread syntax
const UserSettingsV2Schema = z.object({
  // Inherit all base UserSettings fields
  ...UserSettingsSchema.shape,
  
  // Extend preferences with new theme customization
  preferences: z.object({
    // Keep all existing preferences
    ...UserSettingsSchema.shape.preferences.shape,
    
    // NEW: Theme customization
    customTheme: z.object({
      mode: z.enum(['light', 'dark', 'auto']).default('auto'),
      primaryColor: z.string().default('#0066cc'),
      accentColor: z.string().default('#ff6600'),
      customCss: z.string().optional(),
      highContrast: z.boolean().default(false),
    }).optional(),
  }),
  
  // NEW: Accessibility preferences
  accessibility: z.object({
    reducedMotion: z.boolean().default(false),
    screenReader: z.boolean().default(false),
    keyboardNavigation: z.boolean().default(false),
    fontSize: z.enum(['small', 'medium', 'large', 'extra-large']).default('medium'),
    focusIndicator: z.boolean().default(true),
  }).optional(),
})

const SettingsPersistedV2Schema = z.object({
  userSettings: UserSettingsV2Schema.nullable(),
  lastSaved: z.string().nullable(),
})

// Properly typed migration types
type SettingsPersistedV1 = z.infer<typeof SettingsPersistedV1Schema>
type SettingsPersistedV2 = z.infer<typeof SettingsPersistedV2Schema>
type UserSettingsV2 = z.infer<typeof UserSettingsV2Schema>

// Migration from V1 to V2: Add theme and accessibility settings
const settingsV1ToV2Migration: Migration<SettingsPersistedV1, SettingsPersistedV2> = {
  version: 1 as const,
  targetVersion: 2 as const,
  storeName: 'settings-store' as const,
  description: 'Add theme customization and accessibility preferences',
  createdAt: new Date().toISOString(),
  isBreaking: false as const,
  
  // Forward migration: V1 -> V2 with proper typing
  up: (state: SettingsPersistedV1): SettingsPersistedV2 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    // Type-safe migration with proper object spread
    const migratedSettings: UserSettingsV2 = {
      ...state.userSettings,
      preferences: {
        ...state.userSettings.preferences,
        customTheme: {
          mode: 'auto' as const,
          primaryColor: '#0066cc',
          accentColor: '#ff6600',
          customCss: undefined,
          highContrast: false,
        },
      },
      accessibility: {
        reducedMotion: false,
        screenReader: false,
        keyboardNavigation: false,
        fontSize: 'medium' as const,
        focusIndicator: true,
      },
    }
    
    return {
      userSettings: migratedSettings,
      lastSaved: state.lastSaved,
    }
  },
  
  // Rollback migration: V2 -> V1 with type safety
  down: (state: SettingsPersistedV2): SettingsPersistedV1 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    // Type-safe rollback - remove V2 specific properties
    const { accessibility: _accessibility, ...rest } = state.userSettings
    const { preferences: oldPreferences } = rest
    
    // Remove customTheme from preferences
    const { customTheme: _customTheme, ...basePreferences } = oldPreferences
    
    const rolledBackSettings = {
      ...rest,
      preferences: basePreferences,
    }
    
    return {
      userSettings: rolledBackSettings,
      lastSaved: state.lastSaved,
    }
  },
  
  // Validation schemas - properly typed with strict schema compatibility
  fromSchema: SettingsPersistedV1Schema as z.ZodSchema<SettingsPersistedV1>,
  toSchema: SettingsPersistedV2Schema as z.ZodSchema<SettingsPersistedV2>,
}

// ======================
// VERSION 2 -> VERSION 3
// ======================

// V3 Schema (extends V2 with performance and privacy enhancements) using spread syntax
const UserSettingsV3Schema = z.object({
  // Inherit all V2 fields (includes V1 base + theme + accessibility)
  ...UserSettingsV2Schema.shape,
  
  // NEW: Enhanced privacy controls (optional section)
  privacy: z.object({
    dataSharing: z.boolean().default(false),
    analytics: z.boolean().default(true),
    marketing: z.boolean().default(false),
    thirdPartyIntegrations: z.boolean().default(true),
    // NEW: Enhanced privacy controls
    cookieConsent: z.object({
      necessary: z.boolean().default(true),
      analytics: z.boolean().default(true),
      marketing: z.boolean().default(false),
      personalization: z.boolean().default(true),
      consentDate: z.string().optional(),
    }),
    dataRetention: z.object({
      autoDelete: z.boolean().default(false),
      retentionPeriod: z.number().default(365),
      lastCleanup: z.string().optional(),
    }),
  }).optional(),
  
  // NEW: Performance preferences (optional section)
  performance: z.object({
    enableAnimations: z.boolean().default(true),
    lazyLoading: z.boolean().default(true),
    prefetchData: z.boolean().default(true),
    compressionLevel: z.enum(['none', 'low', 'medium', 'high']).default('medium'),
    cacheStrategy: z.enum(['aggressive', 'balanced', 'minimal']).default('balanced'),
  }).optional(),
  
  // NEW: Advanced user preferences (optional section)
  advanced: z.object({
    developerMode: z.boolean().default(false),
    betaFeatures: z.boolean().default(false),
    debugMode: z.boolean().default(false),
    experimentalFeatures: z.array(z.string()).default([]),
    customShortcuts: z.record(z.string()).default({}),
  }).optional(),
})

const SettingsPersistedV3Schema = z.object({
  userSettings: UserSettingsV3Schema.nullable(),
  lastSaved: z.string().nullable(),
})

type SettingsPersistedV3 = z.infer<typeof SettingsPersistedV3Schema>
type UserSettingsV3 = z.infer<typeof UserSettingsV3Schema>

// Migration from V2 to V3: Add performance and advanced preferences
const settingsV2ToV3Migration: Migration<SettingsPersistedV2, SettingsPersistedV3> = {
  version: 2 as const,
  targetVersion: 3 as const,
  storeName: 'settings-store' as const,
  description: 'Add performance preferences and advanced user controls',
  createdAt: new Date().toISOString(),
  isBreaking: false as const,
  
  // Forward migration: V2 -> V3 with enhanced privacy and performance
  up: (state: SettingsPersistedV2): SettingsPersistedV3 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    // Type-safe migration to V3 - preserve existing data, add new V3 features
    const migratedSettings: UserSettingsV3 = {
      ...state.userSettings,
      
      // NEW V3: Enhanced privacy settings (completely new section in V3)
      privacy: {
        // Base privacy defaults for V3
        dataSharing: false,
        analytics: true,
        marketing: false,
        thirdPartyIntegrations: true,
        // NEW V3: Cookie consent management
        cookieConsent: {
          necessary: true,
          analytics: true,
          marketing: false,
          personalization: true,
          consentDate: undefined,
        },
        // NEW V3: Data retention policies
        dataRetention: {
          autoDelete: false,
          retentionPeriod: 365,
          lastCleanup: undefined,
        },
      },
      
      // NEW V3: Performance preferences
      performance: {
        enableAnimations: true,
        lazyLoading: true,
        prefetchData: true,
        compressionLevel: 'medium' as const,
        cacheStrategy: 'balanced' as const,
      },
      
      // NEW V3: Advanced user preferences
      advanced: {
        developerMode: false,
        betaFeatures: false,
        debugMode: false,
        experimentalFeatures: [],
        customShortcuts: {},
      },
    }
    
    return {
      userSettings: migratedSettings,
      lastSaved: state.lastSaved,
    }
  },
  
  // Rollback migration: V3 -> V2 with type safety
  down: (state: SettingsPersistedV3): SettingsPersistedV2 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    // Remove V3-specific properties with type safety
    const { performance: _performance, advanced: _advanced, privacy: _privacy, ...rest } = state.userSettings
    
    // V2 doesn't have privacy section - it was introduced in V3
    // So we completely remove it during rollback to maintain V2 schema compatibility
    const rolledBackSettings: UserSettingsV2 = {
      ...rest,
      // V2 schema doesn't include privacy section
      // This is intentional data loss during rollback from V3 to V2
    }
    
    return {
      userSettings: rolledBackSettings,
      lastSaved: state.lastSaved,
    }
  },
  
  // Validation schemas - properly typed with strict schema compatibility
  fromSchema: SettingsPersistedV2Schema as z.ZodSchema<SettingsPersistedV2>,
  toSchema: SettingsPersistedV3Schema as z.ZodSchema<SettingsPersistedV3>,
}

// ======================
// VERSION 3 -> VERSION 4
// ======================

// V4 Schema (extends V3 with workspace and collaboration settings) using spread syntax
const UserSettingsV4Schema = z.object({
  // Inherit all V3 fields (includes V1 base + V2 theme/accessibility + V3 privacy/performance/advanced)
  ...UserSettingsV3Schema.shape,
  
  // NEW: Workspace settings (optional section)
  workspace: z.object({
    defaultView: z.enum(['dashboard', 'campaigns', 'analytics', 'settings']).default('dashboard'),
    sidebarCollapsed: z.boolean().default(false),
    recentItems: z.array(z.object({
      id: z.string(),
      type: z.string(),
      name: z.string(),
      accessedAt: z.string(),
    })).default([]),
    favorites: z.array(z.string()).default([]),
    workspaceLayout: z.record(z.unknown()).default({}),
  }).optional(),
  
  // NEW: Collaboration preferences (optional section)
  collaboration: z.object({
    shareAnalytics: z.boolean().default(false),
    allowComments: z.boolean().default(true),
    notifyOnMentions: z.boolean().default(true),
    autoShareReports: z.boolean().default(false),
    collaboratorVisibility: z.enum(['public', 'team', 'private']).default('team'),
  }).optional(),
})

const SettingsPersistedV4Schema = z.object({
  userSettings: UserSettingsV4Schema.nullable(),
  lastSaved: z.string().nullable(),
})

type SettingsPersistedV4 = z.infer<typeof SettingsPersistedV4Schema>
type UserSettingsV4 = z.infer<typeof UserSettingsV4Schema>

// Migration from V3 to V4: Add workspace and collaboration settings
const settingsV3ToV4Migration: Migration<SettingsPersistedV3, SettingsPersistedV4> = {
  version: 3 as const,
  targetVersion: 4 as const,
  storeName: 'settings-store' as const,
  description: 'Add workspace and collaboration preferences',
  createdAt: new Date().toISOString(),
  isBreaking: false as const,
  
  // Forward migration: V3 -> V4 with workspace and collaboration
  up: (state: SettingsPersistedV3): SettingsPersistedV4 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    // Type-safe migration to V4
    const migratedSettings: UserSettingsV4 = {
      ...state.userSettings,
      // New workspace settings
      workspace: {
        defaultView: 'dashboard' as const,
        sidebarCollapsed: false,
        recentItems: [],
        favorites: [],
        workspaceLayout: {},
      },
      // New collaboration preferences
      collaboration: {
        shareAnalytics: false,
        allowComments: true,
        notifyOnMentions: true,
        autoShareReports: false,
        collaboratorVisibility: 'team' as const,
      },
    }
    
    return {
      userSettings: migratedSettings,
      lastSaved: state.lastSaved,
    }
  },
  
  // Rollback migration: V4 -> V3 with type safety
  down: (state: SettingsPersistedV4): SettingsPersistedV3 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    // Remove V4-specific properties with type safety
    const { workspace: _workspace, collaboration: _collaboration, ...rest } = state.userSettings
    
    const rolledBackSettings: UserSettingsV3 = rest
    
    return {
      userSettings: rolledBackSettings,
      lastSaved: state.lastSaved,
    }
  },
  
  // Validation schemas - properly typed with strict schema compatibility
  fromSchema: SettingsPersistedV3Schema as z.ZodSchema<SettingsPersistedV3>,
  toSchema: SettingsPersistedV4Schema as z.ZodSchema<SettingsPersistedV4>,
}

// Register all migrations
registerMigration(settingsV1ToV2Migration)
registerMigration(settingsV2ToV3Migration)
registerMigration(settingsV3ToV4Migration)

// Export schemas for testing
export {
  SettingsPersistedV1Schema,
  SettingsPersistedV2Schema,
  SettingsPersistedV3Schema,
  SettingsPersistedV4Schema,
}

// Export types for testing
export type {
  SettingsPersistedV1,
  SettingsPersistedV2,
  SettingsPersistedV3,
  SettingsPersistedV4,
}

// Export migrations for testing
export {
  settingsV1ToV2Migration,
  settingsV2ToV3Migration,
  settingsV3ToV4Migration,
}

// Development utilities interface
interface WindowWithDceMigrations extends Window {
  __dceSettingsMigrations?: {
    v1ToV2: typeof settingsV1ToV2Migration
    v2ToV3: typeof settingsV2ToV3Migration
    v3ToV4: typeof settingsV3ToV4Migration
    schemas: {
      v1: typeof SettingsPersistedV1Schema
      v2: typeof SettingsPersistedV2Schema
      v3: typeof SettingsPersistedV3Schema
      v4: typeof SettingsPersistedV4Schema
    }
  }
}

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as WindowWithDceMigrations).__dceSettingsMigrations = {
    v1ToV2: settingsV1ToV2Migration,
    v2ToV3: settingsV2ToV3Migration,
    v3ToV4: settingsV3ToV4Migration,
    schemas: {
      v1: SettingsPersistedV1Schema,
      v2: SettingsPersistedV2Schema,
      v3: SettingsPersistedV3Schema,
      v4: SettingsPersistedV4Schema,
    },
  }
}