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

    const totalPosts = totalResult.count || 0
    const publishedPosts = publishedResult.count || 0
    const draftPosts = draftResult.count || 0

    // Get view count and reading time aggregations
    // Note: Supabase doesn't support SUM/AVG directly, so we need to use RPC or a workaround
    // For now, we'll fetch a limited sample for statistics
    const { data: samplePosts } = await from('blog_posts')
      .select('view_count, reading_time_minutes')
      .match(baseFilter)
      .limit(1000) // Reasonable sample size

    const totalViews = samplePosts?.reduce((sum, p) => sum + (p.view_count || 0), 0) || 0
    const avgReadingTime = samplePosts?.length 
      ? samplePosts.reduce((sum, p) => sum + (p.reading_time_minutes || 0), 0) / samplePosts.length
      : 0

    // Get comment count
    let commentQuery = from('blog_comments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    // If authorId is specified, we need to filter comments by posts from this author
    if (authorId) {
      const { data: authorPostIds } = await from('blog_posts')
        .select('id')
        .eq('author_id', authorId)
      
      if (authorPostIds && authorPostIds.length > 0) {
        commentQuery = commentQuery.in('post_id', authorPostIds.map(p => p.id))
      }
    }

    const { count: totalComments } = await commentQuery

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      totalViews,
      totalComments: totalComments || 0,
      avgReadingTime: Math.round(avgReadingTime),
    }
  }
}