/**
 * Blog Author Service
 * Handles author profile operations
 */

import { fromBlog as from } from '../../lib/supabase-blog'
import type { BlogAuthor, BlogAuthorUpdate } from '../../types/blog'
import { handleSupabaseError } from '../../lib/supabase-utils'

export class AuthorService {
  /**
   * Get author profile by user ID
   */
  static async getAuthorProfile(userId: string): Promise<BlogAuthor | null> {
    const { data, error } = await from('blog_authors')
      .select('*, user:users(id, email, username)')
      .eq('user_id', userId)
      .single()

    if (error) return null

    return data
  }

  /**
   * Update author profile
   */
  static async updateAuthorProfile(
    userId: string,
    updates: Partial<BlogAuthorUpdate>
  ): Promise<BlogAuthor> {
    const { data, error } = await from('blog_authors')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw handleSupabaseError(error)

    return data
  }
}