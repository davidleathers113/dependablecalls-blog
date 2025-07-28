import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'
import { z } from 'https://deno.land/x/zod@v3.21.4/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Schema for imported settings validation
const importedSettingsSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  userEmail: z.string().email(),
  userId: z.string().uuid(),
  userSettings: z.object({
    profile: z.record(z.unknown()).optional(),
    preferences: z.record(z.unknown()).optional(),
    notifications: z.record(z.unknown()).optional(),
    security: z.record(z.unknown()).optional()
  }),
  roleSettings: z.record(z.unknown()).nullable(),
  roleType: z.string().nullable(),
  metadata: z.object({
    platform: z.string(),
    exportVersion: z.number(),
    checksum: z.string().optional()
  })
})

interface ImportSettingsRequest {
  data: string // Base64 encoded or JSON string
  password?: string // For encrypted imports
  overwrite?: boolean // Whether to overwrite existing settings
  validateOnly?: boolean // Only validate without importing
}

interface ImportResult {
  success: boolean
  imported: {
    userSettings: boolean
    roleSettings: boolean
  }
  validation: {
    isValid: boolean
    errors?: string[]
    warnings?: string[]
  }
  metadata: {
    originalUser: string
    originalExportDate: string
    settingsVersion: number
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

    // Parse request
    const requestData: ImportSettingsRequest = await req.json()
    if (!requestData.data) {
      throw new Error('No data provided for import')
    }

    let importData: unknown
    const warnings: string[] = []

    // Decrypt if password provided
    if (requestData.password) {
      try {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()
        
        // Decode base64
        const combined = Uint8Array.from(atob(requestData.data), c => c.charCodeAt(0))
        
        // Extract salt, iv, and encrypted data
        const salt = combined.slice(0, 16)
        const iv = combined.slice(16, 28)
        const encrypted = combined.slice(28)

        // Derive key from password
        const passwordKey = await crypto.subtle.importKey(
          'raw',
          encoder.encode(requestData.password),
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        )

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
          ['decrypt']
        )

        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv
          },
          key,
          encrypted
        )

        const jsonString = decoder.decode(decrypted)
        importData = JSON.parse(jsonString)
      } catch (error) {
        throw new Error('Failed to decrypt settings. Please check your password.')
      }
    } else {
      // Try to parse as JSON
      try {
        importData = typeof requestData.data === 'string' 
          ? JSON.parse(requestData.data)
          : requestData.data
      } catch (error) {
        throw new Error('Invalid settings format. Expected JSON.')
      }
    }

    // Validate imported data structure
    let validatedData
    try {
      validatedData = importedSettingsSchema.parse(importData)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid settings structure',
            validation: {
              isValid: false,
              errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        )
      }
      throw error
    }

    // Verify checksum if present
    if (validatedData.metadata.checksum) {
      const encoder = new TextEncoder()
      const data = encoder.encode(JSON.stringify({
        userSettings: validatedData.userSettings,
        roleSettings: validatedData.roleSettings
      }))
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const calculatedChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      
      if (calculatedChecksum !== validatedData.metadata.checksum) {
        warnings.push('Checksum mismatch. Settings may have been modified.')
      }
    }

    // Check if importing from different user
    if (validatedData.userId !== user.id) {
      warnings.push(`Settings were exported from a different user (${validatedData.userEmail}).`)
    }

    // Check version compatibility
    if (validatedData.version !== '1.0.0') {
      warnings.push(`Settings were exported from a different version (${validatedData.version}).`)
    }

    // If validate only, return validation results
    if (requestData.validateOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          validation: {
            isValid: true,
            warnings: warnings.length > 0 ? warnings : undefined
          },
          metadata: {
            originalUser: validatedData.userEmail,
            originalExportDate: validatedData.exportedAt,
            settingsVersion: validatedData.metadata.exportVersion
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Proceed with import
    const result: ImportResult = {
      success: false,
      imported: {
        userSettings: false,
        roleSettings: false
      },
      validation: {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined
      },
      metadata: {
        originalUser: validatedData.userEmail,
        originalExportDate: validatedData.exportedAt,
        settingsVersion: validatedData.metadata.exportVersion
      }
    }

    // Import user settings
    try {
      const { data: currentUser } = await supabaseClient
        .from('users')
        .select('metadata, settings_version')
        .eq('id', user.id)
        .single()

      let newMetadata = validatedData.userSettings
      
      if (!requestData.overwrite && currentUser?.metadata) {
        // Merge with existing settings
        const currentMetadata = currentUser.metadata as Record<string, unknown>
        newMetadata = {
          profile: { ...currentMetadata.profile as Record<string, unknown>, ...validatedData.userSettings.profile },
          preferences: { ...currentMetadata.preferences as Record<string, unknown>, ...validatedData.userSettings.preferences },
          notifications: { ...currentMetadata.notifications as Record<string, unknown>, ...validatedData.userSettings.notifications },
          security: { ...currentMetadata.security as Record<string, unknown>, ...validatedData.userSettings.security }
        }
      }

      const { error: updateError } = await supabaseClient
        .from('users')
        .update({
          metadata: newMetadata,
          settings_version: (currentUser?.settings_version || 1) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) {
        throw new Error(`Failed to import user settings: ${updateError.message}`)
      }

      result.imported.userSettings = true
    } catch (error) {
      result.validation.errors = result.validation.errors || []
      result.validation.errors.push(`User settings import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Import role-specific settings if applicable
    if (validatedData.roleSettings && validatedData.roleType) {
      try {
        // Verify user has the same role
        let currentRoleTable: string | null = null
        
        switch (validatedData.roleType) {
          case 'supplier':
            const { data: supplierExists } = await supabaseClient
              .from('suppliers')
              .select('id')
              .eq('user_id', user.id)
              .single()
            if (supplierExists) currentRoleTable = 'suppliers'
            break
            
          case 'buyer':
            const { data: buyerExists } = await supabaseClient
              .from('buyers')
              .select('id')
              .eq('user_id', user.id)
              .single()
            if (buyerExists) currentRoleTable = 'buyers'
            break
            
          case 'network':
            const { data: networkExists } = await supabaseClient
              .from('networks')
              .select('id')
              .eq('user_id', user.id)
              .single()
            if (networkExists) currentRoleTable = 'networks'
            break
            
          case 'admin':
            const { data: adminExists } = await supabaseClient
              .from('admins')
              .select('id')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .single()
            if (adminExists) currentRoleTable = 'admins'
            break
        }

        if (!currentRoleTable) {
          warnings.push(`Cannot import ${validatedData.roleType} settings - user does not have this role.`)
        } else {
          // Import role settings
          if (currentRoleTable === 'admins') {
            const { error } = await supabaseClient
              .from('admins')
              .update({ metadata: validatedData.roleSettings })
              .eq('user_id', user.id)
            
            if (error) throw error
          } else {
            let newSettings = validatedData.roleSettings
            
            if (!requestData.overwrite) {
              // Merge with existing settings
              const { data: currentRole } = await supabaseClient
                .from(currentRoleTable)
                .select('settings')
                .eq('user_id', user.id)
                .single()
              
              if (currentRole?.settings) {
                newSettings = { ...currentRole.settings as Record<string, unknown>, ...validatedData.roleSettings }
              }
            }

            const { error } = await supabaseClient
              .from(currentRoleTable)
              .update({
                settings: newSettings,
                settings_updated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id)
            
            if (error) throw error
          }

          result.imported.roleSettings = true
        }
      } catch (error) {
        result.validation.errors = result.validation.errors || []
        result.validation.errors.push(`Role settings import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    result.success = result.imported.userSettings || result.imported.roleSettings

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 207
      }
    )
  } catch (error) {
    console.error('Error in import-settings function:', error)
    
    let errorMessage = 'Internal server error'
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = error.message
      if (errorMessage === 'Unauthorized') {
        statusCode = 401
      } else if (errorMessage === 'Method not allowed') {
        statusCode = 405
      } else if (errorMessage.includes('Invalid') || errorMessage.includes('No data')) {
        statusCode = 400
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