/**
 * Blog Comment Service
 * Handles comment operations including creation, moderation, and retrieval
 */

import { fromBlog as from } from '../../lib/supabase-blog'
import type {
  BlogComment,
  CreateCommentData,
  ModerateCommentData,
  GetCommentsParams,
  PaginatedResponse,
} from '../../types/blog'
import { handleSupabaseError } from '../../lib/supabase-utils'

export class CommentService {
  /**
   * Get comments for a post with pagination
   */
  static async getComments(params: GetCommentsParams): Promise<PaginatedResponse<BlogComment>> {
    const { postId, userId, status = 'approved', parentId = null, page = 1, limit = 20 } = params
    const offset = (page - 1) * limit

    let query = from('blog_comments').select(
      `
      *,
      user:users(id, email, username, avatar_url),
      replies:blog_comments(count)
    `,
      { count: 'exact' }
    )

    if (postId) {
      query = query.eq('post_id', postId)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (parentId !== undefined) {
      query = parentId === null ? query.is('parent_id', null) : query.eq('parent_id', parentId)
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw handleSupabaseError(error)

    return {
      data: data || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNextPage: page < Math.ceil((count || 0) / limit),
        hasPreviousPage: page > 1,
      },
    }
  }

  /**
   * Create a new comment
   */
  static async createComment(data: CreateCommentData): Promise<BlogComment> {
    const { data: comment, error } = await from('blog_comments')
      .insert({
        ...data,
        status: 'pending', // All new comments start as pending
      })
      .select('*, user:users(id, email, username, avatar_url)')
      .single()

    if (error) throw handleSupabaseError(error)

    return comment
  }

  /**
   * Moderate a comment
   */
  static async moderateComment(data: ModerateCommentData): Promise<BlogComment> {
    const { data: comment, error } = await from('blog_comments')
      .update({
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .select()
      .single()

    if (error) throw handleSupabaseError(error)

    return comment
  }
}