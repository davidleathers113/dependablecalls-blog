import { fromBlog as from, rpcBlog as rpc } from '../lib/supabase-blog'
import type {
  BlogPost,
  BlogPostRow,
  BlogAuthor,
  BlogCategory,
  BlogTag,
  BlogTagRow,
  BlogComment,
  CreateBlogPostData,
  UpdateBlogPostData,
  GetBlogPostsParams,
  GetBlogPostParams,
  PaginatedResponse,
  CreateCommentData,
  ModerateCommentData,
  GetCommentsParams,
  BlogStatistics,
  PopularTag,
  BlogAuthorUpdate,
  PostStatus,
} from '../types/blog'
import { BlogErrorFactory, handleSupabaseError, type BatchOperationResult } from '../types/errors'
import type { Database } from '../types/database.generated'

// Bulk operation types
export interface BulkStatusUpdate {
  postIds: string[]
  status: PostStatus
}

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

// Generic query builder type
export type QueryBuilder<T> = {
  filters?: Partial<T>
  select?: (keyof T)[]
  orderBy?: { field: keyof T; direction: 'asc' | 'desc' }[]
  limit?: number
  offset?: number
}

export class BlogService {
  /**
   * Get paginated list of blog posts with filters
   * @param params - Query parameters including pagination, filters, and sort options
   * @returns Paginated response with blog posts and metadata
   * @throws {BlogError} When database query fails
   */
  static async getPosts(params: GetBlogPostsParams): Promise<PaginatedResponse<BlogPost>> {
    const {
      page = 1,
      limit = 10,
      filters = {},
      sort = { by: 'published_at', order: 'desc' },
      includeAuthor = true,
      includeCategories = true,
      includeTags = true,
    } = params

    // Calculate offset
    const offset = (page - 1) * limit

    // Build select clause with relationships
    let selectClause = '*'
    if (includeAuthor) {
      selectClause += ', author:blog_authors(*)'
    }

    // Start building query with relationships
    let query = from('blog_posts').select(selectClause, { count: 'exact' })

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    } else {
      // Default to published posts for public queries
      query = query.eq('status', 'published')
    }

    if (filters.authorId) {
      query = query.eq('author_id', filters.authorId)
    }

    if (filters.search) {
      query = query.textSearch('search_vector', filters.search)
    }

    if (filters.startDate) {
      query = query.gte('published_at', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('published_at', filters.endDate)
    }

    // Apply category filter
    if (filters.categoryId || filters.categorySlug) {
      const categoryQuery = from('blog_categories').select('id')

      if (filters.categoryId) {
        categoryQuery.eq('id', filters.categoryId)
      } else if (filters.categorySlug) {
        categoryQuery.eq('slug', filters.categorySlug)
      }

      const { data: category } = await categoryQuery.single()

      if (category) {
        query = query.in(
          'id',
          from('blog_post_categories').select('post_id').eq('category_id', category.id)
        )
      }
    }

    // Apply tag filter
    if (filters.tagId || filters.tagSlug) {
      const tagQuery = from('blog_tags').select('id')

      if (filters.tagId) {
        tagQuery.eq('id', filters.tagId)
      } else if (filters.tagSlug) {
        tagQuery.eq('slug', filters.tagSlug)
      }

      const { data: tag } = await tagQuery.single()

      if (tag) {
        query = query.in('id', from('blog_post_tags').select('post_id').eq('tag_id', tag.id))
      }
    }

    // Apply sorting
    query = query.order(sort.by, { ascending: sort.order === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      throw handleSupabaseError(error)
    }

    // Load additional relationships if needed
    const posts: BlogPost[] = await Promise.all(
      (data || []).map(async (post) => {
        const blogPost: BlogPost = {
          ...post,
          author: (post as BlogPostRow & { author?: BlogAuthor }).author || null,
          categories: [],
          tags: [],
        }

        // Load categories if requested
        if (includeCategories) {
          const { data: categoryData } = await from('blog_post_categories')
            .select('category:blog_categories(*)')
            .eq('post_id', post.id)

          blogPost.categories = (categoryData || [])
            .map((item) => (item as { category: BlogCategory }).category)
            .filter(Boolean)
        }

        // Load tags if requested
        if (includeTags) {
          const { data: tagData } = await from('blog_post_tags')
            .select('tag:blog_tags(*)')
            .eq('post_id', post.id)

          blogPost.tags = (tagData || [])
            .map((item) => (item as { tag: BlogTag }).tag)
            .filter(Boolean)
        }

        return blogPost
      })
    )

    return {
      data: posts,
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
   * Get a single blog post by slug
   * @param params - Parameters including slug and relation flags
   * @returns Blog post with requested relations or null if not found
   * @throws {BlogError} When database query fails
   */
  static async getPost(params: GetBlogPostParams): Promise<BlogPost | null> {
    const {
      slug,
      includeAuthor = true,
      includeCategories = true,
      includeTags = true,
      includeComments = false,
    } = params

    // Build select clause with relationships
    let selectClause = '*'
    if (includeAuthor) {
      selectClause += ', author:blog_authors(*)'
    }

    const query = from('blog_posts')
      .select(selectClause)
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    const { data, error } = await query

    if (error || !data) {
      return null
    }

    // Increment view count
    await from('blog_posts')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id)

    const blogPost: BlogPost = {
      ...data,
      author: (data as BlogPostRow & { author?: BlogAuthor }).author || null,
      categories: [],
      tags: [],
      comments: undefined,
    }

    // Load categories if requested
    if (includeCategories) {
      const { data: categoryData } = await from('blog_post_categories')
        .select('category:blog_categories(*)')
        .eq('post_id', data.id)

      blogPost.categories = (categoryData || [])
        .map((item) => (item as { category: BlogCategory }).category)
        .filter(Boolean)
    }

    // Load tags if requested
    if (includeTags) {
      const { data: tagData } = await from('blog_post_tags')
        .select('tag:blog_tags(*)')
        .eq('post_id', data.id)

      blogPost.tags = (tagData || []).map((item) => (item as { tag: BlogTag }).tag).filter(Boolean)
    }

    // Load comments if requested
    if (includeComments) {
      const { data: commentsData } = await from('blog_comments')
        .select('*, user:users(id, email, username, avatar_url)')
        .eq('post_id', data.id)
        .eq('status', 'approved')
        .is('parent_id', null)
        .order('created_at', { ascending: true })

      blogPost.comments = commentsData || []
    }

    return blogPost
  }

  /**
   * Create a new blog post
   * @param data - Post data including content, metadata, and relations
   * @returns Created blog post
   * @throws {BlogError} When validation fails or database operation fails
   */
  static async createPost(data: CreateBlogPostData): Promise<BlogPost> {
    const { categoryIds = [], tagIds = [], ...postData } = data

    // Generate slug if not provided
    let slug = postData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Check if slug exists and generate unique one
    const { data: existingPost } = await from('blog_posts').select('id').eq('slug', slug).single()

    if (existingPost) {
      slug = `${slug}-${Date.now()}`
    }

    // Create the post
    const { data: post, error: postError } = await from('blog_posts')
      .insert({
        ...postData,
        slug,
        status: postData.status || 'draft',
        published_at: postData.status === 'published' ? new Date().toISOString() : undefined,
      })
      .select()
      .single()

    if (postError) throw postError

    // Add categories
    if (categoryIds.length > 0) {
      const { error: catError } = await from('blog_post_categories').insert(
        categoryIds.map((categoryId) => ({
          post_id: post.id,
          category_id: categoryId,
        }))
      )

      if (catError) throw catError
    }

    // Add tags
    if (tagIds.length > 0) {
      const { error: tagError } = await from('blog_post_tags').insert(
        tagIds.map((tagId) => ({
          post_id: post.id,
          tag_id: tagId,
        }))
      )

      if (tagError) throw tagError
    }

    // Return post with full relationships
    const fullPost = await this.getPost({
      slug: post.slug,
      includeAuthor: true,
      includeCategories: true,
      includeTags: true,
    })

    return fullPost || post
  }

  /**
   * Update an existing blog post
   * @param data - Update data including post ID and fields to update
   * @returns Updated blog post
   * @throws {BlogError} When post not found or update fails
   */
  static async updatePost(data: UpdateBlogPostData): Promise<BlogPost> {
    const { id, categoryIds, tagIds, ...updateData } = data

    // Update the post
    const { data: post, error: postError } = await from('blog_posts')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (postError) throw postError

    // Update categories if provided
    if (categoryIds !== undefined) {
      // Remove existing categories
      await from('blog_post_categories').delete().eq('post_id', id)

      // Add new categories
      if (categoryIds.length > 0) {
        const { error: catError } = await from('blog_post_categories').insert(
          categoryIds.map((categoryId) => ({
            post_id: id,
            category_id: categoryId,
          }))
        )

        if (catError) throw catError
      }
    }

    // Update tags if provided
    if (tagIds !== undefined) {
      // Remove existing tags
      await from('blog_post_tags').delete().eq('post_id', id)

      // Add new tags
      if (tagIds.length > 0) {
        const { error: tagError } = await from('blog_post_tags').insert(
          tagIds.map((tagId) => ({
            post_id: id,
            tag_id: tagId,
          }))
        )

        if (tagError) throw tagError
      }
    }

    // Return post with full relationships
    const fullPost = await this.getPost({
      slug: post.slug,
      includeAuthor: true,
      includeCategories: true,
      includeTags: true,
    })

    return fullPost || post
  }

  /**
   * Delete a blog post
   * @param id - Post ID to delete
   * @throws {BlogError} When post not found or deletion fails
   */
  static async deletePost(id: string): Promise<void> {
    const { error } = await from('blog_posts').delete().eq('id', id)

    if (error) throw handleSupabaseError(error)
  }

  /**
   * Bulk delete multiple blog posts
   * @param postIds - Array of post IDs to delete
   * @returns Result object with successful and failed operations
   */
  static async bulkDeletePosts(postIds: string[]): Promise<BatchOperationResult<string>> {
    const results: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      total: postIds.length,
      successCount: 0,
      failureCount: 0,
    }

    // Process in batches to avoid overwhelming the database
    const batchSize = 10
    for (let i = 0; i < postIds.length; i += batchSize) {
      const batch = postIds.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (postId, index) => {
          try {
            await this.deletePost(postId)
            results.successful.push(postId)
            results.successCount++
          } catch (error) {
            results.failed.push({
              operation: 'delete',
              itemId: postId,
              index: i + index,
              error: handleSupabaseError(error),
            })
            results.failureCount++
          }
        })
      )
    }

    return results
  }

  /**
   * Bulk update post status for multiple posts
   * @param postIds - Array of post IDs to update
   * @param status - New status to apply
   * @returns Result object with successful and failed operations
   */
  static async bulkUpdatePostStatus(
    postIds: string[],
    status: PostStatus
  ): Promise<BatchOperationResult<string>> {
    const results: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      total: postIds.length,
      successCount: 0,
      failureCount: 0,
    }

    // Use a single query for better performance
    const { data, error } = await from('blog_posts')
      .update({
        status,
        updated_at: new Date().toISOString(),
        published_at: status === 'published' ? new Date().toISOString() : undefined,
      })
      .in('id', postIds)
      .select('id')

    if (error) {
      // If batch operation fails, fall back to individual updates
      for (let i = 0; i < postIds.length; i++) {
        try {
          await this.updatePost({ id: postIds[i], status })
          results.successful.push(postIds[i])
          results.successCount++
        } catch (error) {
          results.failed.push({
            operation: 'update',
            itemId: postIds[i],
            index: i,
            error: handleSupabaseError(error),
          })
          results.failureCount++
        }
      }
    } else {
      // Mark all successful
      results.successful = data.map((item) => item.id)
      results.successCount = data.length

      // Find failed items
      const successfulIds = new Set(results.successful)
      postIds.forEach((id, index) => {
        if (!successfulIds.has(id)) {
          results.failed.push({
            operation: 'update',
            itemId: id,
            index,
            error: BlogErrorFactory.notFound('Post', id),
          })
          results.failureCount++
        }
      })
    }

    return results
  }

  /**
   * Search blog posts using full-text search
   * @param query - Search query string
   * @param limit - Maximum number of results
   * @returns Array of matching blog posts with full relationships
   * @throws {BlogError} When search fails
   */
  static async searchPosts(query: string, limit = 10): Promise<BlogPost[]> {
    const { data, error } = await from('blog_posts')
      .select('*, author:blog_authors(*)')
      .textSearch('search_vector', query)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) throw handleSupabaseError(error)

    // Load additional relationships for search results
    const posts: BlogPost[] = await Promise.all(
      (data || []).map(async (post) => {
        const blogPost: BlogPost = {
          ...post,
          author: (post as BlogPostRow & { author?: BlogAuthor }).author || null,
          categories: [],
          tags: [],
        }

        // Load categories
        const { data: categoryData } = await from('blog_post_categories')
          .select('category:blog_categories(*)')
          .eq('post_id', post.id)

        blogPost.categories = (categoryData || [])
          .map((item) => (item as { category: BlogCategory }).category)
          .filter(Boolean)

        // Load tags
        const { data: tagData } = await from('blog_post_tags')
          .select('tag:blog_tags(*)')
          .eq('post_id', post.id)

        blogPost.tags = (tagData || [])
          .map((item) => (item as { tag: BlogTag }).tag)
          .filter(Boolean)

        return blogPost
      })
    )

    return posts
  }

  /**
   * Get all categories
   * @returns Array of blog categories ordered by display order
   * @throws {BlogError} When query fails
   */
  static async getCategories(): Promise<BlogCategory[]> {
    const { data, error } = await from('blog_categories')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) throw handleSupabaseError(error)

    return data || []
  }

  /**
   * Batch update categories
   * @param updates - Array of category updates
   * @returns Result object with successful and failed operations
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
   * Get category by slug
   * @param slug - Category slug to search for
   * @returns Category object or null if not found
   * @throws {BlogError} When query fails
   */
  static async getCategoryBySlug(slug: string): Promise<BlogCategory | null> {
    const { data, error } = await from('blog_categories').select('*').eq('slug', slug).single()

    if (error) return null

    return data
  }

  /**
   * Get all tags
   * @returns Array of blog tags ordered by name
   * @throws {BlogError} When query fails
   */
  static async getTags(): Promise<BlogTag[]> {
    const { data, error } = await from('blog_tags').select('*').order('name', { ascending: true })

    if (error) throw handleSupabaseError(error)

    return data || []
  }

  /**
   * Batch update tags
   * @param updates - Array of tag updates
   * @returns Result object with successful and failed operations
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
   * Get tag by slug
   * @param slug - Tag slug to search for
   * @returns Tag object or null if not found
   * @throws {BlogError} When query fails
   */
  static async getTagBySlug(slug: string): Promise<BlogTag | null> {
    const { data, error } = await from('blog_tags').select('*').eq('slug', slug).single()

    if (error) return null

    return data
  }

  /**
   * Get popular tags based on usage count
   * @param limit - Maximum number of tags to return
   * @returns Array of popular tags with post count
   * @throws {BlogError} When query fails
   */
  static async getPopularTags(limit = 10): Promise<PopularTag[]> {
    // Use RPC function to get tags with post counts
    const { data, error } = await rpc('get_popular_tags', {
      tag_limit: limit,
    })

    if (error) {
      // Fallback to manual query if RPC fails
      const { data: tagData, error: tagError } = await from('blog_tags')
        .select(
          `
          *,
          blog_post_tags(count)
        `
        )
        .limit(limit)

      if (tagError) throw handleSupabaseError(tagError)

      return (tagData || []).map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        count:
          (tag as BlogTagRow & { blog_post_tags?: { count: number }[] }).blog_post_tags?.[0]
            ?.count || 0,
      }))
    }

    return (data || []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count: tag.post_count || 0,
    }))
  }

  /**
   * Get author profile by user ID
   * @param userId - User ID to fetch author profile for
   * @returns Author profile or null if not found
   * @throws {BlogError} When query fails
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
   * @param userId - User ID of the author
   * @param updates - Fields to update
   * @returns Updated author profile
   * @throws {BlogError} When author not found or update fails
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

  /**
   * Get comments for a post with pagination
   * @param params - Query parameters including filters and pagination
   * @returns Paginated response with comments
   * @throws {BlogError} When query fails
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
   * @param data - Comment data including post ID and content
   * @returns Created comment
   * @throws {BlogError} When validation fails or creation fails
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
   * @param data - Moderation data including comment ID and new status
   * @returns Updated comment
   * @throws {BlogError} When comment not found or update fails
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

  /**
   * Get blog statistics
   * @param authorId - Optional author ID to filter statistics
   * @returns Blog statistics object
   * @throws {BlogError} When RPC call fails
   */
  static async getStatistics(authorId?: string): Promise<BlogStatistics> {
    const { data, error } = await rpc('get_blog_statistics', {
      author_id_param: authorId || null,
    })

    if (error) throw handleSupabaseError(error)

    const stats = data?.[0]

    return {
      totalPosts: stats?.total_posts || 0,
      publishedPosts: stats?.published_posts || 0,
      draftPosts: stats?.draft_posts || 0,
      totalViews: stats?.total_views || 0,
      totalComments: stats?.total_comments || 0,
      avgReadingTime: stats?.avg_reading_time || 0,
    }
  }

  /**
   * Get similar posts using vector search
   * @param postId - Post ID to find similar posts for
   * @param limit - Maximum number of similar posts
   * @returns Array of similar blog posts with relationships
   * @throws {BlogError} When post not found or search fails
   */
  static async getSimilarPosts(postId: string, limit = 5): Promise<BlogPost[]> {
    // First get the post's embedding
    const { data: post } = await from('blog_posts').select('embedding').eq('id', postId).single()

    if (!post?.embedding) return []

    // Search for similar posts
    const { data, error } = await rpc('search_similar_posts', {
      query_embedding: post.embedding,
      match_count: limit + 1, // Include self
    })

    if (error) throw handleSupabaseError(error)

    // Filter out the current post
    const similarPosts = (data || []).filter((p) => p.id !== postId).slice(0, limit)

    // Load full relationships for similar posts
    const postsWithRelations: BlogPost[] = await Promise.all(
      similarPosts.map(async (post) => {
        // Get full post data with author
        const { data: fullPost } = await from('blog_posts')
          .select('*, author:blog_authors(*)')
          .eq('id', post.id)
          .single()

        if (!fullPost) return null

        const blogPost: BlogPost = {
          ...fullPost,
          author: (fullPost as BlogPostRow & { author?: BlogAuthor }).author || null,
          categories: [],
          tags: [],
        }

        // Load categories
        const { data: categoryData } = await from('blog_post_categories')
          .select('category:blog_categories(*)')
          .eq('post_id', post.id)

        blogPost.categories = (categoryData || [])
          .map((item) => (item as { category: BlogCategory }).category)
          .filter(Boolean)

        // Load tags
        const { data: tagData } = await from('blog_post_tags')
          .select('tag:blog_tags(*)')
          .eq('post_id', post.id)

        blogPost.tags = (tagData || [])
          .map((item) => (item as { tag: BlogTag }).tag)
          .filter(Boolean)

        return blogPost
      })
    )

    return postsWithRelations.filter(Boolean) as BlogPost[]
  }

  /**
   * Generic query builder for advanced filtering
   * @param table - Table name to query
   * @param builder - Query builder configuration
   * @returns Query results with type safety
   */
  static async query<T extends keyof Database['public']['Tables']>(
    table: T,
    builder: QueryBuilder<Database['public']['Tables'][T]['Row']>
  ): Promise<Database['public']['Tables'][T]['Row'][]> {
    let query = from(table).select(builder.select?.join(',') || '*')

    // Apply filters
    if (builder.filters) {
      Object.entries(builder.filters).forEach(([key, value]) => {
        if (value !== undefined) {
          // Type assertion needed for dynamic property access
          query = query.eq(key as keyof Database['public']['Tables'][T]['Row'], value)
        }
      })
    }

    // Apply ordering
    if (builder.orderBy) {
      builder.orderBy.forEach(({ field, direction }) => {
        // Type assertion needed for dynamic property access
        query = query.order(field as keyof Database['public']['Tables'][T]['Row'], {
          ascending: direction === 'asc',
        })
      })
    }

    // Apply pagination
    if (builder.limit) {
      query = query.limit(builder.limit)
    }

    if (builder.offset) {
      query = query.range(builder.offset, builder.offset + (builder.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) throw handleSupabaseError(error)

    return data || []
  }
}
