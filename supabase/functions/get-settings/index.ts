import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'
import { corsHeaders } from '../_shared/cors.ts'

interface GetSettingsRequest {
  includeTemplates?: boolean
  includeAuditLog?: boolean
}

interface UserSettings {
  profile: Record<string, unknown>
  preferences: Record<string, unknown>
  notifications: Record<string, unknown>
  security: Record<string, unknown>
}

interface SettingsResponse {
  user: UserSettings | null
  role: Record<string, unknown> | null
  roleType: string | null
  templates?: Array<Record<string, unknown>>
  auditLog?: Array<Record<string, unknown>>
  version: number
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // Parse request body
    let requestData: GetSettingsRequest = {}
    if (req.method === 'POST' && req.body) {
      requestData = await req.json()
    }

    // Fetch user settings from metadata
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('id, email, metadata, settings_version')
      .eq('id', user.id)
      .single()

    if (userError) {
      throw new Error(`Failed to fetch user data: ${userError.message}`)
    }

    // Initialize response
    const response: SettingsResponse = {
      user: null,
      role: null,
      roleType: null,
      version: userData?.settings_version || 1
    }

    // Extract user settings from metadata
    if (userData?.metadata && typeof userData.metadata === 'object') {
      const metadata = userData.metadata as Record<string, unknown>
      response.user = {
        profile: (metadata.profile as Record<string, unknown>) || {},
        preferences: (metadata.preferences as Record<string, unknown>) || {},
        notifications: (metadata.notifications as Record<string, unknown>) || {},
        security: (metadata.security as Record<string, unknown>) || {}
      }
    }

    // Check user role and fetch role-specific settings
    // Check if user is a supplier
    const { data: supplierData } = await supabaseClient
      .from('suppliers')
      .select('settings, settings_updated_at')
      .eq('user_id', user.id)
      .single()

    if (supplierData) {
      response.roleType = 'supplier'
      response.role = supplierData.settings || {}
    } else {
      // Check if user is a buyer
      const { data: buyerData } = await supabaseClient
        .from('buyers')
        .select('settings, settings_updated_at')
        .eq('user_id', user.id)
        .single()

      if (buyerData) {
        response.roleType = 'buyer'
        response.role = buyerData.settings || {}
      } else {
        // Check if user is a network
        const { data: networkData } = await supabaseClient
          .from('networks')
          .select('settings, settings_updated_at')
          .eq('user_id', user.id)
          .single()

        if (networkData) {
          response.roleType = 'network'
          response.role = networkData.settings || {}
        } else {
          // Check if user is an admin
          const { data: adminData } = await supabaseClient
            .from('admins')
            .select('metadata')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

          if (adminData) {
            response.roleType = 'admin'
            response.role = adminData.metadata || {}
          }
        }
      }
    }

    // Fetch applicable templates if requested
    if (requestData.includeTemplates && response.roleType) {
      const { data: templates } = await supabaseClient
        .from('settings_templates')
        .select('id, name, description, category, settings, is_default')
        .eq('is_active', true)
        .in('user_type', [response.roleType, 'all'])
        .order('is_default', { ascending: false })
        .order('name')

      response.templates = templates || []
    }

    // Fetch audit log if requested
    if (requestData.includeAuditLog) {
      const { data: auditLog } = await supabaseClient
        .from('settings_audit_log')
        .select('id, setting_type, setting_key, old_value, new_value, action, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      response.auditLog = auditLog || []
    }

    // Apply default settings if user settings are empty
    if (!response.user || Object.keys(response.user).every(key => {
      const section = response.user![key as keyof UserSettings]
      return !section || Object.keys(section).length === 0
    })) {
      response.user = {
        profile: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
          phoneFormat: 'US',
          currency: 'USD'
        },
        preferences: {
          theme: 'system',
          dashboardLayout: 'expanded',
          defaultPage: '/dashboard',
          tablePageSize: 25,
          soundAlerts: true,
          keyboardShortcuts: true,
          autoRefresh: true,
          refreshInterval: 30,
          compactMode: false,
          showOnboarding: true
        },
        notifications: {
          email: {
            enabled: true,
            newCalls: true,
            callCompleted: false,
            dailySummary: true,
            weeklyReport: true,
            monthlyReport: false,
            campaignAlerts: true,
            budgetAlerts: true,
            qualityAlerts: true,
            fraudAlerts: true,
            systemUpdates: true,
            marketingEmails: false
          },
          browser: {
            enabled: true,
            newCalls: true,
            callStatus: true,
            campaignAlerts: true,
            systemAlerts: true,
            sound: true,
            vibrate: false
          },
          frequency: 'realtime'
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeout: 30,
          ipWhitelist: [],
          apiAccess: false,
          loginNotifications: true,
          activityAlerts: true,
          dataExportEnabled: true
        }
      }
    }

    // Apply default role settings from template if empty
    if (response.roleType && (!response.role || Object.keys(response.role).length === 0)) {
      const { data: defaultTemplate } = await supabaseClient
        .from('settings_templates')
        .select('settings')
        .eq('user_type', response.roleType)
        .eq('is_default', true)
        .eq('is_active', true)
        .single()

      if (defaultTemplate?.settings) {
        response.role = defaultTemplate.settings
      }
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in get-settings function:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const statusCode = errorMessage === 'Unauthorized' ? 401 : 500
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    )
  }
})