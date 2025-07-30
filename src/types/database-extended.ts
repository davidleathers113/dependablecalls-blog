/**
 * Extended Database Types for DCE Platform
 *
 * This file extends the generated Supabase types with mock platform tables
 * to allow TypeScript compilation while the full database schema is developed.
 */

import type { Database as GeneratedDatabase } from './database.generated'
import type { MockTables, MockEnums } from './database-mock-types'

// Extended Database type that includes both real and mock tables
export type Database = {
  __InternalSupabase: GeneratedDatabase['__InternalSupabase']
  public: {
    Tables: GeneratedDatabase['public']['Tables'] & MockTables
    Views: GeneratedDatabase['public']['Views']
    Functions: GeneratedDatabase['public']['Functions']
    Enums: GeneratedDatabase['public']['Enums'] & MockEnums
    CompositeTypes: GeneratedDatabase['public']['CompositeTypes']
  }
}

// Re-export Json type for convenience
export type { Json } from './database.generated'

// Helper types for table operations
export type Tables = Database['public']['Tables']
export type Enums = Database['public']['Enums']

// Type helpers for specific table operations
export type TableName = keyof Tables
export type TableRow<T extends TableName> = Tables[T]['Row']
export type TableInsert<T extends TableName> = Tables[T]['Insert']
export type TableUpdate<T extends TableName> = Tables[T]['Update']

// Specific table types for common use
export type BlogPost = Tables['blog_posts']['Row']
export type BlogAuthor = Tables['blog_authors']['Row']
export type Campaign = Tables['campaigns']['Row']
export type Supplier = Tables['suppliers']['Row']
export type Call = Tables['calls']['Row']
export type User = Tables['users']['Row']

// All types are exported as named exports above
