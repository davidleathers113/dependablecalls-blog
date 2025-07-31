/**
 * Blog Post Service
 * Handles all post-related operations including CRUD, search, and bulk operations
 */

import { fromBlog as from } from '../../lib/supabase-blog'
import type {
  BlogPost,
  CreateBlogPostData,
  UpdateBlogPostData,
  GetBlogPostsParams,
  GetBlogPostParams,
  PaginatedResponse,
  PostStatus,
  BlogCategory,
  BlogTag,
} from '../../types/blog'
import { handleSupabaseError, generateSlug, ensureUniqueSlug } from '../../lib/supabase-utils'
import type { BatchOperationResult } from '../../types/errors'

export interface BulkStatusUpdate {
  postIds: string[]
  status: PostStatus
}

export class PostService {
  /**
   * Get paginated list of blog posts with filters
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
        // Get post IDs for this category
        const { data: postIds } = await from('blog_post_categories')
          .select('post_id')
          .eq('category_id', category.id)
        
        if (postIds && postIds.length > 0) {
          query = query.in('id', postIds.map(p => p.post_id))
        }
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
        // Get post IDs for this tag
        const { data: postIds } = await from('blog_post_tags')
          .select('post_id')
          .eq('tag_id', tag.id)
        
        if (postIds && postIds.length > 0) {
          query = query.in('id', postIds.map(p => p.post_id))
        }
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

    // If no posts found, return empty result
    if (!data || data.length === 0) {
      return {
        data: [],
        meta: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasNextPage: false,
          hasPreviousPage: page > 1,
        },
      }
    }

    // Extract post IDs for batch loading
    const postIds = data.map((post: any) => post.id)

    // Batch load categories and tags if requested
    const [categoryData, tagData] = await Promise.all([
      includeCategories
        ? from('blog_post_categories')
            .select('post_id, category:blog_categories(*)')
            .in('post_id', postIds)
        : Promise.resolve({ data: [] }),
      includeTags
        ? from('blog_post_tags')
            .select('post_id, tag:blog_tags(*)')
            .in('post_id', postIds)
        : Promise.resolve({ data: [] }),
    ])

    // Create lookup maps for efficient assignment
    const categoriesByPostId = new Map<string, any[]>()
    const tagsByPostId = new Map<string, any[]>()

    // Group categories by post ID
    if (categoryData.data) {
      for (const item of categoryData.data) {
        const postId = (item as any).post_id
        const category = (item as any).category
        if (!categoriesByPostId.has(postId)) {
          categoriesByPostId.set(postId, [])
        }
        if (category) {
          categoriesByPostId.get(postId)!.push(category)
        }
      }
    }

    // Group tags by post ID
    if (tagData.data) {
      for (const item of tagData.data) {
        const postId = (item as any).post_id
        const tag = (item as any).tag
        if (!tagsByPostId.has(postId)) {
          tagsByPostId.set(postId, [])
        }
        if (tag) {
          tagsByPostId.get(postId)!.push(tag)
        }
      }
    }

    // Map posts with their relationships
    const posts: BlogPost[] = data.map((post: any) => ({
      ...post,
      author: post.author || null,
      categories: categoriesByPostId.get(post.id) || [],
      tags: tagsByPostId.get(post.id) || [],
    }))

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
      .update({ view_count: ((data as any).view_count || 0) + 1 })
      .eq('id', (data as any).id)

    const blogPost: BlogPost = {
      ...(data as any),
      author: (data as any).author || null,
      categories: [],
      tags: [],
      comments: undefined,
    }

    // Load categories if requested
    if (includeCategories) {
      const { data: categoryData } = await from('blog_post_categories')
        .select('category:blog_categories(*)')
        .eq('post_id', (data as any).id)

      blogPost.categories = (categoryData || [])
        .map((item) => (item as any).category)
        .filter(Boolean)
    }

    // Load tags if requested
    if (includeTags) {
      const { data: tagData } = await from('blog_post_tags')
        .select('tag:blog_tags(*)')
        .eq('post_id', (data as any).id)

      blogPost.tags = (tagData || []).map((item) => (item as any).tag).filter(Boolean)
    }

    // Load comments if requested
    if (includeComments) {
      const { data: commentsData } = await from('blog_comments')
        .select('*, user:users(id, email, username, avatar_url)')
        .eq('post_id', (data as any).id)
        .eq('status', 'approved')
        .is('parent_id', null)
        .order('created_at', { ascending: true })

      blogPost.comments = commentsData || []
    }

    return blogPost
  }

  /**
   * Create a new blog post
   */
  static async createPost(data: CreateBlogPostData): Promise<BlogPost> {
    const { categoryIds = [], tagIds = [], ...postData } = data

    // Generate a temporary unique slug using crypto.randomUUID()
    // This ensures atomicity - the insert will always succeed
    const tempSlug = crypto.randomUUID()

    // Create the post with temporary slug
    const { data: post, error: postError } = await from('blog_posts')
      .insert({
        ...postData,
        slug: tempSlug,
        status: postData.status || 'draft',
        published_at: postData.status === 'published' ? new Date().toISOString() : undefined,
      })
      .select()
      .single()

    if (postError) throw postError

    // Generate human-readable slug from title
    const baseSlug = generateSlug(postData.title)

    // Check if the human-readable slug exists
    const { data: existingPost } = await from('blog_posts')
      .select('id')
      .eq('slug', baseSlug)
      .neq('id', post.id) // Exclude the post we just created
      .single()

    // Update with human-readable slug or append timestamp if it exists
    const finalSlug = ensureUniqueSlug(baseSlug, !!existingPost)
    
    const { error: updateError } = await from('blog_posts')
      .update({ slug: finalSlug })
      .eq('id', post.id)

    if (updateError) {
      // If update fails, post still exists with UUID slug
      console.error('Failed to update slug:', updateError)
    } else {
      post.slug = finalSlug
    }

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
   */
  static async deletePost(id: string): Promise<void> {
    const { error } = await from('blog_posts').delete().eq('id', id)

    if (error) throw handleSupabaseError(error)
  }

  /**
   * Bulk delete multiple blog posts
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
            error: {
              code: 'NOT_FOUND',
              message: `Post ${id} not found`,
              statusCode: 404,
            },
          })
          results.failureCount++
        }
      })
    }

    return results
  }

  /**
   * Search blog posts using full-text search
   */
  static async searchPosts(query: string, limit = 10): Promise<BlogPost[]> {
    const { data, error } = await from('blog_posts')
      .select('*, author:blog_authors(*)')
      .textSearch('search_vector', query)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) throw handleSupabaseError(error)

    // If no posts found, return empty array
    if (!data || data.length === 0) {
      return []
    }

    // Extract post IDs for batch loading
    const postIds = data.map((post) => post.id)

    // Batch load categories and tags
    const [categoryData, tagData] = await Promise.all([
      from('blog_post_categories')
        .select('post_id, category:blog_categories(*)')
        .in('post_id', postIds),
      from('blog_post_tags')
        .select('post_id, tag:blog_tags(*)')
        .in('post_id', postIds),
    ])

    // Create lookup maps for efficient assignment
    const categoriesByPostId = new Map<string, any[]>()
    const tagsByPostId = new Map<string, any[]>()

    // Group categories by post ID
    if (categoryData.data) {
      for (const item of categoryData.data) {
        const postId = (item as any).post_id
        const category = (item as any).category
        if (!categoriesByPostId.has(postId)) {
          categoriesByPostId.set(postId, [])
        }
        if (category) {
          categoriesByPostId.get(postId)!.push(category)
        }
      }
    }

    // Group tags by post ID
    if (tagData.data) {
      for (const item of tagData.data) {
        const postId = (item as any).post_id
        const tag = (item as any).tag
        if (!tagsByPostId.has(postId)) {
          tagsByPostId.set(postId, [])
        }
        if (tag) {
          tagsByPostId.get(postId)!.push(tag)
        }
      }
    }

    // Map posts with their relationships
    const posts: BlogPost[] = data.map((post: any) => ({
      ...post,
      author: post.author || null,
      categories: categoriesByPostId.get(post.id) || [],
      tags: tagsByPostId.get(post.id) || [],
    }))

    return posts
  }

  /**
   * Get similar posts using vector search
   */
  static async getSimilarPosts(postId: string, limit = 5): Promise<BlogPost[]> {
    // First get the post's embedding
    const { data: post } = await from('blog_posts').select('embedding').eq('id', postId).single()

    if (!post?.embedding) return []

    // Manual similarity search since RPC is not available
    // For now, return posts from the same categories
    const { data: categoryData } = await from('blog_post_categories')
      .select('category_id')
      .eq('post_id', postId)

    if (!categoryData || categoryData.length === 0) return []

    const categoryIds = categoryData.map(c => c.category_id)

    // Find other posts in the same categories
    const { data: relatedPostIds } = await from('blog_post_categories')
      .select('post_id')
      .in('category_id', categoryIds)
      .neq('post_id', postId)
      .limit(limit * 2) // Get more to ensure we have enough unique posts

    if (!relatedPostIds || relatedPostIds.length === 0) return []

    // Get unique post IDs
    const uniquePostIds = Array.from(new Set(relatedPostIds.map(r => r.post_id))).slice(0, limit)
    
    const { data: similarPosts } = await from('blog_posts')
      .select('*')
      .in('id', uniquePostIds)
      .eq('status', 'published')
    
    if (!similarPosts || similarPosts.length === 0) return []

    // Load full relationships for similar posts
    const postsWithRelations = await Promise.all(
      similarPosts.map(async (post: any) => {
        // Get full post data with author
        const { data: fullPost } = await from('blog_posts')
          .select('*, author:blog_authors(*)')
          .eq('id', post.id)
          .single()

        if (!fullPost) return null

        const blogPost: BlogPost = {
          ...(fullPost as any),
          author: (fullPost as any).author || null,
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
}