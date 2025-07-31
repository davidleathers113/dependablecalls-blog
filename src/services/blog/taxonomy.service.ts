/**
 * Blog Taxonomy Service
 * Handles categories and tags operations
 */

import { fromBlog as from } from '../../lib/supabase-blog'
import { BlogMockDataService, shouldUseBlogMockData } from '../../lib/blog-mock-data'
import type {
  BlogCategory,
  BlogTag,
  BlogTagRow,
  PopularTag,
} from '../../types/blog'
import { handleSupabaseError } from '../../lib/supabase-utils'
import type { BatchOperationResult } from '../../types/errors'

export interface CategoryUpdate {
  id: string
  name?: string
  slug?: string
  description?: string
  parent_id?: string | null
  display_order?: number
  metadata?: Record<string, unknown>
}

export interface TagUpdate {
  id: string
  name?: string
  slug?: string
  description?: string
}

export class TaxonomyService {
  /**
   * Get all categories
   */
  static async getCategories(): Promise<BlogCategory[]> {
    // Use mock data if environment requires it
    if (shouldUseBlogMockData()) {
      BlogMockDataService.logUsage('getCategories')
      const mockResult = await BlogMockDataService.getBlogCategories()
      
      if (mockResult.error) {
        throw new Error('Mock data error')
      }

      return mockResult.data || []
    }

    const { data, error } = await from('blog_categories')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) throw handleSupabaseError(error)

    return data || []
  }

  /**
   * Get category by slug
   */
  static async getCategoryBySlug(slug: string): Promise<BlogCategory | null> {
    const { data, error } = await from('blog_categories').select('*').eq('slug', slug).single()

    if (error) return null

    return data
  }

  /**
   * Batch update categories
   */
  static async batchUpdateCategories(
    updates: CategoryUpdate[]
  ): Promise<BatchOperationResult<CategoryUpdate>> {
    const results: BatchOperationResult<CategoryUpdate> = {
      successful: [],
      failed: [],
      total: updates.length,
      successCount: 0,
      failureCount: 0,
    }

    await Promise.all(
      updates.map(async (update, index) => {
        try {
          const { id, ...updateData } = update
          const { error } = await from('blog_categories')
            .update({
              ...updateData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)

          if (error) throw handleSupabaseError(error)

          results.successful.push(update)
          results.successCount++
        } catch (error) {
          results.failed.push({
            operation: 'update',
            itemId: update.id,
            index,
            error: handleSupabaseError(error),
          })
          results.failureCount++
        }
      })
    )

    return results
  }

  /**
   * Get all tags
   */
  static async getTags(): Promise<BlogTag[]> {
    // Use mock data if environment requires it
    if (shouldUseBlogMockData()) {
      BlogMockDataService.logUsage('getTags')
      const mockResult = await BlogMockDataService.getBlogTags()
      
      if (mockResult.error) {
        throw new Error('Mock data error')
      }

      return mockResult.data || []
    }

    const { data, error } = await from('blog_tags').select('*').order('name', { ascending: true })

    if (error) throw handleSupabaseError(error)

    return data || []
  }

  /**
   * Get tag by slug
   */
  static async getTagBySlug(slug: string): Promise<BlogTag | null> {
    const { data, error } = await from('blog_tags').select('*').eq('slug', slug).single()

    if (error) return null

    return data
  }

  /**
   * Batch update tags
   */
  static async batchUpdateTags(updates: TagUpdate[]): Promise<BatchOperationResult<TagUpdate>> {
    const results: BatchOperationResult<TagUpdate> = {
      successful: [],
      failed: [],
      total: updates.length,
      successCount: 0,
      failureCount: 0,
    }

    await Promise.all(
      updates.map(async (update, index) => {
        try {
          const { id, ...updateData } = update
          const { error } = await from('blog_tags')
            .update({
              ...updateData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)

          if (error) throw handleSupabaseError(error)

          results.successful.push(update)
          results.successCount++
        } catch (error) {
          results.failed.push({
            operation: 'update',
            itemId: update.id,
            index,
            error: handleSupabaseError(error),
          })
          results.failureCount++
        }
      })
    )

    return results
  }

  /**
   * Get popular tags based on usage count
   */
  static async getPopularTags(limit = 10): Promise<PopularTag[]> {
    // Fallback to manual query since RPC function is not available yet
    const { data: tagData, error } = await from('blog_tags')
      .select(
        `
        *,
        blog_post_tags(count)
      `
      )
      .limit(limit)

    if (error) throw handleSupabaseError(error)

    return (tagData || []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count:
        (tag as BlogTagRow & { blog_post_tags?: { count: number }[] }).blog_post_tags?.[0]
          ?.count || 0,
    }))
  }
}