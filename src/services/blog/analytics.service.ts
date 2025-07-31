/**
 * Blog Analytics Service
 * Handles blog statistics and analytics
 */

import { fromBlog as from } from '../../lib/supabase-blog'
import type { BlogStatistics } from '../../types/blog'

export class AnalyticsService {
  /**
   * Get blog statistics
   */
  static async getStatistics(authorId?: string): Promise<BlogStatistics> {
    // Use database aggregations instead of loading all posts into memory
    const baseFilter = authorId ? { author_id: authorId } : {}
    
    // Get post counts by status using conditional aggregations
    const [totalResult, publishedResult, draftResult] = await Promise.all([
      from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .match(baseFilter),
      from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .match({ ...baseFilter, status: 'published' }),
      from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .match({ ...baseFilter, status: 'draft' })
    ])

    // Check for errors and extract counts
    if (totalResult.error) {
      throw new Error(`Failed to get total posts count: ${totalResult.error.message}`)
    }
    if (publishedResult.error) {
      throw new Error(`Failed to get published posts count: ${publishedResult.error.message}`)
    }
    if (draftResult.error) {
      throw new Error(`Failed to get draft posts count: ${draftResult.error.message}`)
    }

    const totalPosts = totalResult.count || 0
    const publishedPosts = publishedResult.count || 0
    const draftPosts = draftResult.count || 0

    // Get view count and reading time aggregations
    // Note: Supabase doesn't support SUM/AVG directly, so we need to use RPC or a workaround
    // For now, we'll fetch a limited sample for statistics
    const samplePostsResult = await from('blog_posts')
      .select('view_count, reading_time_minutes')
      .match(baseFilter)
      .limit(1000) // Reasonable sample size

    if (samplePostsResult.error) {
      throw new Error(`Failed to get sample posts: ${samplePostsResult.error.message}`)
    }

    const samplePosts = samplePostsResult.data || []

    // Calculate totals with proper type checking
    const totalViews = samplePosts.reduce((sum, post) => {
      const viewCount = post.view_count
      return sum + (typeof viewCount === 'number' ? viewCount : 0)
    }, 0)

    const avgReadingTime = samplePosts.length 
      ? samplePosts.reduce((sum, post) => {
          const readingTime = post.reading_time_minutes
          return sum + (typeof readingTime === 'number' ? readingTime : 0)
        }, 0) / samplePosts.length
      : 0

    // Get comment count
    let commentQuery = from('blog_comments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    // If authorId is specified, we need to filter comments by posts from this author
    if (authorId) {
      const authorPostsResult = await from('blog_posts')
        .select('id')
        .eq('author_id', authorId)
      
      if (authorPostsResult.error) {
        throw new Error(`Failed to get author posts: ${authorPostsResult.error.message}`)
      }

      const authorPostIds = authorPostsResult.data || []
      
      if (authorPostIds.length > 0) {
        const postIds = authorPostIds.map(post => {
          if (typeof post.id === 'string') {
            return post.id
          }
          throw new Error('Invalid post ID type in author posts query')
        })
        commentQuery = commentQuery.in('post_id', postIds)
      }
    }

    const commentResult = await commentQuery

    if (commentResult.error) {
      throw new Error(`Failed to get comment count: ${commentResult.error.message}`)
    }

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      totalViews,
      totalComments: commentResult.count || 0,
      avgReadingTime: Math.round(avgReadingTime),
    }
  }
}