/**
 * Blog Taxonomy Service
 * Handles categories and tags operations
 */

import { fromBlog as from } from '../../lib/supabase-blog'
import { BlogMockDataService, shouldUseBlogMockData } from '../../lib/blog-mock-data'
import type {
  BlogCategory,
  BlogTag,
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

    return (data as BlogCategory[]) || []
  }

  /**
   * Get category by slug
   */
  static async getCategoryBySlug(slug: string): Promise<BlogCategory | null> {
    const { data, error } = await from('blog_categories').select('*').eq('slug', slug).single()

    if (error) return null

    return data as BlogCategory | null
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
        } catch (error: unknown) {
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

    return (data as BlogTag[]) || []
  }

  /**
   * Get tag by slug
   */
  static async getTagBySlug(slug: string): Promise<BlogTag | null> {
    const { data, error } = await from('blog_tags').select('*').eq('slug', slug).single()

    if (error) return null

    return data as BlogTag | null
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
        } catch (error: unknown) {
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
    // Simple approach: get all tags and count their usage manually
    // This avoids complex join queries that may not work with current schema
    const { data: tagData, error: tagError } = await from('blog_tags')
      .select('*')
      .limit(limit)

    if (tagError) throw handleSupabaseError(tagError)

    if (!tagData) return []

    // For each tag, count how many times it's used
    const tagsWithCounts = await Promise.all(
      (tagData as BlogTag[]).map(async (tag) => {
        const { count, error: countError } = await from('blog_post_tags')
          .select('*', { count: 'exact', head: true })
          .eq('tag_id', tag.id)

        if (countError) {
          // If count fails, default to 0
          return {
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            count: 0,
          }
        }

        return {
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          count: count || 0,
        }
      })
    )

    // Sort by count descending and return
    return tagsWithCounts.sort((a, b) => b.count - a.count)
  }
}