import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'
import { z } from 'https://deno.land/x/zod@v3.21.4/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Validation schemas
const profileSettingsSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional(),
  timezone: z.string(),
  language: z.enum(['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja']),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MMM-YYYY']),
  phoneFormat: z.enum(['US', 'International', 'E.164']),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD'])
})

const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  dashboardLayout: z.enum(['compact', 'expanded', 'custom']),
  defaultPage: z.string(),
  tablePageSize: z.number().min(10).max(100),
  soundAlerts: z.boolean(),
  keyboardShortcuts: z.boolean(),
  autoRefresh: z.boolean(),
  refreshInterval: z.number().min(10).max(300),
  compactMode: z.boolean(),
  showOnboarding: z.boolean()
})

const emailNotificationsSchema = z.object({
  enabled: z.boolean(),
  newCalls: z.boolean(),
  callCompleted: z.boolean(),
  dailySummary: z.boolean(),
  weeklyReport: z.boolean(),
  monthlyReport: z.boolean(),
  campaignAlerts: z.boolean(),
  budgetAlerts: z.boolean(),
  qualityAlerts: z.boolean(),
  fraudAlerts: z.boolean(),
  systemUpdates: z.boolean(),
  marketingEmails: z.boolean()
})

const browserNotificationsSchema = z.object({
  enabled: z.boolean(),
  newCalls: z.boolean(),
  callStatus: z.boolean(),
  campaignAlerts: z.boolean(),
  systemAlerts: z.boolean(),
  sound: z.boolean(),
  vibrate: z.boolean()
})

const smsNotificationsSchema = z.object({
  enabled: z.boolean(),
  phoneNumber: z.string().optional(),
  urgentOnly: z.boolean(),
  fraudAlerts: z.boolean(),
  systemDowntime: z.boolean(),
  dailyLimit: z.number().min(0).max(100)
}).optional()

const quietHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string(),
  end: z.string(),
  timezone: z.string(),
  weekendsOnly: z.boolean(),
  excludeUrgent: z.boolean()
}).optional()

const notificationSettingsSchema = z.object({
  email: emailNotificationsSchema,
  browser: browserNotificationsSchema,
  sms: smsNotificationsSchema,
  quietHours: quietHoursSchema,
  frequency: z.enum(['realtime', 'hourly', 'daily', 'weekly'])
})

const securitySettingsSchema = z.object({
  twoFactorEnabled: z.boolean(),
  twoFactorMethod: z.enum(['app', 'sms', 'email']).optional(),
  sessionTimeout: z.number().min(5).max(1440),
  ipWhitelist: z.array(z.string().ip()),
  apiAccess: z.boolean(),
  loginNotifications: z.boolean(),
  activityAlerts: z.boolean(),
  dataExportEnabled: z.boolean()
})

const userSettingsSchema = z.object({
  profile: profileSettingsSchema.partial(),
  preferences: userPreferencesSchema.partial(),
  notifications: notificationSettingsSchema.partial(),
  security: securitySettingsSchema.partial()
}).partial()

// Request schema
const updateSettingsRequestSchema = z.object({
  userSettings: userSettingsSchema.optional(),
  roleSettings: z.record(z.unknown()).optional(),
  settingType: z.enum(['user', 'role', 'both']).default('both')
})

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    // Create Supabase client with auth context
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse and validate request body
    const requestBody = await req.json()
    const validatedRequest = updateSettingsRequestSchema.parse(requestBody)

    // Track what was updated for response
    const updates = {
      userSettingsUpdated: false,
      roleSettingsUpdated: false,
      errors: [] as string[]
    }

    // Update user settings if provided
    if (validatedRequest.userSettings && 
        (validatedRequest.settingType === 'user' || validatedRequest.settingType === 'both')) {
      try {
        // Get current user metadata
        const { data: userData, error: fetchError } = await supabaseClient
          .from('users')
          .select('metadata, settings_version')
          .eq('id', user.id)
          .single()

        if (fetchError) {
          throw new Error(`Failed to fetch user data: ${fetchError.message}`)
        }

        // Merge settings
        const currentMetadata = (userData?.metadata || {}) as Record<string, unknown>
        const updatedMetadata = {
          ...currentMetadata,
          profile: { ...currentMetadata.profile as Record<string, unknown>, ...validatedRequest.userSettings.profile },
          preferences: { ...currentMetadata.preferences as Record<string, unknown>, ...validatedRequest.userSettings.preferences },
          notifications: { ...currentMetadata.notifications as Record<string, unknown>, ...validatedRequest.userSettings.notifications },
          security: { ...currentMetadata.security as Record<string, unknown>, ...validatedRequest.userSettings.security }
        }

        // Update user metadata and increment version
        const { error: updateError } = await supabaseClient
          .from('users')
          .update({
            metadata: updatedMetadata,
            settings_version: (userData?.settings_version || 1) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (updateError) {
          throw new Error(`Failed to update user settings: ${updateError.message}`)
        }

        updates.userSettingsUpdated = true
      } catch (error) {
        updates.errors.push(`User settings update failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Update role-specific settings if provided
    if (validatedRequest.roleSettings && 
        (validatedRequest.settingType === 'role' || validatedRequest.settingType === 'both')) {
      try {
        // Determine user role
        let roleType: string | null = null
        let roleTable: string | null = null

        // Check each role table
        const { data: supplierData } = await supabaseClient
          .from('suppliers')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (supplierData) {
          roleType = 'supplier'
          roleTable = 'suppliers'
        } else {
          const { data: buyerData } = await supabaseClient
            .from('buyers')
            .select('id')
            .eq('user_id', user.id)
            .single()

          if (buyerData) {
            roleType = 'buyer'
            roleTable = 'buyers'
          } else {
            const { data: networkData } = await supabaseClient
              .from('networks')
              .select('id')
              .eq('user_id', user.id)
              .single()

            if (networkData) {
              roleType = 'network'
              roleTable = 'networks'
            } else {
              const { data: adminData } = await supabaseClient
                .from('admins')
                .select('id')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .single()

              if (adminData) {
                roleType = 'admin'
                roleTable = 'admins'
              }
            }
          }
        }

        if (!roleType || !roleTable) {
          throw new Error('User role not found')
        }

        // Update role-specific settings
        if (roleTable === 'admins') {
          // Admins use metadata field
          const { data: currentAdmin } = await supabaseClient
            .from('admins')
            .select('metadata')
            .eq('user_id', user.id)
            .single()

          const currentMetadata = (currentAdmin?.metadata || {}) as Record<string, unknown>
          const updatedMetadata = { ...currentMetadata, ...validatedRequest.roleSettings }

          const { error: updateError } = await supabaseClient
            .from('admins')
            .update({ metadata: updatedMetadata })
            .eq('user_id', user.id)

          if (updateError) {
            throw new Error(`Failed to update admin settings: ${updateError.message}`)
          }
        } else {
          // Other roles use settings field
          const { data: currentRole } = await supabaseClient
            .from(roleTable)
            .select('settings')
            .eq('user_id', user.id)
            .single()

          const currentSettings = (currentRole?.settings || {}) as Record<string, unknown>
          const updatedSettings = { ...currentSettings, ...validatedRequest.roleSettings }

          const { error: updateError } = await supabaseClient
            .from(roleTable)
            .update({
              settings: updatedSettings,
              settings_updated_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)

          if (updateError) {
            throw new Error(`Failed to update ${roleType} settings: ${updateError.message}`)
          }
        }

        updates.roleSettingsUpdated = true
      } catch (error) {
        updates.errors.push(`Role settings update failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Return response
    if (updates.errors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          userSettingsUpdated: updates.userSettingsUpdated,
          roleSettingsUpdated: updates.roleSettingsUpdated,
          errors: updates.errors
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 207, // Multi-status
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        userSettingsUpdated: updates.userSettingsUpdated,
        roleSettingsUpdated: updates.roleSettingsUpdated
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in update-settings function:', error)
    
    let errorMessage = 'Internal server error'
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = error.message
      if (errorMessage === 'Unauthorized') {
        statusCode = 401
      } else if (errorMessage === 'Method not allowed') {
        statusCode = 405
      }
    }

    if (error instanceof z.ZodError) {
      errorMessage = 'Validation error'
      statusCode = 400
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: error.errors
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: statusCode,
        }
      )
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    )
  }
})