import { from, rpc } from '../lib/supabase-optimized'
import type { 
  BlogPost, 
  BlogComment,
  PostStatus,
  CommentStatus,
  BlogStatistics,
  BlogSEOMetadata
} from '../types/blog'
import { handleSupabaseError, type BatchOperationResult } from '../types/errors'

// Type definitions for blog admin RPC functions
type BlogAdminRPCFunctions = 
  | 'get_admin_blog_statistics'
  | 'get_blog_analytics'
  | 'analyze_content_quality'
  | 'generate_blog_audit_report'
  | 'get_user_activity_summary'

// RPC Response type interfaces
interface AdminStatisticsData {
  total_posts?: number
  published_posts?: number
  draft_posts?: number
  total_views?: number
  total_comments?: number
  avg_reading_time?: number
  pending_comments?: number
  flagged_posts?: number
  active_authors?: number
  total_categories?: number
  total_tags?: number
}

interface BlogAnalyticsRPCData {
  total_views?: number
  total_comments?: number
  total_shares?: number
  avg_engagement_time?: number
  bounce_rate?: number
  top_pages?: Array<{
    slug: string
    title: string
    views: number
    uniqueViews: number
  }>
  time_series_data?: Array<{
    date: string
    views: number
    comments: number
    shares: number
  }>
}

interface ContentQualityData {
  readability_score?: number
  seo_score?: number
  issues?: Array<{
    type: 'readability' | 'seo' | 'content' | 'structure'
    severity: 'low' | 'medium' | 'high'
    message: string
    suggestion?: string
  }>
}

interface AuditReportData {
  overall_health?: number
  issues?: Array<{
    category: 'content' | 'seo' | 'performance' | 'security'
    severity: 'low' | 'medium' | 'high' | 'critical'
    count: number
    description: string
  }>
  recommendations?: string[]
}

interface UserActivityData {
  total_comments?: number
  approved_comments?: number
  rejected_comments?: number
  avg_comments_per_day?: number
  flagged_content?: number
  recent_activity?: Array<{
    type: 'comment' | 'post'
    id: string
    title: string
    createdAt: string
    status: string
  }>
}

// Type-safe RPC wrapper for blog admin functions
const blogRPC = (
  functionName: BlogAdminRPCFunctions,
  args?: Record<string, unknown>
) => {
  return rpc(functionName as never, args as never) as ReturnType<typeof rpc>
}

// Admin-specific types
export interface ContentModerationRequest {
  contentType: 'post' | 'comment'
  contentId: string
  action: 'approve' | 'reject' | 'flag' | 'archive'
  reason?: string
  moderatorId: string
}

export interface BulkAuthorUpdate {
  authorIds: string[]
  updates: {
    is_verified?: boolean
    is_active?: boolean
    role?: 'author' | 'editor' | 'admin'
    bio?: string
    website_url?: string
  }
}

export interface AnalyticsRequest {
  dateRange: {
    start: string
    end: string
  }
  metrics: Array<'views' | 'comments' | 'shares' | 'engagement' | 'bounceRate'>
  groupBy?: 'day' | 'week' | 'month'
  filters?: {
    authorId?: string
    categoryId?: string
    postId?: string
  }
}

export interface AnalyticsData {
  totalViews: number
  totalComments: number
  totalShares: number
  avgEngagementTime: number
  bounceRate: number
  topPages: Array<{
    slug: string
    title: string
    views: number
    uniqueViews: number
  }>
  timeSeriesData: Array<{
    date: string
    views: number
    comments: number
    shares: number
  }>
}

export interface SEOMetadataUpdate {
  postId: string
  metadata: BlogSEOMetadata
}

export interface ContentQualityReport {
  postId: string
  readabilityScore: number
  seoScore: number
  issues: Array<{
    type: 'readability' | 'seo' | 'content' | 'structure'
    severity: 'low' | 'medium' | 'high'
    message: string
    suggestion?: string
  }>
}

/**
 * Blog Admin Service
 * Provides administrative functionality for blog management including
 * content moderation, bulk operations, analytics, and SEO management
 */
export class BlogAdminService {
  /**
   * Get comprehensive admin statistics
   * @returns Extended blog statistics for admin dashboard
   * @throws {BlogError} When RPC call fails
   */
  static async getAdminStatistics(): Promise<BlogStatistics & {
    pendingComments: number
    flaggedPosts: number
    activeAuthors: number
    totalCategories: number
    totalTags: number
  }> {
    const { data, error } = await blogRPC('get_admin_blog_statistics')

    if (error) throw handleSupabaseError(error)

    const stats = data?.[0] as AdminStatisticsData | undefined

    return {
      totalPosts: stats?.total_posts || 0,
      publishedPosts: stats?.published_posts || 0,
      draftPosts: stats?.draft_posts || 0,
      totalViews: stats?.total_views || 0,
      totalComments: stats?.total_comments || 0,
      avgReadingTime: stats?.avg_reading_time || 0,
      pendingComments: stats?.pending_comments || 0,
      flaggedPosts: stats?.flagged_posts || 0,
      activeAuthors: stats?.active_authors || 0,
      totalCategories: stats?.total_categories || 0,
      totalTags: stats?.total_tags || 0
    }
  }

  /**
   * Moderate blog content (posts and comments)
   * @param request - Moderation request with action and reason
   * @returns Updated content item
   * @throws {BlogError} When content not found or moderation fails
   */
  static async moderateContent(request: ContentModerationRequest): Promise<BlogPost | BlogComment> {
    const { contentType, contentId, action, reason, moderatorId } = request

    if (contentType === 'post') {
      const statusMap: Record<string, PostStatus> = {
        approve: 'published',
        reject: 'draft',
        archive: 'archived'
      }

      const { data, error } = await from('blog_posts')
        .update({
          status: statusMap[action] || 'draft',
          moderated_at: new Date().toISOString(),
          moderated_by: moderatorId,
          moderation_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', contentId)
        .select('*')
        .single()

      if (error) throw handleSupabaseError(error)

      return data
    } else {
      const statusMap: Record<string, CommentStatus> = {
        approve: 'approved',
        reject: 'deleted',
        flag: 'spam'
      }

      const { data, error } = await from('blog_comments')
        .update({
          status: statusMap[action] || 'pending',
          moderated_at: new Date().toISOString(),
          moderated_by: moderatorId,
          moderation_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', contentId)
        .select('*, user:users(id, email, username, avatar_url)')
        .single()

      if (error) throw handleSupabaseError(error)

      return data
    }
  }

  /**
   * Bulk update author profiles and permissions
   * @param request - Bulk author update request
   * @returns Result object with successful and failed operations
   */
  static async bulkUpdateAuthors(request: BulkAuthorUpdate): Promise<BatchOperationResult<string>> {
    const { authorIds, updates } = request
    const results: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      total: authorIds.length,
      successCount: 0,
      failureCount: 0
    }

    // Use a single query for better performance
    const { data, error } = await from('blog_authors')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .in('id', authorIds)
      .select('id')

    if (error) {
      // Fall back to individual updates
      await Promise.all(
        authorIds.map(async (authorId, index) => {
          try {
            const { error: updateError } = await from('blog_authors')
              .update({
                ...updates,
                updated_at: new Date().toISOString()
              })
              .eq('id', authorId)

            if (updateError) throw updateError

            results.successful.push(authorId)
            results.successCount++
          } catch (error) {
            results.failed.push({
              operation: 'update',
              itemId: authorId,
              index,
              error: handleSupabaseError(error)
            })
            results.failureCount++
          }
        })
      )
    } else {
      results.successful = data.map(item => item.id)
      results.successCount = data.length

      // Find failed items
      const successfulIds = new Set(results.successful)
      authorIds.forEach((id, index) => {
        if (!successfulIds.has(id)) {
          results.failed.push({
            operation: 'update',
            itemId: id,
            index,
            error: handleSupabaseError(new Error('Author not found'))
          })
          results.failureCount++
        }
      })
    }

    return results
  }

  /**
   * Get analytics data for blog performance
   * @param request - Analytics request with date range and metrics
   * @returns Analytics data with time series and aggregated metrics
   * @throws {BlogError} When analytics calculation fails
   */
  static async getAnalytics(request: AnalyticsRequest): Promise<AnalyticsData> {
    const { dateRange, metrics, groupBy = 'day', filters } = request

    const { data, error } = await blogRPC('get_blog_analytics', {
      start_date: dateRange.start,
      end_date: dateRange.end,
      metrics_array: metrics,
      group_by: groupBy,
      author_id_filter: filters?.authorId || null,
      category_id_filter: filters?.categoryId || null,
      post_id_filter: filters?.postId || null
    })

    if (error) throw handleSupabaseError(error)

    const analytics = data?.[0] as BlogAnalyticsRPCData | undefined

    return {
      totalViews: analytics?.total_views || 0,
      totalComments: analytics?.total_comments || 0,
      totalShares: analytics?.total_shares || 0,
      avgEngagementTime: analytics?.avg_engagement_time || 0,
      bounceRate: analytics?.bounce_rate || 0,
      topPages: analytics?.top_pages || [],
      timeSeriesData: analytics?.time_series_data || []
    }
  }

  /**
   * Update SEO metadata for multiple posts
   * @param updates - Array of posts with SEO metadata updates
   * @returns Result object with successful and failed operations
   */
  static async batchUpdateSEOMetadata(
    updates: SEOMetadataUpdate[]
  ): Promise<BatchOperationResult<SEOMetadataUpdate>> {
    const results: BatchOperationResult<SEOMetadataUpdate> = {
      successful: [],
      failed: [],
      total: updates.length,
      successCount: 0,
      failureCount: 0
    }

    await Promise.all(
      updates.map(async (update, index) => {
        try {
          const { postId, metadata } = update
          const { error } = await from('blog_posts')
            .update({
              seo_title: metadata.title,
              seo_description: metadata.description,
              seo_keywords: metadata.keywords,
              og_image_url: metadata.ogImage,
              og_title: metadata.ogTitle,
              og_description: metadata.ogDescription,
              canonical_url: metadata.canonicalUrl,
              no_index: metadata.noIndex || false,
              no_follow: metadata.noFollow || false,
              updated_at: new Date().toISOString()
            })
            .eq('id', postId)

          if (error) throw error

          results.successful.push(update)
          results.successCount++
        } catch (error) {
          results.failed.push({
            operation: 'update',
            itemId: update.postId,
            index,
            error: handleSupabaseError(error)
          })
          results.failureCount++
        }
      })
    )

    return results
  }

  /**
   * Get pending content requiring moderation
   * @param type - Type of content to retrieve ('posts' | 'comments' | 'all')
   * @param limit - Maximum number of items to return
   * @returns Paginated response with pending content
   * @throws {BlogError} When query fails
   */
  static async getPendingContent(
    type: 'posts' | 'comments' | 'all' = 'all',
    limit = 20
  ): Promise<{
    posts: BlogPost[]
    comments: BlogComment[]
    total: number
  }> {
    const results = {
      posts: [] as BlogPost[],
      comments: [] as BlogComment[],
      total: 0
    }

    if (type === 'posts' || type === 'all') {
      const { data: posts, error: postsError } = await from('blog_posts')
        .select('*, author:blog_authors(*)')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(type === 'posts' ? limit : Math.floor(limit / 2))

      if (postsError) throw handleSupabaseError(postsError)

      results.posts = posts || []
      results.total += results.posts.length
    }

    if (type === 'comments' || type === 'all') {
      const { data: comments, error: commentsError } = await from('blog_comments')
        .select('*, user:users(id, email, username, avatar_url), post:blog_posts(id, title, slug)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(type === 'comments' ? limit : Math.floor(limit / 2))

      if (commentsError) throw handleSupabaseError(commentsError)

      results.comments = comments || []
      results.total += results.comments.length
    }

    return results
  }

  /**
   * Generate content quality report for a post
   * @param postId - Post ID to analyze
   * @returns Content quality report with scores and recommendations
   * @throws {BlogError} When analysis fails
   */
  static async generateContentQualityReport(postId: string): Promise<ContentQualityReport> {
    const { data, error } = await blogRPC('analyze_content_quality', {
      post_id_param: postId
    })

    if (error) throw handleSupabaseError(error)

    const analysis = data?.[0] as ContentQualityData | undefined

    return {
      postId,
      readabilityScore: analysis?.readability_score || 0,
      seoScore: analysis?.seo_score || 0,
      issues: analysis?.issues || []
    }
  }

  /**
   * Get blog audit report with health metrics
   * @returns Comprehensive audit report
   * @throws {BlogError} When audit fails
   */
  static async getBlogAuditReport(): Promise<{
    overallHealth: number
    issues: Array<{
      category: 'content' | 'seo' | 'performance' | 'security'
      severity: 'low' | 'medium' | 'high' | 'critical'
      count: number
      description: string
    }>
    recommendations: string[]
  }> {
    const { data, error } = await blogRPC('generate_blog_audit_report')

    if (error) throw handleSupabaseError(error)

    const report = data?.[0] as AuditReportData | undefined

    return {
      overallHealth: report?.overall_health || 0,
      issues: report?.issues || [],
      recommendations: report?.recommendations || []
    }
  }

  /**
   * Get user activity summary for moderation purposes
   * @param userId - User ID to analyze
   * @param days - Number of days to look back (default: 30)
   * @returns User activity summary
   * @throws {BlogError} When query fails
   */
  static async getUserActivitySummary(userId: string, days = 30): Promise<{
    totalComments: number
    approvedComments: number
    rejectedComments: number
    avgCommentsPerDay: number
    flaggedContent: number
    recentActivity: Array<{
      type: 'comment' | 'post'
      id: string
      title: string
      createdAt: string
      status: string
    }>
  }> {
    const { data, error } = await blogRPC('get_user_activity_summary', {
      user_id_param: userId,
      days_param: days
    })

    if (error) throw handleSupabaseError(error)

    const summary = data?.[0] as UserActivityData | undefined

    return {
      totalComments: summary?.total_comments || 0,
      approvedComments: summary?.approved_comments || 0,
      rejectedComments: summary?.rejected_comments || 0,
      avgCommentsPerDay: summary?.avg_comments_per_day || 0,
      flaggedContent: summary?.flagged_content || 0,
      recentActivity: summary?.recent_activity || []
    }
  }
}