/**
 * Blog Post Service
 * Handles all post-related operations including CRUD, search, and bulk operations
 */

import { fromBlog as from } from '../../lib/supabase-blog'
import { BlogMockDataService, shouldUseBlogMockData } from '../../lib/blog-mock-data'
import type {
  BlogPost,
  BlogPostRow,
  BlogAuthor,
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
import { BlogErrorFactory } from '../../types/errors'

// Internal types for Supabase query results
interface RawPostWithAuthor extends BlogPostRow {
  author?: BlogAuthor
}

interface CategoryJoinResult {
  post_id: string
  category: BlogCategory
}

interface TagJoinResult {
  post_id: string
  tag: BlogTag
}

// Type guard to check if data is a valid post with author
function isRawPostWithAuthor(data: unknown): data is RawPostWithAuthor {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'title' in data &&
    'slug' in data &&
    'created_at' in data &&
    'updated_at' in data &&
    typeof (data as { id: unknown }).id === 'string' &&
    typeof (data as { title: unknown }).title === 'string' &&
    typeof (data as { slug: unknown }).slug === 'string' &&
    // Make sure it's not an error object
    !('code' in data) &&
    !('message' in data) &&
    !('hint' in data)
  )
}

// Type guard for category join results
function isCategoryJoinResult(data: unknown): data is CategoryJoinResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'post_id' in data &&
    'category' in data &&
    typeof (data as { post_id: unknown }).post_id === 'string' &&
    typeof (data as { category: unknown }).category === 'object' &&
    // Make sure it's not an error object
    !('code' in data) &&
    !('message' in data)
  )
}

// Type guard for tag join results
function isTagJoinResult(data: unknown): data is TagJoinResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'post_id' in data &&
    'tag' in data &&
    typeof (data as { post_id: unknown }).post_id === 'string' &&
    typeof (data as { tag: unknown }).tag === 'object' &&
    // Make sure it's not an error object
    !('code' in data) &&
    !('message' in data)
  )
}

export interface BulkStatusUpdate {
  postIds: string[]
  status: PostStatus
}

export class PostService {
  /**
   * Get paginated list of blog posts with filters
   */
  static async getPosts(params: GetBlogPostsParams): Promise<PaginatedResponse<BlogPost>> {
    // Use mock data if environment requires it
    if (shouldUseBlogMockData()) {
      BlogMockDataService.logUsage('getPosts')
      const mockResult = await BlogMockDataService.getBlogPosts({
        limit: params.limit,
        offset: params.page ? (params.page - 1) * (params.limit || 10) : 0,
        status: params.filters?.status,
      })

      if (mockResult.error) {
        throw new Error('Mock data error')
      }

      const posts = mockResult.data || []
      return {
        data: posts,
        meta: {
          page: params.page || 1,
          limit: params.limit || 10,
          total: posts.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }
    }
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

      const { data: category, error: categoryError } = await categoryQuery.single()

      if (categoryError) {
        // Category not found, skip filter
        return {
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: page > 1,
          },
        }
      }

      if (category) {
        // Get post IDs for this category
        const { data: postIds, error: postIdsError } = await from('blog_post_categories')
          .select('post_id')
          .eq('category_id', category.id)

        if (postIdsError) {
          throw handleSupabaseError(postIdsError)
        }

        if (postIds && postIds.length > 0) {
          query = query.in(
            'id',
            postIds.map((p: { post_id: string }) => p.post_id)
          )
        } else {
          // No posts in this category, return empty result
          return {
            data: [],
            meta: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: page > 1,
            },
          }
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

      const { data: tag, error: tagError } = await tagQuery.single()

      if (tagError) {
        // Tag not found, skip filter
        return {
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: page > 1,
          },
        }
      }

      if (tag) {
        // Get post IDs for this tag
        const { data: postIds, error: postIdsError } = await from('blog_post_tags')
          .select('post_id')
          .eq('tag_id', tag.id)

        if (postIdsError) {
          throw handleSupabaseError(postIdsError)
        }

        if (postIds && postIds.length > 0) {
          query = query.in(
            'id',
            postIds.map((p: { post_id: string }) => p.post_id)
          )
        } else {
          // No posts with this tag, return empty result
          return {
            data: [],
            meta: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: page > 1,
            },
          }
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

    // Extract post IDs for batch loading - validate data first
    if (!Array.isArray(data)) {
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

    const validPosts = data.filter(isRawPostWithAuthor) as unknown as RawPostWithAuthor[]
    if (validPosts.length === 0) {
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

    const postIds = validPosts.map((post) => post.id)

    // Batch load categories and tags if requested
    const [categoryData, tagData] = await Promise.all([
      includeCategories
        ? from('blog_post_categories')
            .select('post_id, category:blog_categories(*)')
            .in('post_id', postIds)
        : Promise.resolve({ data: [] }),
      includeTags
        ? from('blog_post_tags').select('post_id, tag:blog_tags(*)').in('post_id', postIds)
        : Promise.resolve({ data: [] }),
    ])

    // Create lookup maps for efficient assignment
    const categoriesByPostId = new Map<string, BlogCategory[]>()
    const tagsByPostId = new Map<string, BlogTag[]>()

    // Group categories by post ID
    if (categoryData.data) {
      for (const item of categoryData.data) {
        if (isCategoryJoinResult(item)) {
          const postId = item.post_id
          const category = item.category
          if (!categoriesByPostId.has(postId)) {
            categoriesByPostId.set(postId, [])
          }
          if (category) {
            categoriesByPostId.get(postId)!.push(category)
          }
        }
      }
    }

    // Group tags by post ID
    if (tagData.data) {
      for (const item of tagData.data) {
        if (isTagJoinResult(item)) {
          const postId = item.post_id
          const tag = item.tag
          if (!tagsByPostId.has(postId)) {
            tagsByPostId.set(postId, [])
          }
          if (tag) {
            tagsByPostId.get(postId)!.push(tag)
          }
        }
      }
    }

    // Map posts with their relationships
    const posts: BlogPost[] = validPosts.map((post) => ({
      ...post,
      author: post.author || undefined,
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
    // Use mock data if environment requires it
    if (shouldUseBlogMockData()) {
      BlogMockDataService.logUsage('getPost')
      const mockResult = await BlogMockDataService.getBlogPost(params.slug)

      if (mockResult.error) {
        return null
      }

      return mockResult.data
    }
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

    // Validate data structure
    if (!isRawPostWithAuthor(data)) {
      return null
    }

    // Increment view count
    await from('blog_posts')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id)

    const blogPost: BlogPost = {
      ...(data as RawPostWithAuthor),
      author: (data as RawPostWithAuthor).author || undefined,
      categories: [],
      tags: [],
      comments: undefined,
    }

    // Load categories if requested
    if (includeCategories) {
      const { data: categoryData, error: categoryError } = await from('blog_post_categories')
        .select('category:blog_categories(*)')
        .eq('post_id', data.id)

      if (categoryError) {
        throw handleSupabaseError(categoryError)
      }

      blogPost.categories = (categoryData || [])
        .map((item: unknown) => (item as unknown as { category: BlogCategory }).category)
        .filter(Boolean)
    }

    // Load tags if requested
    if (includeTags) {
      const { data: tagData, error: tagError } = await from('blog_post_tags')
        .select('tag:blog_tags(*)')
        .eq('post_id', data.id)

      if (tagError) {
        throw handleSupabaseError(tagError)
      }

      blogPost.tags = (tagData || [])
        .map((item: unknown) => (item as unknown as { tag: BlogTag }).tag)
        .filter(Boolean)
    }

    // Load comments if requested
    if (includeComments) {
      const { data: commentsData, error: commentsError } = await from('blog_comments')
        .select('*')
        .eq('post_id', data.id)
        .eq('status', 'approved')
        .is('parent_id', null)
        .order('created_at', { ascending: true })

      if (commentsError) {
        throw handleSupabaseError(commentsError)
      }

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

    if (postError) throw handleSupabaseError(postError)

    // Generate human-readable slug from title
    const baseSlug = generateSlug(postData.title)

    // Check if the human-readable slug exists
    const { data: existingPost, error: slugCheckError } = await from('blog_posts')
      .select('id')
      .eq('slug', baseSlug)
      .neq('id', post.id) // Exclude the post we just created
      .single()

    // For slug checks, PGRST116 (not found) is expected and not an error
    if (slugCheckError && slugCheckError.code !== 'PGRST116') {
      throw handleSupabaseError(slugCheckError)
    }

    // Update with human-readable slug or append timestamp if it exists
    const finalSlug = ensureUniqueSlug(baseSlug, !!existingPost)

    const { data: updatedPost, error: updateError } = await from('blog_posts')
      .update({ slug: finalSlug })
      .eq('id', post.id)
      .select()
      .single()

    if (updateError) {
      // If update fails, post still exists with UUID slug
      console.error('Failed to update slug:', updateError)
    } else if (updatedPost) {
      // Update the post object with the returned data
      post.slug = updatedPost.slug
    }

    // Add categories
    if (categoryIds.length > 0) {
      const { error: catError } = await from('blog_post_categories').insert(
        categoryIds.map((categoryId) => ({
          post_id: post.id,
          category_id: categoryId,
        }))
      )

      if (catError) throw handleSupabaseError(catError)
    }

    // Add tags
    if (tagIds.length > 0) {
      const { error: tagError } = await from('blog_post_tags').insert(
        tagIds.map((tagId) => ({
          post_id: post.id,
          tag_id: tagId,
        }))
      )

      if (tagError) throw handleSupabaseError(tagError)
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

    if (postError) throw handleSupabaseError(postError)

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

        if (catError) throw handleSupabaseError(catError)
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

        if (tagError) throw handleSupabaseError(tagError)
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
      results.successful = data.map((item: { id: string }) => item.id)
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

    // Validate data and extract post IDs for batch loading
    if (!Array.isArray(data)) {
      return []
    }

    const validPosts = data.filter(isRawPostWithAuthor) as unknown as RawPostWithAuthor[]
    if (validPosts.length === 0) {
      return []
    }
    const postIds = validPosts.map((post) => post.id)

    // Batch load categories and tags
    const [categoryData, tagData] = await Promise.all([
      from('blog_post_categories')
        .select('post_id, category:blog_categories(*)')
        .in('post_id', postIds),
      from('blog_post_tags').select('post_id, tag:blog_tags(*)').in('post_id', postIds),
    ])

    // Create lookup maps for efficient assignment
    const categoriesByPostId = new Map<string, BlogCategory[]>()
    const tagsByPostId = new Map<string, BlogTag[]>()

    // Group categories by post ID
    if (categoryData.data) {
      for (const item of categoryData.data) {
        const postId = (item as unknown as CategoryJoinResult).post_id
        const category = (item as unknown as CategoryJoinResult).category
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
        if (isTagJoinResult(item)) {
          const postId = item.post_id
          const tag = item.tag
          if (!tagsByPostId.has(postId)) {
            tagsByPostId.set(postId, [])
          }
          if (tag) {
            tagsByPostId.get(postId)!.push(tag)
          }
        }
      }
    }

    // Map posts with their relationships
    const posts: BlogPost[] = validPosts.map((post) => ({
      ...post,
      author: post.author || undefined,
      categories: categoriesByPostId.get(post.id) || [],
      tags: tagsByPostId.get(post.id) || [],
    }))

    return posts
  }

  /**
   * Get similar posts using category-based similarity (embedding removed due to PostgREST compatibility)
   */
  static async getSimilarPosts(postId: string, limit = 5): Promise<BlogPost[]> {
    // Use category-based similarity instead of embedding to avoid PostgREST 400 errors
    // Return posts from the same categories
    const { data: categoryData, error: categoryError } = await from('blog_post_categories')
      .select('category_id')
      .eq('post_id', postId)

    if (categoryError || !categoryData || categoryData.length === 0) return []

    const categoryIds = categoryData.map((c: { category_id: string }) => c.category_id)

    // Find other posts in the same categories
    const { data: relatedPostIds, error: relatedError } = await from('blog_post_categories')
      .select('post_id')
      .in('category_id', categoryIds)
      .neq('post_id', postId)
      .limit(limit * 2) // Get more to ensure we have enough unique posts

    if (relatedError || !relatedPostIds || relatedPostIds.length === 0) return []

    // Get unique post IDs
    const uniquePostIds = Array.from(
      new Set(relatedPostIds.map((r: { post_id: string }) => r.post_id))
    ).slice(0, limit)

    const { data: similarPosts, error: similarError } = await from('blog_posts')
      .select('*')
      .in('id', uniquePostIds)
      .eq('status', 'published')

    if (similarError || !similarPosts || similarPosts.length === 0) return []

    // Load full relationships for similar posts
    const postsWithRelations = await Promise.all(
      similarPosts.map(async (post: BlogPostRow) => {
        // Get full post data with author
        const { data: fullPost, error: fullPostError } = await from('blog_posts')
          .select('*, author:blog_authors(*)')
          .eq('id', post.id)
          .single()

        if (fullPostError || !fullPost) return null

        // Validate that fullPost is a proper post structure
        if (!isRawPostWithAuthor(fullPost)) return null

        const blogPost: BlogPost = {
          ...fullPost,
          author: fullPost.author || undefined,
          categories: [],
          tags: [],
        }

        // Load categories
        const { data: categoryData, error: categoryError } = await from('blog_post_categories')
          .select('category:blog_categories(*)')
          .eq('post_id', post.id)

        if (categoryError) {
          // Log error but don't fail the entire operation
          console.warn('Failed to load categories for post:', post.id, categoryError)
        }

        blogPost.categories = (categoryData || [])
          .map((item: unknown) => (item as unknown as { category: BlogCategory }).category)
          .filter(Boolean)

        // Load tags
        const { data: tagData, error: tagError } = await from('blog_post_tags')
          .select('tag:blog_tags(*)')
          .eq('post_id', post.id)

        if (tagError) {
          // Log error but don't fail the entire operation
          console.warn('Failed to load tags for post:', post.id, tagError)
        }

        blogPost.tags = (tagData || [])
          .map((item: unknown) => (item as unknown as { tag: BlogTag }).tag)
          .filter(Boolean)

        return blogPost
      })
    )

    return postsWithRelations.filter(Boolean) as BlogPost[]
  }
}
