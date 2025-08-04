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

// V1 Schema (initial - basic user settings)
const SettingsPersistedV1Schema = z.object({
  userSettings: UserSettingsSchema.nullable(),
  lastSaved: z.string().nullable(),
})

// V2 Schema (adds theme customization and accessibility)
const SettingsPersistedV2Schema = z.object({
  userSettings: z.object({
    version: z.number().default(1),
    updatedAt: z.string(),
    profile: z.object({
      displayName: z.string().optional(),
      timezone: z.string().default('UTC'),
      language: z.string().default('en'),
      dateFormat: z.string().default('MM/DD/YYYY'),
      timeFormat: z.enum(['12h', '24h']).default('12h'),
    }).optional(),
    notifications: z.object({
      email: z.object({
        enabled: z.boolean().default(true),
        frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).default('immediate'),
        campaigns: z.boolean().default(true),
        billing: z.boolean().default(true),
        system: z.boolean().default(true),
        marketing: z.boolean().default(false),
      }).optional(),
      push: z.object({
        enabled: z.boolean().default(false),
        campaigns: z.boolean().default(false),
        billing: z.boolean().default(true),
        system: z.boolean().default(true),
      }).optional(),
      sms: z.object({
        enabled: z.boolean().default(false),
        campaigns: z.boolean().default(false),
        billing: z.boolean().default(false),
        emergency: z.boolean().default(true),
      }).optional(),
    }).optional(),
    privacy: z.object({
      dataSharing: z.boolean().default(false),
      analytics: z.boolean().default(true),
      marketing: z.boolean().default(false),
      thirdPartyIntegrations: z.boolean().default(true),
    }).optional(),
    dashboard: z.object({
      layout: z.enum(['compact', 'standard', 'expanded']).default('standard'),
      widgets: z.array(z.string()).default([]),
      refreshInterval: z.number().default(30000),
      showWelcome: z.boolean().default(true),
    }).optional(),
    
    // NEW: Theme customization
    theme: z.object({
      mode: z.enum(['light', 'dark', 'auto']).default('auto'),
      primaryColor: z.string().default('#0066cc'),
      accentColor: z.string().default('#ff6600'),
      customCss: z.string().optional(),
      highContrast: z.boolean().default(false),
    }).optional(),
    
    // NEW: Accessibility preferences
    accessibility: z.object({
      reducedMotion: z.boolean().default(false),
      screenReader: z.boolean().default(false),
      keyboardNavigation: z.boolean().default(false),
      fontSize: z.enum(['small', 'medium', 'large', 'extra-large']).default('medium'),
      focusIndicator: z.boolean().default(true),
    }).optional(),
  }).nullable(),
  lastSaved: z.string().nullable(),
})

type SettingsPersistedV1 = z.infer<typeof SettingsPersistedV1Schema>
type SettingsPersistedV2 = z.infer<typeof SettingsPersistedV2Schema>

// Migration from V1 to V2: Add theme and accessibility settings
const settingsV1ToV2Migration: Migration<SettingsPersistedV1, SettingsPersistedV2> = {
  version: 1,
  targetVersion: 2,
  storeName: 'settings-store',
  description: 'Add theme customization and accessibility preferences',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V1 -> V2
  up: (state: SettingsPersistedV1): SettingsPersistedV2 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    return {
      userSettings: {
        ...state.userSettings,
        theme: {
          mode: 'auto' as const,
          primaryColor: '#0066cc',
          accentColor: '#ff6600',
          customCss: undefined,
          highContrast: false,
        },
        accessibility: {
          reducedMotion: false,
          screenReader: false,
          keyboardNavigation: false,
          fontSize: 'medium' as const,
          focusIndicator: true,
        },
      },
      lastSaved: state.lastSaved,
    }
  },
  
  // Rollback migration: V2 -> V1
  down: (state: SettingsPersistedV2): SettingsPersistedV1 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { theme, accessibility, ...rest } = state.userSettings
    return {
      userSettings: rest,
      lastSaved: state.lastSaved,
    }
  },
  
  // Validation schemas
  fromSchema: SettingsPersistedV1Schema,
  toSchema: SettingsPersistedV2Schema,
}

// ======================
// VERSION 2 -> VERSION 3
// ======================

// V3 Schema (adds performance and advanced preferences)
const SettingsPersistedV3Schema = z.object({
  userSettings: z.object({
    version: z.number().default(1),
    updatedAt: z.string(),
    profile: z.object({
      displayName: z.string().optional(),
      timezone: z.string().default('UTC'),
      language: z.string().default('en'),
      dateFormat: z.string().default('MM/DD/YYYY'),
      timeFormat: z.enum(['12h', '24h']).default('12h'),
    }).optional(),
    notifications: z.object({
      email: z.object({
        enabled: z.boolean().default(true),
        frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).default('immediate'),
        campaigns: z.boolean().default(true),
        billing: z.boolean().default(true),
        system: z.boolean().default(true),
        marketing: z.boolean().default(false),
      }).optional(),
      push: z.object({
        enabled: z.boolean().default(false),
        campaigns: z.boolean().default(false),
        billing: z.boolean().default(true),
        system: z.boolean().default(true),
      }).optional(),
      sms: z.object({
        enabled: z.boolean().default(false),
        campaigns: z.boolean().default(false),
        billing: z.boolean().default(false),
        emergency: z.boolean().default(true),
      }).optional(),
    }).optional(),
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
      }).default({
        necessary: true,
        analytics: true,
        marketing: false,
        personalization: true,
      }),
      dataRetention: z.object({
        autoDelete: z.boolean().default(false),
        retentionPeriod: z.number().default(365), // days
        lastCleanup: z.string().optional(),
      }).default({
        autoDelete: false,
        retentionPeriod: 365,
      }),
    }).optional(),
    dashboard: z.object({
      layout: z.enum(['compact', 'standard', 'expanded']).default('standard'),
      widgets: z.array(z.string()).default([]),
      refreshInterval: z.number().default(30000),
      showWelcome: z.boolean().default(true),
    }).optional(),
    theme: z.object({
      mode: z.enum(['light', 'dark', 'auto']).default('auto'),
      primaryColor: z.string().default('#0066cc'),
      accentColor: z.string().default('#ff6600'),
      customCss: z.string().optional(),
      highContrast: z.boolean().default(false),
    }).optional(),
    accessibility: z.object({
      reducedMotion: z.boolean().default(false),
      screenReader: z.boolean().default(false),
      keyboardNavigation: z.boolean().default(false),
      fontSize: z.enum(['small', 'medium', 'large', 'extra-large']).default('medium'),
      focusIndicator: z.boolean().default(true),
    }).optional(),
    
    // NEW: Performance preferences
    performance: z.object({
      enableAnimations: z.boolean().default(true),
      lazyLoading: z.boolean().default(true),
      prefetchData: z.boolean().default(true),
      compressionLevel: z.enum(['none', 'low', 'medium', 'high']).default('medium'),
      cacheStrategy: z.enum(['aggressive', 'balanced', 'minimal']).default('balanced'),
    }).optional(),
    
    // NEW: Advanced user preferences
    advanced: z.object({
      developerMode: z.boolean().default(false),
      betaFeatures: z.boolean().default(false),
      debugMode: z.boolean().default(false),
      experimentalFeatures: z.array(z.string()).default([]),
      customShortcuts: z.record(z.string()).default({}),
    }).optional(),
  }).nullable(),
  lastSaved: z.string().nullable(),
})

type SettingsPersistedV3 = z.infer<typeof SettingsPersistedV3Schema>

// Migration from V2 to V3: Add performance and advanced preferences
const settingsV2ToV3Migration: Migration<SettingsPersistedV2, SettingsPersistedV3> = {
  version: 2,
  targetVersion: 3,
  storeName: 'settings-store',
  description: 'Add performance preferences and advanced user controls',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V2 -> V3
  up: (state: SettingsPersistedV2): SettingsPersistedV3 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    return {
      userSettings: {
        ...state.userSettings,
        privacy: {
          ...state.userSettings.privacy,
          cookieConsent: {
            necessary: true,
            analytics: true,
            marketing: false,
            personalization: true,
            consentDate: undefined,
          },
          dataRetention: {
            autoDelete: false,
            retentionPeriod: 365,
            lastCleanup: undefined,
          },
        },
        performance: {
          enableAnimations: true,
          lazyLoading: true,
          prefetchData: true,
          compressionLevel: 'medium' as const,
          cacheStrategy: 'balanced' as const,
        },
        advanced: {
          developerMode: false,
          betaFeatures: false,
          debugMode: false,
          experimentalFeatures: [],
          customShortcuts: {},
        },
      },
      lastSaved: state.lastSaved,
    }
  },
  
  // Rollback migration: V3 -> V2
  down: (state: SettingsPersistedV3): SettingsPersistedV2 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { performance, advanced, ...rest } = state.userSettings
    const updatedPrivacy = rest.privacy ? {
      ...rest.privacy,
      cookieConsent: undefined,
      dataRetention: undefined,
    } : rest.privacy
    
    return {
      userSettings: {
        ...rest,
        privacy: updatedPrivacy,
      },
      lastSaved: state.lastSaved,
    }
  },
  
  // Validation schemas
  fromSchema: SettingsPersistedV2Schema,
  toSchema: SettingsPersistedV3Schema,
}

// ======================
// VERSION 3 -> VERSION 4
// ======================

// V4 Schema (adds workspace and collaboration settings)
const SettingsPersistedV4Schema = z.object({
  userSettings: z.object({
    version: z.number().default(1),
    updatedAt: z.string(),
    profile: z.object({
      displayName: z.string().optional(),
      timezone: z.string().default('UTC'),
      language: z.string().default('en'),
      dateFormat: z.string().default('MM/DD/YYYY'),
      timeFormat: z.enum(['12h', '24h']).default('12h'),
    }).optional(),
    notifications: z.object({
      email: z.object({
        enabled: z.boolean().default(true),
        frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).default('immediate'),
        campaigns: z.boolean().default(true),
        billing: z.boolean().default(true),
        system: z.boolean().default(true),
        marketing: z.boolean().default(false),
      }).optional(),
      push: z.object({
        enabled: z.boolean().default(false),
        campaigns: z.boolean().default(false),
        billing: z.boolean().default(true),
        system: z.boolean().default(true),
      }).optional(),
      sms: z.object({
        enabled: z.boolean().default(false),
        campaigns: z.boolean().default(false),
        billing: z.boolean().default(false),
        emergency: z.boolean().default(true),
      }).optional(),
    }).optional(),
    privacy: z.object({
      dataSharing: z.boolean().default(false),
      analytics: z.boolean().default(true),
      marketing: z.boolean().default(false),
      thirdPartyIntegrations: z.boolean().default(true),
      cookieConsent: z.object({
        necessary: z.boolean().default(true),
        analytics: z.boolean().default(true),
        marketing: z.boolean().default(false),
        personalization: z.boolean().default(true),
        consentDate: z.string().optional(),
      }).default({
        necessary: true,
        analytics: true,
        marketing: false,
        personalization: true,
      }),
      dataRetention: z.object({
        autoDelete: z.boolean().default(false),
        retentionPeriod: z.number().default(365),
        lastCleanup: z.string().optional(),
      }).default({
        autoDelete: false,
        retentionPeriod: 365,
      }),
    }).optional(),
    dashboard: z.object({
      layout: z.enum(['compact', 'standard', 'expanded']).default('standard'),
      widgets: z.array(z.string()).default([]),
      refreshInterval: z.number().default(30000),
      showWelcome: z.boolean().default(true),
    }).optional(),
    theme: z.object({
      mode: z.enum(['light', 'dark', 'auto']).default('auto'),
      primaryColor: z.string().default('#0066cc'),
      accentColor: z.string().default('#ff6600'),
      customCss: z.string().optional(),
      highContrast: z.boolean().default(false),
    }).optional(),
    accessibility: z.object({
      reducedMotion: z.boolean().default(false),
      screenReader: z.boolean().default(false),
      keyboardNavigation: z.boolean().default(false),
      fontSize: z.enum(['small', 'medium', 'large', 'extra-large']).default('medium'),
      focusIndicator: z.boolean().default(true),
    }).optional(),
    performance: z.object({
      enableAnimations: z.boolean().default(true),
      lazyLoading: z.boolean().default(true),
      prefetchData: z.boolean().default(true),
      compressionLevel: z.enum(['none', 'low', 'medium', 'high']).default('medium'),
      cacheStrategy: z.enum(['aggressive', 'balanced', 'minimal']).default('balanced'),
    }).optional(),
    advanced: z.object({
      developerMode: z.boolean().default(false),
      betaFeatures: z.boolean().default(false),
      debugMode: z.boolean().default(false),
      experimentalFeatures: z.array(z.string()).default([]),
      customShortcuts: z.record(z.string()).default({}),
    }).optional(),
    
    // NEW: Workspace settings
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
    
    // NEW: Collaboration preferences
    collaboration: z.object({
      shareAnalytics: z.boolean().default(false),
      allowComments: z.boolean().default(true),
      notifyOnMentions: z.boolean().default(true),
      autoShareReports: z.boolean().default(false),
      collaboratorVisibility: z.enum(['public', 'team', 'private']).default('team'),
    }).optional(),
  }).nullable(),
  lastSaved: z.string().nullable(),
})

type SettingsPersistedV4 = z.infer<typeof SettingsPersistedV4Schema>

// Migration from V3 to V4: Add workspace and collaboration settings
const settingsV3ToV4Migration: Migration<SettingsPersistedV3, SettingsPersistedV4> = {
  version: 3,
  targetVersion: 4,
  storeName: 'settings-store',
  description: 'Add workspace and collaboration preferences',
  createdAt: new Date().toISOString(),
  isBreaking: false,
  
  // Forward migration: V3 -> V4
  up: (state: SettingsPersistedV3): SettingsPersistedV4 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    return {
      userSettings: {
        ...state.userSettings,
        workspace: {
          defaultView: 'dashboard' as const,
          sidebarCollapsed: false,
          recentItems: [],
          favorites: [],
          workspaceLayout: {},
        },
        collaboration: {
          shareAnalytics: false,
          allowComments: true,
          notifyOnMentions: true,
          autoShareReports: false,
          collaboratorVisibility: 'team' as const,
        },
      },
      lastSaved: state.lastSaved,
    }
  },
  
  // Rollback migration: V4 -> V3
  down: (state: SettingsPersistedV4): SettingsPersistedV3 => {
    if (!state.userSettings) {
      return {
        userSettings: null,
        lastSaved: state.lastSaved,
      }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { workspace, collaboration, ...rest } = state.userSettings
    return {
      userSettings: rest,
      lastSaved: state.lastSaved,
    }
  },
  
  // Validation schemas
  fromSchema: SettingsPersistedV3Schema,
  toSchema: SettingsPersistedV4Schema,
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