/**
 * Blog Comment Service
 * Handles comment operations including creation, moderation, and retrieval
 */

import { fromBlog as from } from '../../lib/supabase-blog'
import type {
  BlogComment,
  BlogCommentRow,
  CreateCommentData,
  ModerateCommentData,
  GetCommentsParams,
  PaginatedResponse,
} from '../../types/blog'
import { handleSupabaseError } from '../../lib/supabase-utils'
import type { PostgrestResponse } from '@supabase/supabase-js'

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
      replies:blog_comments!parent_id(count)
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

    const result: PostgrestResponse<BlogComment> = await query
    const { data, error, count } = result

    if (error) throw handleSupabaseError(error)

    // Type guard to ensure data is properly typed
    const validatedData: BlogComment[] = (data || []).map((item) => {
      // Ensure the item has the required BlogComment structure
      const comment: BlogComment = {
        ...(item as BlogCommentRow),
        // No user relationship exists - blog_comments uses author_email/author_name
        user: undefined,
        replies: item.replies || undefined,
      }
      return comment
    })

    return {
      data: validatedData,
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
    const result = await from('blog_comments')
      .insert({
        ...data,
        status: 'pending', // All new comments start as pending
      })
      .select('*')
      .single()

    const { data: comment, error } = result

    if (error) throw handleSupabaseError(error)
    if (!comment) {
      throw handleSupabaseError(new Error('Failed to create comment - no data returned'))
    }

    // Type assertion with validation
    const validatedComment: BlogComment = {
      ...(comment as BlogCommentRow),
      // No user relationship exists - blog_comments uses author_email/author_name
      user: undefined,
    }

    return validatedComment
  }

  /**
   * Moderate a comment
   */
  static async moderateComment(data: ModerateCommentData): Promise<BlogComment> {
    const result = await from('blog_comments')
      .update({
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .select('*')
      .single()

    const { data: comment, error } = result

    if (error) throw handleSupabaseError(error)
    if (!comment) {
      throw handleSupabaseError(new Error('Failed to moderate comment - no data returned'))
    }

    // Type assertion with validation
    const validatedComment: BlogComment = {
      ...(comment as BlogCommentRow),
      // No user relationship exists - blog_comments uses author_email/author_name
      user: undefined,
    }

    return validatedComment
  }
}
