import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'
import { corsHeaders } from '../_shared/cors.ts'

interface ExportSettingsRequest {
  includeAuditLog?: boolean
  format?: 'json' | 'pretty'
  password?: string // Optional password protection
}

interface ExportedSettings {
  version: string
  exportedAt: string
  userEmail: string
  userId: string
  userSettings: Record<string, unknown>
  roleSettings: Record<string, unknown> | null
  roleType: string | null
  auditLog?: Array<Record<string, unknown>>
  metadata: {
    platform: string
    exportVersion: number
    checksum?: string
  }
}

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

    // Parse request options
    const requestData: ExportSettingsRequest = req.body ? await req.json() : {}

    // Fetch user data
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('id, email, metadata, settings_version')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      throw new Error('Failed to fetch user data')
    }

    // Initialize export data
    const exportData: ExportedSettings = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userEmail: userData.email,
      userId: userData.id,
      userSettings: {},
      roleSettings: null,
      roleType: null,
      metadata: {
        platform: 'DCE Pay-Per-Call Network',
        exportVersion: userData.settings_version || 1
      }
    }

    // Extract user settings from metadata
    if (userData.metadata && typeof userData.metadata === 'object') {
      const metadata = userData.metadata as Record<string, unknown>
      exportData.userSettings = {
        profile: metadata.profile || {},
        preferences: metadata.preferences || {},
        notifications: metadata.notifications || {},
        security: metadata.security || {}
      }
    }

    // Fetch role-specific settings
    // Check supplier
    const { data: supplierData } = await supabaseClient
      .from('suppliers')
      .select('settings, company_name')
      .eq('user_id', user.id)
      .single()

    if (supplierData) {
      exportData.roleType = 'supplier'
      exportData.roleSettings = supplierData.settings || {}
    } else {
      // Check buyer
      const { data: buyerData } = await supabaseClient
        .from('buyers')
        .select('settings, company_name')
        .eq('user_id', user.id)
        .single()

      if (buyerData) {
        exportData.roleType = 'buyer'
        exportData.roleSettings = buyerData.settings || {}
      } else {
        // Check network
        const { data: networkData } = await supabaseClient
          .from('networks')
          .select('settings, company_name')
          .eq('user_id', user.id)
          .single()

        if (networkData) {
          exportData.roleType = 'network'
          exportData.roleSettings = networkData.settings || {}
        } else {
          // Check admin
          const { data: adminData } = await supabaseClient
            .from('admins')
            .select('metadata')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

          if (adminData) {
            exportData.roleType = 'admin'
            exportData.roleSettings = adminData.metadata || {}
          }
        }
      }
    }

    // Include audit log if requested
    if (requestData.includeAuditLog) {
      const { data: auditLog } = await supabaseClient
        .from('settings_audit_log')
        .select('setting_type, setting_key, old_value, new_value, action, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      exportData.auditLog = auditLog || []
    }

    // Calculate checksum for integrity verification
    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify({
      userSettings: exportData.userSettings,
      roleSettings: exportData.roleSettings
    }))
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    exportData.metadata.checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Format the output
    const jsonOutput = requestData.format === 'pretty' 
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData)

    // Optionally encrypt with password
    let finalOutput = jsonOutput
    let isEncrypted = false

    if (requestData.password) {
      // Simple encryption using Web Crypto API
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(requestData.password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      )

      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      )

      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encoder.encode(jsonOutput)
      )

      // Combine salt, iv, and encrypted data
      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
      combined.set(salt, 0)
      combined.set(iv, salt.length)
      combined.set(new Uint8Array(encrypted), salt.length + iv.length)

      // Base64 encode
      finalOutput = btoa(String.fromCharCode(...combined))
      isEncrypted = true
    }

    // Generate filename
    const date = new Date().toISOString().split('T')[0]
    const filename = `dce-settings-export-${date}${isEncrypted ? '.encrypted' : ''}.json`

    // Return as downloadable file
    return new Response(finalOutput, {
      headers: {
        ...corsHeaders,
        'Content-Type': isEncrypted ? 'text/plain' : 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Settings-Version': exportData.metadata.exportVersion.toString(),
        'X-Settings-Checksum': exportData.metadata.checksum || '',
        'X-Settings-Encrypted': isEncrypted.toString()
      },
      status: 200
    })
  } catch (error) {
    console.error('Error in export-settings function:', error)
    
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
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    )
  }
})