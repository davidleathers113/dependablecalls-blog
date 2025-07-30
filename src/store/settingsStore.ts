import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type {
  UserSettings,
  SupplierSettings,
  BuyerSettings,
  NetworkSettings,
  AdminSettings
} from '../types/settings'
import {
  validateUserSettings,
  isSupplierSettings,
  isBuyerSettings,
  isNetworkSettings
} from '../types/settings'
import { useAuthStore } from './authStore'
import type { Json } from '../types/database.generated'

interface SettingsState {
  // Settings data
  userSettings: UserSettings | null
  roleSettings: SupplierSettings | BuyerSettings | NetworkSettings | AdminSettings | null
  
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

// Helper to update nested objects
function updateNestedObject(obj: unknown, path: string, value: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj
  
  const keys = path.split('.')
  const result = { ...obj } as Record<string, unknown>
  let current = result
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current[key] = { ...current[key] as Record<string, unknown> }
    current = current[key] as Record<string, unknown>
  }
  
  current[keys[keys.length - 1]] = value
  return result
}

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
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
          set({ isLoading: true, error: null })
          
          try {
            const { user, userType } = useAuthStore.getState()
            if (!user) throw new Error('User not authenticated')
            
            // Load user settings from metadata
            const { data: userData, error: userError } = await supabase.from('users')
              .select('metadata')
              .eq('id', user.id)
              .single()
              
            if (userError) throw userError
            
            const userSettings = validateUserSettings(
              typeof userData.metadata === 'object' && userData.metadata !== null && 
              typeof (userData.metadata as Record<string, unknown>).settings === 'object' ? 
              (userData.metadata as Record<string, unknown>).settings as Partial<UserSettings> : 
              {}
            )
            
            // Load role-specific settings
            let roleSettings = null
            
            if (userType === 'supplier') {
              const { data, error } = await supabase.from('suppliers')
                .select('settings')
                .eq('user_id', user.id)
                .single()
                
              if (error) throw error
              if (data?.settings && isSupplierSettings(data.settings)) {
                roleSettings = data.settings
              }
            } else if (userType === 'buyer') {
              const { data, error } = await supabase.from('buyers')
                .select('settings')
                .eq('user_id', user.id)
                .single()
                
              if (error) throw error
              if (data?.settings && isBuyerSettings(data.settings)) {
                roleSettings = data.settings
              }
            } else if (userType === 'network' && 'networkId' in user && user.networkId) {
              const { data, error } = await supabase
                .from('networks')
                .select('settings')
                .eq('id', (user as { networkId: string }).networkId)
                .single()
                
              if (error) throw error
              if (data?.settings && isNetworkSettings(data.settings)) {
                roleSettings = data.settings
              }
            } else if (userType === 'admin' && 'adminId' in user && user.adminId) {
              const { error } = await supabase
                .from('admins')
                .select('permissions')
                .eq('id', (user as { adminId: string }).adminId)
                .single()
                
              if (error) throw error
              // Admin settings are stored differently - they would need a separate table
              // For now, we'll create default admin settings
              if (userType === 'admin') {
                roleSettings = {
                  version: 1,
                  updatedAt: new Date().toISOString(),
                  permissions: {
                    fullAccess: true,
                    modules: [],
                    dataAccess: 'full' as const,
                    userManagement: true,
                    systemConfiguration: true,
                    billingAccess: true
                  },
                  systemConfig: {
                    platformSettings: {
                      siteName: '',
                      siteUrl: '',
                      supportEmail: '',
                      timezone: 'UTC',
                      maintenanceMode: false
                    },
                    securityPolicies: [],
                    integrationSettings: {
                      providers: {},
                      limits: {},
                      defaults: {}
                    },
                    featureFlags: [],
                    rateLimits: []
                  },
                  auditLog: {
                    enabled: true,
                    retention: 90,
                    logLevel: 'info' as const,
                    includeReadOperations: false,
                    sensitiveDataMasking: true,
                    exportFormat: 'json' as const
                  },
                  monitoring: {
                    healthChecks: [],
                    alertChannels: [],
                    performanceMetrics: {
                      sampleRate: 1,
                      metrics: [],
                      thresholds: {}
                    },
                    errorTracking: {
                      provider: '',
                      projectId: '',
                      environment: 'production',
                      sampleRate: 1
                    },
                    uptimeMonitoring: {
                      monitors: [],
                      statusPage: false
                    }
                  },
                  maintenance: {
                    maintenanceWindow: {
                      dayOfWeek: 0,
                      startHour: 0,
                      duration: 0,
                      timezone: 'UTC'
                    },
                    backupSchedule: {
                      frequency: 'daily',
                      retention: 30,
                      location: '',
                      encryption: true
                    },
                    updatePolicy: {
                      autoUpdate: false,
                      schedule: 'manual',
                      testing: true,
                      rollback: true
                    },
                    disasterRecovery: {
                      rpo: 24,
                      rto: 4,
                      backupRegions: [],
                      testFrequency: 'quarterly'
                    }
                  }
                } as AdminSettings
              }
            }
            
            set({
              userSettings,
              roleSettings,
              isLoading: false,
              isDirty: false
            })
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to load settings',
              isLoading: false
            })
          }
        },
        
        // Save settings to database
        saveSettings: async () => {
          const state = get()
          if (!state.isDirty || state.isSaving) return
          
          set({ isSaving: true, error: null })
          
          try {
            const { user, userType } = useAuthStore.getState()
            if (!user) throw new Error('User not authenticated')
            
            // Save user settings
            if (state.userSettings) {
              const updatedSettings = {
                ...state.userSettings,
                updatedAt: new Date().toISOString()
              }
              
              // First fetch current metadata
              const { data: userData } = await supabase
                .from('users')
                .select('metadata')
                .eq('id', user.id)
                .single()
              
              const currentMetadata = userData?.metadata || {}
              const metadataObject = typeof currentMetadata === 'object' && currentMetadata !== null 
                ? currentMetadata as Record<string, unknown>
                : {}
              
              // Then update with new settings
              const { error } = await supabase
                .from('users')
                .update({
                  metadata: {
                    ...metadataObject,
                    settings: updatedSettings
                  } as unknown as Json
                })
                .eq('id', user.id)
                
              if (error) throw error
            }
            
            // Save role-specific settings
            if (state.roleSettings) {
              const updatedSettings = {
                ...state.roleSettings,
                updatedAt: new Date().toISOString()
              }
              
              if (userType === 'supplier') {
                const { error } = await supabase
                  .from('suppliers')
                  .update({
                    settings: updatedSettings as unknown as Json,
                    settings_updated_at: new Date().toISOString()
                  })
                  .eq('user_id', user.id)
                  
                if (error) throw error
              } else if (userType === 'buyer') {
                const { error } = await supabase
                  .from('buyers')
                  .update({
                    settings: updatedSettings as unknown as Json,
                    settings_updated_at: new Date().toISOString()
                  })
                  .eq('user_id', user.id)
                  
                if (error) throw error
              } else if (userType === 'network' && 'networkId' in user && user.networkId) {
                const { error } = await supabase
                  .from('networks')
                  .update({
                    settings: updatedSettings as unknown as Json,
                    settings_updated_at: new Date().toISOString()
                  })
                  .eq('id', (user as { networkId: string }).networkId)
                  
                if (error) throw error
              } else if (userType === 'admin' && 'adminId' in user && user.adminId) {
                // Admin settings would need a separate table or different approach
                // For now, we'll skip saving admin settings
                console.warn('Admin settings saving not implemented - needs separate table')
              }
            }
            
            // Log settings change to audit log
            await supabase.from('settings_audit_log').insert({
              user_id: user.id,
              setting_type: userType as 'user' | 'supplier' | 'buyer' | 'network' | 'admin',
              setting_key: 'all',
              action: 'update',
              new_value: {
                user: state.userSettings,
                role: state.roleSettings
              } as Json
            })
            
            set({
              isSaving: false,
              isDirty: false,
              lastSaved: new Date().toISOString()
            })
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to save settings',
              isSaving: false
            })
          }
        },
        
        // Update user setting
        updateUserSetting: (key, value) => {
          set((state) => ({
            userSettings: state.userSettings ? {
              ...state.userSettings,
              [key]: value
            } : null,
            isDirty: true
          }))
        },
        
        // Update role-specific setting
        updateRoleSetting: (path, value) => {
          set((state) => ({
            roleSettings: updateNestedObject(state.roleSettings, path, value) as typeof state.roleSettings,
            isDirty: true
          }))
        },
        
        // Reset settings to defaults
        resetSettings: async () => {
          set({ isLoading: true })
          
          try {
            // Load default settings based on user type
            const { userType } = useAuthStore.getState()
            
            // Apply default templates
            const defaultUserSettings = validateUserSettings({})
            
            let defaultRoleSettings = null
            if (userType === 'supplier') {
              // Load default supplier template
              const { data } = await supabase
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
            
            set({
              userSettings: defaultUserSettings,
              roleSettings: defaultRoleSettings,
              isDirty: true,
              isLoading: false
            })
            
            // Auto-save after reset
            await get().saveSettings()
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to reset settings',
              isLoading: false
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
            userType: useAuthStore.getState().userType
          }
          
          return new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
          })
        },
        
        // Import settings
        importSettings: async (file) => {
          try {
            const text = await file.text()
            const data = JSON.parse(text)
            
            if (data.version !== 1) {
              throw new Error('Unsupported settings version')
            }
            
            // Validate imported settings
            const userSettings = validateUserSettings(data.userSettings || {})
            
            set({
              userSettings,
              roleSettings: data.roleSettings,
              isDirty: true
            })
            
            // Auto-save after import
            await get().saveSettings()
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Failed to import settings'
            })
          }
        },
        
        // Utility actions
        setDirty: (dirty) => set({ isDirty: dirty }),
        clearError: () => set({ error: null })
      }),
      {
        name: 'settings-storage',
        partialize: (state) => ({
          userSettings: state.userSettings,
          lastSaved: state.lastSaved
        })
      }
    )
  )
)

// Auto-save functionality
let autoSaveTimer: NodeJS.Timeout | null = null

useSettingsStore.subscribe(
  (state) => state.isDirty,
  (isDirty) => {
    if (isDirty) {
      // Clear existing timer
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
      }
      
      // Set new timer for auto-save after 5 seconds of inactivity
      autoSaveTimer = setTimeout(() => {
        useSettingsStore.getState().saveSettings()
      }, 5000)
    }
  }
)

// Subscribe to auth changes to reload settings
useAuthStore.subscribe(
  (state) => {
    const user = state.user
    if (user) {
      useSettingsStore.getState().loadSettings()
    } else {
      // Clear settings on logout
      useSettingsStore.setState({
        userSettings: null,
        roleSettings: null,
        isDirty: false
      })
    }
  }
)