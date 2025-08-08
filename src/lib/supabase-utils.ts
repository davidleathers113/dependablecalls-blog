/**
 * Shared Supabase utilities for blog services
 */

import type { PostgrestError } from '@supabase/supabase-js'
import { BlogErrorFactory, type BlogError } from '../types/errors'

/**
 * Handle Supabase errors and convert to BlogError
 */
export function handleSupabaseError(error: unknown): BlogError {
  // Import the type guard from errors
  const isBlogError = (err: unknown): err is BlogError => {
    return (
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      'statusCode' in err &&
      'message' in err &&
      'timestamp' in err
    )
  }
  
  if (isBlogError(error)) {
    return error
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const pgError = error as PostgrestError
    
    // Log PostgREST errors with detailed information for debugging
    if (pgError.code || pgError.message || pgError.details) {
      console.error('PostgREST Error Details:', {
        code: pgError.code,
        message: pgError.message,
        details: pgError.details,
        hint: pgError.hint,
        timestamp: new Date().toISOString(),
        context: 'Supabase query operation'
      })
    }
    
    // Handle specific PostgreSQL error codes
    switch (pgError.code) {
      case '23505': // unique_violation
        return BlogErrorFactory.validation('Duplicate value', { 
          errors: [{ field: 'unknown', message: 'Duplicate value', code: pgError.code }]
        })
      case '23503': // foreign_key_violation
        return BlogErrorFactory.validation('Referenced item does not exist', { 
          errors: [{ field: 'unknown', message: 'Referenced item does not exist', code: pgError.code }]
        })
      case '23502': // not_null_violation
        return BlogErrorFactory.validation('Required field is missing', { 
          errors: [{ field: 'unknown', message: 'Required field is missing', code: pgError.code }]
        })
      case '42P01': // undefined_table
        return BlogErrorFactory.database('table_access', pgError, 'unknown')
      case '42703': // undefined_column  
        return BlogErrorFactory.database('column_access', pgError, 'unknown')
      case 'PGRST116': // not found
        return BlogErrorFactory.notFound('Resource', 'unknown')
      case 'PGRST103': // insufficient privilege
        return BlogErrorFactory.database('permission', pgError, 'unknown')
      default:
        // For 400 Bad Request errors, provide more specific context
        if (pgError.message && pgError.message.includes('relation') || pgError.message?.includes('constraint')) {
          console.error('PostgREST Relationship Error - likely missing foreign key constraint or incorrect relation syntax:', {
            originalError: pgError,
            suggestedFix: 'Check foreign key constraint names and PostgREST relationship syntax (use !constraint_name for ambiguous joins)',
            timestamp: new Date().toISOString()
          })
          return BlogErrorFactory.database('relationship', pgError, 'unknown')
        }
        return BlogErrorFactory.database('query', pgError)
    }
  }

  if (error instanceof Error) {
    return BlogErrorFactory.database('operation', error)
  }

  return BlogErrorFactory.database('operation', error)
}

/**
 * Generate a URL-safe slug from text
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Ensure a slug is unique by appending a timestamp if needed
 */
export function ensureUniqueSlug(baseSlug: string, exists: boolean): string {
  return exists ? `${baseSlug}-${Date.now()}` : baseSlug
}