/**
 * Settings Store - Migrated to Standard Store Factory
 * 
 * This is the migrated version of settingsStore using the unified mutator chain.
 * It maintains backward compatibility while fixing TypeScript issues.
 */

import { createStandardStore } from './factories/createStandardStore'
import type { StandardStateCreator } from './types/mutators'
import { supabase } from '../lib/supabase'
// Removed unused storage imports - using simple localStorage for non-sensitive data
import { settingsToJson, isValidSupplierSettings, isValidBuyerSettings, isValidNetworkSettings } from './types/enhanced'
import type {
  UserSettings,
  SupplierSettings,
  BuyerSettings,
  NetworkSettings,
  AdminSettings,
} from '../types/settings'
import {
  validateUserSettings,
  isSupplierSettings,
  isBuyerSettings,
  isNetworkSettings,
} from '../types/settings'
import { useAuthStore } from './authStore'

export interface SettingsState {
  // Settings data
  userSettings: UserSettings | null
  roleSettings: unknown // Simplified to avoid infinite type recursion, properly typed in components

  // State flags
  isLoading: boolean
  isSaving: boolean
  isDirty: boolean
  error: string | null
  lastSaved: string | null

  // Actions
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
  updateUserSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void
  updateRoleSetting: (path: string, value: unknown) => void
  resetSettings: () => Promise<void>
  exportSettings: () => Promise<Blob>
  importSettings: (file: File) => Promise<void>

  // Utility actions
  setDirty: (dirty: boolean) => void
  clearError: () => void
}

// Create store state using Immer (no need for updateNestedObject with Immer)
const createSettingsState: StandardStateCreator<SettingsState> = (set, get) => ({
  // Initial state
  userSettings: null,
  roleSettings: null,
  isLoading: false,
  isSaving: false,
  isDirty: false,
  error: null,
  lastSaved: null,

  // Load settings from database
  loadSettings: async () => {
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    try {
      const { user, userType } = useAuthStore.getState()
      if (!user) throw new Error('User not authenticated')

      // Load user settings from metadata with proper typing
      const { data: userData, error: userError } = await supabase!
        .from('users')
        .select('metadata')
        .eq('id', user.id)
        .single()

      if (userError) throw userError

      // Type-safe metadata extraction - no implicit 'any'
      const metadataRecord: Record<string, unknown> = 
        typeof userData.metadata === 'object' && userData.metadata !== null 
          ? userData.metadata as Record<string, unknown>
          : {}
      
      const settingsData: Partial<UserSettings> = 
        typeof metadataRecord.settings === 'object' && metadataRecord.settings !== null
          ? metadataRecord.settings as Partial<UserSettings>
          : {}
      
      const userSettings = validateUserSettings(settingsData)

      // Load role-specific settings
      let roleSettings = null

      if (userType === 'supplier') {
        const { data, error } = await supabase!
          .from('suppliers')
          .select('settings')
          .eq('user_id', user.id)
          .single()

        if (error) throw error
        if (data?.settings && isSupplierSettings(data.settings)) {
          roleSettings = data.settings as SupplierSettings
        }
      } else if (userType === 'buyer') {
        const { data, error } = await supabase!
          .from('buyers')
          .select('settings')
          .eq('user_id', user.id)
          .single()

        if (error) throw error
        if (data?.settings && isBuyerSettings(data.settings)) {
          roleSettings = data.settings as BuyerSettings
        }
      } else if (userType === 'network' && 'networkId' in user && user.networkId) {
        const { data, error } = await supabase!
          .from('networks')
          .select('settings')
          .eq('id', (user as { networkId: string }).networkId)
          .single()

        if (error) throw error
        if (data?.settings && isNetworkSettings(data.settings)) {
          roleSettings = data.settings as NetworkSettings
        }
      } else if (userType === 'admin' && 'adminId' in user && user.adminId) {
        const { error } = await supabase!
          .from('admins')
          .select('permissions')
          .eq('id', (user as { adminId: string }).adminId)
          .single()

        if (error) throw error
        // Admin settings - create defaults for now
        if (userType === 'admin') {
          roleSettings = createDefaultAdminSettings()
        }
      }

      set({
        userSettings,
        roleSettings,
        isLoading: false,
        isDirty: false
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to load settings'
        state.isLoading = false
      })
    }
  },

  // Save settings to database
  saveSettings: async () => {
    const state = get()
    if (!state.isDirty || state.isSaving) return

    set((state) => {
      state.isSaving = true
      state.error = null
    })

    try {
      const { user, userType } = useAuthStore.getState()
      if (!user) throw new Error('User not authenticated')

      // Save user settings
      if (state.userSettings) {
        const updatedSettings = {
          ...state.userSettings,
          updatedAt: new Date().toISOString(),
        }

        // First fetch current metadata
        const { data: userData } = await supabase!
          .from('users')
          .select('metadata')
          .eq('id', user.id)
          .single()

        const currentMetadata = userData?.metadata || {}
        const metadataObject =
          typeof currentMetadata === 'object' && currentMetadata !== null
            ? (currentMetadata as unknown as Record<string, unknown>)
            : {}

        // Then update with new settings - explicit typing
        const newMetadata: Record<string, unknown> = {
          ...metadataObject,
          settings: updatedSettings,
        }
        
        const { error } = await supabase!
          .from('users')
          .update({
            metadata: settingsToJson(newMetadata) as Record<string, unknown>,
          })
          .eq('id', user.id)

        if (error) throw error
      }

      // Save role-specific settings
      if (state.roleSettings) {
        const updatedSettings = {
          ...state.roleSettings,
          updatedAt: new Date().toISOString(),
        }

        if (userType === 'supplier' && isValidSupplierSettings(updatedSettings)) {
          const { error } = await supabase!
            .from('suppliers')
            .update({
              settings: settingsToJson(updatedSettings, isValidSupplierSettings),
              settings_updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)

          if (error) throw error
        } else if (userType === 'buyer' && isValidBuyerSettings(updatedSettings)) {
          const { error } = await supabase!
            .from('buyers')
            .update({
              settings: settingsToJson(updatedSettings, isValidBuyerSettings),
              settings_updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)

          if (error) throw error
        } else if (userType === 'network' && 'networkId' in user && user.networkId && isValidNetworkSettings(updatedSettings)) {
          const { error } = await supabase!
            .from('networks')
            .update({
              settings: settingsToJson(updatedSettings, isValidNetworkSettings),
              settings_updated_at: new Date().toISOString(),
            })
            .eq('id', (user as { networkId: string }).networkId)

          if (error) throw error
        } else if (userType === 'admin' && 'adminId' in user && user.adminId) {
          // Admin settings would need a separate table or different approach
          console.warn('Admin settings saving not implemented - needs separate table')
        }
      }

      // Log settings change to audit log with proper typing
      const auditLogValue: Record<string, unknown> = {
        user: state.userSettings,
        role: state.roleSettings,
      }
      
      await supabase!.from('settings_audit_log').insert({
        user_id: user.id,
        setting_type: userType as 'user' | 'supplier' | 'buyer' | 'network' | 'admin',
        setting_key: 'all',
        action: 'update',
        new_value: settingsToJson(auditLogValue) as Record<string, unknown>,
      })

      set((state) => {
        state.isSaving = false
        state.isDirty = false
        state.lastSaved = new Date().toISOString()
      })
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to save settings'
        state.isSaving = false
      })
    }
  },

  // Update user setting
  updateUserSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    set((state) => {
      if (state.userSettings) {
        state.userSettings[key] = value
      }
      state.isDirty = true
    })
  },

  // Update role-specific setting with Immer - proper typing to avoid implicit 'any'
  updateRoleSetting: (path: string, value: unknown) => {
    set((state) => {
      if (!state.roleSettings) return
      
      // Type-safe path updates - use a more type-safe approach
      const keys = path.split('.')
      let current: unknown = state.roleSettings
      
      // Navigate to the parent object with type safety
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]
        if (typeof current !== 'object' || current === null) {
          return // Can't navigate further - exit safely
        }
        const currentObj = current as Record<string, unknown>
        if (!(key in currentObj) || typeof currentObj[key] !== 'object' || currentObj[key] === null) {
          currentObj[key] = {} as Record<string, unknown>
        }
        current = currentObj[key]
      }
      
      // Set the value with explicit typing
      if (typeof current === 'object' && current !== null) {
        const finalKey = keys[keys.length - 1]
        const currentObj = current as Record<string, unknown>
        currentObj[finalKey] = value
        state.isDirty = true
      }
    })
  },

  // Reset settings to defaults
  resetSettings: async () => {
    set((state) => {
      state.isLoading = true
    })

    try {
      // Load default settings based on user type
      const { userType } = useAuthStore.getState()

      // Apply default templates
      const defaultUserSettings = validateUserSettings({})

      let defaultRoleSettings = null
      if (userType === 'supplier') {
        // Load default supplier template
        const { data } = await supabase!
          .from('settings_templates')
          .select('settings')
          .eq('user_type', 'supplier')
          .eq('is_default', true)
          .single()

        if (data?.settings && isSupplierSettings(data.settings)) {
          defaultRoleSettings = data.settings
        }
      }
      // Similar for other user types...

      set((state) => {
        state.userSettings = defaultUserSettings
        state.roleSettings = defaultRoleSettings
        state.isDirty = true
        state.isLoading = false
      })

      // Auto-save after reset
      await get().saveSettings()
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to reset settings'
        state.isLoading = false
      })
    }
  },

  // Export settings
  exportSettings: async () => {
    const state = get()
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userSettings: state.userSettings,
      roleSettings: state.roleSettings,
      userType: useAuthStore.getState().userType,
    }

    return new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
  },

  // Import settings
  importSettings: async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (data.version !== 1) {
        throw new Error('Unsupported settings version')
      }

      // Validate imported settings
      const userSettings = validateUserSettings(data.userSettings || {})

      set((state) => {
        state.userSettings = userSettings
        state.roleSettings = data.roleSettings
        state.isDirty = true
      })

      // Auto-save after import
      await get().saveSettings()
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to import settings'
      })
    }
  },

  // Utility actions
  setDirty: (dirty: boolean) => {
    set((state) => {
      state.isDirty = dirty
    })
  },
  
  clearError: () => {
    set((state) => {
      state.error = null
    })
  },
})

// Helper function for default admin settings
function createDefaultAdminSettings(): AdminSettings {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    permissions: {
      fullAccess: true,
      modules: [],
      dataAccess: 'full' as const,
      userManagement: true,
      systemConfiguration: true,
      billingAccess: true,
    },
    systemConfig: {
      platformSettings: {
        siteName: '',
        siteUrl: '',
        supportEmail: '',
        timezone: 'UTC',
        maintenanceMode: false,
      },
      securityPolicies: [],
      integrationSettings: {
        providers: {},
        limits: {},
        defaults: {},
      },
      featureFlags: [],
      rateLimits: [],
    },
    auditLog: {
      enabled: true,
      retention: 90,
      logLevel: 'info' as const,
      includeReadOperations: false,
      sensitiveDataMasking: true,
      exportFormat: 'json' as const,
    },
    monitoring: {
      healthChecks: [],
      alertChannels: [],
      performanceMetrics: {
        sampleRate: 1,
        metrics: [],
        thresholds: {},
      },
      errorTracking: {
        provider: '',
        projectId: '',
        environment: 'production',
        sampleRate: 1,
      },
      uptimeMonitoring: {
        monitors: [],
        statusPage: false,
      },
    },
    maintenance: {
      maintenanceWindow: {
        dayOfWeek: 0,
        startHour: 0,
        duration: 0,
        timezone: 'UTC',
      },
      backupSchedule: {
        frequency: 'daily',
        retention: 30,
        location: '',
        encryption: true,
      },
      updatePolicy: {
        autoUpdate: false,
        schedule: 'manual',
        testing: true,
        rollback: true,
      },
      disasterRecovery: {
        rpo: 24,
        rto: 4,
        backupRegions: [],
        testFrequency: 'quarterly',
      },
    },
  }
}

// Create the store using the standard factory
export const useSettingsStore = createStandardStore<SettingsState>({
  name: 'settings-store',
  creator: createSettingsState,
  persist: {
    // SECURITY: Only persist non-sensitive user settings - NO API keys or credentials
    partialize: (state): SettingsState => {
      // Return only the safe parts of the state for persistence
      return {
        ...state,
        userSettings: state.userSettings ? {
          profile: state.userSettings.profile,
          preferences: state.userSettings.preferences,
          notifications: state.userSettings.notifications,
          security: state.userSettings.security,
          version: state.userSettings.version,
          updatedAt: state.userSettings.updatedAt,
        } : null,
        lastSaved: state.lastSaved,
        // Reset sensitive data for persistence
        roleSettings: null,
      }
    },
    // Use standard localStorage for non-sensitive settings data
    // (Sensitive data like API keys/tokens are filtered out in partialize above)
    storage: {
      getItem: (name: string) => {
        const item = localStorage.getItem(name)
        return item ? JSON.parse(item) : null
      },
      setItem: (name: string, value: unknown) => {
        localStorage.setItem(name, JSON.stringify(value))
      },
      removeItem: (name: string) => localStorage.removeItem(name),
    },
  },
  monitoring: {
    enabled: true,
    trackPerformance: true,
  },
})

// Export the type for external use
export type UseSettingsStore = typeof useSettingsStore