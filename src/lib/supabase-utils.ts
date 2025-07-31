/**
 * Shared Supabase utilities for blog services
 */

import { PostgrestError } from '@supabase/supabase-js'
import { BlogErrorFactory, BlogError } from '../types/errors'

/**
 * Handle Supabase errors and convert to BlogError
 */
export function handleSupabaseError(error: unknown): BlogError {
  if (error instanceof BlogError) {
    return error
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const pgError = error as PostgrestError
    
    // Handle specific PostgreSQL error codes
    switch (pgError.code) {
      case '23505': // unique_violation
        return BlogErrorFactory.validation('Duplicate value', { code: pgError.code })
      case '23503': // foreign_key_violation
        return BlogErrorFactory.validation('Referenced item does not exist', { code: pgError.code })
      case '23502': // not_null_violation
        return BlogErrorFactory.validation('Required field is missing', { code: pgError.code })
      case '42P01': // undefined_table
        return BlogErrorFactory.database('Table does not exist', pgError)
      case '42703': // undefined_column
        return BlogErrorFactory.database('Column does not exist', pgError)
      case 'PGRST116': // not found
        return BlogErrorFactory.notFound('Resource')
      default:
        return BlogErrorFactory.database(pgError.message || 'Database error', pgError)
    }
  }

  if (error instanceof Error) {
    return BlogErrorFactory.database(error.message, error)
  }

  return BlogErrorFactory.database('Unknown database error', error)
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