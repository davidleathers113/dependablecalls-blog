/**
 * Blog Author Service
 * Handles author profile operations
 */

import { fromBlog as from } from '../../lib/supabase-blog'
import type { BlogAuthor, BlogAuthorUpdate } from '../../types/blog'
import { handleSupabaseError } from '../../lib/supabase-utils'
import type { PostgrestError } from '@supabase/supabase-js'

export class AuthorService {
  /**
   * Get author profile by user ID
   */
  static async getAuthorProfile(userId: string): Promise<BlogAuthor | null> {
    // Note: Since blog_authors table doesn't have user_id column based on the schema,
    // we'll query by id directly assuming userId is the author id
    const { data, error } = await from('blog_authors')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      // Handle specific "not found" errors gracefully
      if ((error as PostgrestError).code === 'PGRST116') {
        return null
      }
      console.error('Error fetching author profile:', error)
      return null
    }

    if (!data) return null

    // Transform the raw data to match BlogAuthor interface
    const author: BlogAuthor = {
      ...data,
      // Add any additional properties that BlogAuthor extends from BlogAuthorRow
    }

    return author
  }

  /**
   * Update author profile
   */
  static async updateAuthorProfile(
    userId: string,
    updates: Partial<BlogAuthorUpdate>
  ): Promise<BlogAuthor> {
    // Prepare the update data with proper typing
    const updateData: Partial<BlogAuthorUpdate> = {
      ...updates,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await from('blog_authors')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw handleSupabaseError(error)
    }

    if (!data) {
      throw handleSupabaseError({
        code: 'PGRST116',
        message: 'Author not found',
      } as PostgrestError)
    }

    // Transform the raw data to match BlogAuthor interface
    const author: BlogAuthor = {
      ...data,
      // Add any additional properties that BlogAuthor extends from BlogAuthorRow
    }

    return author
  }
}