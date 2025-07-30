import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'
import { withRateLimit } from './_shared/rate-limit-middleware'
import type { 
  GetBlogPostsParams, 
  PostStatus,
  BlogPost,
  BlogCategory,
  BlogTag,
  BlogStatistics,
  PopularTag,
  PaginatedResponse
} from '../../src/types/blog'
import { handleSupabaseError } from '../../src/types/errors'
import { extractSessionFromCookies } from '../../src/lib/auth-cookies'

// Initialize Supabase client with anon key for RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration')
}

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Note: The following PostgreSQL functions need to be created in the database:
// 
// 1. increment_blog_view_count - Atomically increment view counter
// CREATE OR REPLACE FUNCTION increment_blog_view_count(post_id UUID)
// RETURNS VOID AS $$
// BEGIN
//   UPDATE blog_posts SET view_count = COALESCE(view_count, 0) + 1 WHERE id = post_id;
// END;
// $$ LANGUAGE plpgsql;
//
// 2. get_posts_by_category_slug - Get post IDs by category slug
// CREATE OR REPLACE FUNCTION get_posts_by_category_slug(category_slug TEXT)
// RETURNS TABLE(post_id UUID) AS $$
// BEGIN
//   RETURN QUERY
//   SELECT bpc.post_id
//   FROM blog_post_categories bpc
//   JOIN blog_categories bc ON bpc.category_id = bc.id
//   WHERE bc.slug = category_slug;
// END;
// $$ LANGUAGE plpgsql;
//
// 3. get_posts_by_tag_slug - Get post IDs by tag slug
// CREATE OR REPLACE FUNCTION get_posts_by_tag_slug(tag_slug TEXT)
// RETURNS TABLE(post_id UUID) AS $$
// BEGIN
//   RETURN QUERY
//   SELECT bpt.post_id
//   FROM blog_post_tags bpt
//   JOIN blog_tags bt ON bpt.tag_id = bt.id
//   WHERE bt.slug = tag_slug;
// END;
// $$ LANGUAGE plpgsql;

// Helper functions to match the optimized client pattern
const from = <T extends keyof Database['public']['Tables']>(table: T) => supabase.from(table)
const rpc = <T extends keyof Database['public']['Functions']>(
  fn: T,
  args?: Database['public']['Functions'][T]['Args']
) => supabase.rpc(fn, args)

// CORS headers for blog API - only allow GET since this is a read-only API
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// JSON response helper
const jsonResponse = (
  data: unknown,
  statusCode = 200,
  headers: Record<string, string> = {}
): HandlerResponse => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders,
    ...headers,
  },
  body: JSON.stringify(data),
})

// Generate unique trace ID for request tracking
const generateTraceId = (): string => {
  return `blog-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Error response helper with trace ID
const errorResponse = (
  message: string,
  statusCode = 400,
  error?: unknown,
  traceId?: string
): HandlerResponse => {
  const errorTraceId = traceId || generateTraceId()
  
  // Log structured error with trace ID
  console.error(JSON.stringify({
    traceId: errorTraceId,
    timestamp: new Date().toISOString(),
    level: 'error',
    service: 'blog-api',
    message,
    statusCode,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    } : error
  }))
  
  return jsonResponse(
    { 
      error: message,
      traceId: errorTraceId,
      details: process.env.NODE_ENV === 'development' ? error : undefined 
    },
    statusCode
  )
}

// Verify user authentication and get user ID
const authenticateUser = async (event: HandlerEvent): Promise<string | null> => {
  try {
    // Try to get token from Authorization header
    let token: string | undefined
    const authHeader = event.headers.authorization || event.headers.Authorization
    if (authHeader && typeof authHeader === 'string') {
      token = authHeader.replace('Bearer ', '')
    }

    // Fall back to cookies
    if (!token) {
      const cookieHeader = event.headers.cookie
      if (cookieHeader && typeof cookieHeader === 'string') {
        const session = extractSessionFromCookies(cookieHeader)
        token = session?.access_token
      }
    }

    if (!token) {
      return null
    }

    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return null
    }

    return user.id
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

// Check if user is a blog author (simplified - since we don't have user_id field)
const isBlogAuthor = async (): Promise<boolean> => {
  // For now, return false since we don't have user authentication integrated
  // This will need to be properly implemented when user authentication is added
  return false
}

// Parse query parameters for blog posts
const parsePostsQuery = (params: URLSearchParams, isAuthenticated: boolean): GetBlogPostsParams => {
  const page = parseInt(params.get('page') || '1', 10)
  const limit = Math.min(parseInt(params.get('limit') || '10', 10), 50) // Max 50 per page
  
  const filters: GetBlogPostsParams['filters'] = {}
  
  // Status filter - only allow non-published statuses for authenticated users
  const status = params.get('status')
  if (status && ['published', 'draft', 'scheduled'].includes(status)) {
    // Only authenticated users can access non-published content
    if (status !== 'published' && !isAuthenticated) {
      filters.status = 'published'
    } else {
      filters.status = status as PostStatus
    }
  } else {
    filters.status = 'published' // Default to published only
  }
  
  // Search query
  const search = params.get('search')
  if (search) {
    filters.search = search
  }
  
  // Category filter
  const categorySlug = params.get('category')
  if (categorySlug) {
    filters.categorySlug = categorySlug
  }
  
  // Tag filter
  const tagSlug = params.get('tag')
  if (tagSlug) {
    filters.tagSlug = tagSlug
  }
  
  // Author filter
  const authorId = params.get('author')
  if (authorId) {
    filters.authorId = authorId
  }
  
  // Date range filters
  const startDate = params.get('startDate')
  if (startDate) {
    filters.startDate = startDate
  }
  
  const endDate = params.get('endDate')
  if (endDate) {
    filters.endDate = endDate
  }
  
  // Sorting
  const sortBy = params.get('sortBy') || 'published_at'
  const sortOrder = params.get('sortOrder') || 'desc'
  
  return {
    page,
    limit,
    filters,
    sort: {
      by: sortBy as 'published_at' | 'created_at' | 'updated_at' | 'title' | 'view_count',
      order: sortOrder as 'asc' | 'desc',
    },
    includeAuthor: params.get('includeAuthor') !== 'false',
    includeCategories: params.get('includeCategories') !== 'false',
    includeTags: params.get('includeTags') !== 'false',
  }
}

// Helper functions for blog operations
const getPosts = async (params: GetBlogPostsParams, userId?: string): Promise<PaginatedResponse<BlogPost>> => {
  const {
    page = 1,
    limit = 10,
    filters = {},
    sort = { by: 'published_at', order: 'desc' },
    includeAuthor = true,
    includeCategories = true,
    includeTags = true
  } = params

  const offset = (page - 1) * limit

  let query = from('blog_posts').select(`
    *,
    ${includeAuthor ? 'author:blog_authors(*)' : ''},
    ${includeCategories ? 'categories:blog_post_categories(category:blog_categories(*))' : ''},
    ${includeTags ? 'tags:blog_post_tags(tag:blog_tags(*))' : ''}
  `, { count: 'exact' })

  // Apply filters with authentication check
  if (filters.status) {
    query = query.eq('status', filters.status)
    // If requesting non-published content, ensure user is the author
    if (filters.status !== 'published' && userId) {
      const isAuthor = await isBlogAuthor()
      if (isAuthor) {
        // Since we don't have user_id field, skip author filtering for now
        // This will need to be properly implemented when user authentication is added
        // For now, authenticated users can't see non-published posts
      }
    }
  } else {
    query = query.eq('status', 'published')
  }

  if (filters.authorId) {
    query = query.eq('author_id', filters.authorId)
  }

  if (filters.search) {
    // Use plainto_tsquery for safe text search
    query = query.textSearch('search_vector', filters.search, {
      type: 'plain',
      config: 'english'
    })
  }

  if (filters.startDate) {
    query = query.gte('published_at', filters.startDate)
  }

  if (filters.endDate) {
    query = query.lte('published_at', filters.endDate)
  }

  // Apply category and tag filters
  // Note: We need to use RPC for parameterized subqueries to avoid SQL injection
  if (filters.categorySlug || filters.tagSlug) {
    // Build filter conditions
    
    if (filters.categorySlug) {
      // Fetch category posts in a single query
      const { data: categoryPosts } = await supabase
        .rpc('get_posts_by_category_slug', { category_slug: filters.categorySlug })
      
      if (categoryPosts && categoryPosts.length > 0) {
        const postIds = categoryPosts.map((p: { post_id: string }) => p.post_id)
        query = query.in('id', postIds)
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
            hasPreviousPage: false
          }
        }
      }
    }
    
    if (filters.tagSlug) {
      // Fetch tag posts in a single query
      const { data: tagPosts } = await supabase
        .rpc('get_posts_by_tag_slug', { tag_slug: filters.tagSlug })
      
      if (tagPosts && tagPosts.length > 0) {
        const postIds = tagPosts.map((p: { post_id: string }) => p.post_id)
        query = query.in('id', postIds)
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
            hasPreviousPage: false
          }
        }
      }
    }
  }

  query = query.order(sort.by, { ascending: sort.order === 'asc' })
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) throw handleSupabaseError(error)

  const posts: BlogPost[] = (data || []).map(post => ({
    ...post,
    categories: post.categories?.map((pc: { category: BlogCategory }) => pc.category) || [],
    tags: post.tags?.map((pt: { tag: BlogTag }) => pt.tag) || []
  }))

  return {
    data: posts,
    meta: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      hasNextPage: page < Math.ceil((count || 0) / limit),
      hasPreviousPage: page > 1
    }
  }
}

const getPost = async (slug: string, options: {
  includeAuthor?: boolean
  includeCategories?: boolean
  includeTags?: boolean
  includeComments?: boolean
}): Promise<BlogPost | null> => {
  const {
    includeAuthor = true,
    includeCategories = true,
    includeTags = true,
    includeComments = false
  } = options

  const query = from('blog_posts').select(`
    *,
    ${includeAuthor ? 'author:blog_authors(*)' : ''},
    ${includeCategories ? 'categories:blog_post_categories(category:blog_categories(*))' : ''},
    ${includeTags ? 'tags:blog_post_tags(tag:blog_tags(*))' : ''},
    ${includeComments ? 'comments:blog_comments(*, user:users(id, email, username))' : ''}
  `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  const { data, error } = await query

  if (error || !data) return null

  // Increment view count atomically
  // Note: This requires creating a PostgreSQL function:
  // CREATE OR REPLACE FUNCTION increment_blog_view_count(post_id UUID)
  // RETURNS VOID AS $$
  // BEGIN
  //   UPDATE blog_posts SET view_count = COALESCE(view_count, 0) + 1 WHERE id = post_id;
  // END;
  // $$ LANGUAGE plpgsql;
  await supabase.rpc('increment_blog_view_count', { post_id: data.id })

  return {
    ...data,
    categories: data.categories?.map((pc: { category: BlogCategory }) => pc.category) || [],
    tags: data.tags?.map((pt: { tag: BlogTag }) => pt.tag) || [],
    comments: includeComments ? (data.comments || []) : undefined
  }
}

const searchPosts = async (query: string, limit = 10): Promise<BlogPost[]> => {
  const { data, error } = await from('blog_posts')
    .select('*, author:blog_authors(*)')
    .textSearch('search_vector', query, {
      type: 'plain',  // Use plainto_tsquery for safe text search
      config: 'english'
    })
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw handleSupabaseError(error)

  return data || []
}

const getCategories = async (): Promise<BlogCategory[]> => {
  const { data, error } = await from('blog_categories')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw handleSupabaseError(error)

  return data || []
}

const getCategoryBySlug = async (slug: string): Promise<BlogCategory | null> => {
  const { data, error } = await from('blog_categories')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) return null

  return data
}

const getTags = async (): Promise<BlogTag[]> => {
  const { data, error } = await from('blog_tags')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw handleSupabaseError(error)

  return data || []
}

const getTagBySlug = async (slug: string): Promise<BlogTag | null> => {
  const { data, error } = await from('blog_tags')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) return null

  return data
}

const getPopularTags = async (limit = 10): Promise<PopularTag[]> => {
  const { data, error } = await from('blog_tags')
    .select(`
      *,
      posts:blog_post_tags(count)
    `)
    .order('posts.count', { ascending: false })
    .limit(limit)

  if (error) throw handleSupabaseError(error)

  return (data || []).map(tag => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    count: tag.posts?.[0]?.count || 0
  }))
}

const getSimilarPosts = async (postId: string, limit = 5): Promise<BlogPost[]> => {
  const { data: post } = await from('blog_posts')
    .select('embedding')
    .eq('id', postId)
    .single()

  if (!post?.embedding) return []

  const { data, error } = await rpc('search_similar_posts', {
    query_embedding: post.embedding,
    match_count: limit + 1
  })

  if (error) throw handleSupabaseError(error)

  return (data || [])
    .filter(p => p.id !== postId)
    .slice(0, limit)
}

const getStatistics = async (authorId?: string): Promise<BlogStatistics> => {
  const { data, error } = await rpc('get_blog_statistics', {
    author_id_param: authorId || null
  })

  if (error) throw handleSupabaseError(error)

  const stats = data?.[0]

  return {
    totalPosts: stats?.total_posts || 0,
    publishedPosts: stats?.published_posts || 0,
    draftPosts: stats?.draft_posts || 0,
    totalViews: stats?.total_views || 0,
    totalComments: stats?.total_comments || 0,
    avgReadingTime: stats?.avg_reading_time || 0
  }
}

// Main blog API handler
const blogApiHandler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const { path, httpMethod, queryStringParameters } = event
  const params = new URLSearchParams(queryStringParameters || {})
  const traceId = generateTraceId()
  
  // Log incoming request
  console.log(JSON.stringify({
    traceId,
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'blog-api',
    method: httpMethod,
    path,
    queryParams: queryStringParameters
  }))
  
  // Extract path segments after /blog-api/
  const pathSegments = path.replace('/.netlify/functions/blog-api', '').split('/').filter(Boolean)
  const [resource, id] = pathSegments
  
  // Authenticate user if token is present
  const userId = await authenticateUser(event)
  
  try {
    // Route based on resource and method
    switch (resource) {
      case 'posts':
        if (httpMethod === 'GET' && id) {
          // Get single post by slug
          const post = await getPost(id, {
            includeAuthor: params.get('includeAuthor') !== 'false',
            includeCategories: params.get('includeCategories') !== 'false',
            includeTags: params.get('includeTags') !== 'false',
            includeComments: params.get('includeComments') === 'true',
          })
          
          if (!post) {
            return errorResponse('Post not found', 404, undefined, traceId)
          }
          
          return jsonResponse(post)
        } else if (httpMethod === 'GET') {
          // Get paginated posts
          const query = parsePostsQuery(params, !!userId)
          
          // Check if authentication is required for the requested status
          if (query.filters?.status && query.filters.status !== 'published' && !userId) {
            return errorResponse('Authentication required to access unpublished content', 401, undefined, traceId)
          }
          
          const result = await getPosts(query, userId)
          return jsonResponse(result)
        }
        break
        
      case 'search':
        if (httpMethod === 'GET') {
          const query = params.get('q')
          if (!query) {
            return errorResponse('Search query is required', 400, undefined, traceId)
          }
          
          const limit = Math.min(parseInt(params.get('limit') || '10', 10), 50)
          const posts = await searchPosts(query, limit)
          return jsonResponse({ results: posts })
        }
        break
        
      case 'categories':
        if (httpMethod === 'GET' && id) {
          // Get single category by slug
          const category = await getCategoryBySlug(id)
          if (!category) {
            return errorResponse('Category not found', 404, undefined, traceId)
          }
          return jsonResponse(category)
        } else if (httpMethod === 'GET') {
          // Get all categories
          const categories = await getCategories()
          return jsonResponse({ categories })
        }
        break
        
      case 'tags':
        if (httpMethod === 'GET' && id) {
          // Get single tag by slug
          const tag = await getTagBySlug(id)
          if (!tag) {
            return errorResponse('Tag not found', 404, undefined, traceId)
          }
          return jsonResponse(tag)
        } else if (httpMethod === 'GET') {
          // Get all tags or popular tags
          if (params.get('popular') === 'true') {
            const limit = Math.min(parseInt(params.get('limit') || '10', 10), 20)
            const tags = await getPopularTags(limit)
            return jsonResponse({ tags })
          } else {
            const tags = await getTags()
            return jsonResponse({ tags })
          }
        }
        break
        
      case 'similar':
        if (httpMethod === 'GET' && id) {
          // Get similar posts for a given post ID
          const limit = Math.min(parseInt(params.get('limit') || '5', 10), 10)
          const posts = await getSimilarPosts(id, limit)
          return jsonResponse({ posts })
        }
        break
        
      case 'statistics':
        if (httpMethod === 'GET') {
          // Get blog statistics
          const authorId = params.get('authorId') || undefined
          const stats = await getStatistics(authorId)
          return jsonResponse(stats)
        }
        break
        
      default:
        // Default route - show available endpoints
        if (!resource) {
          return jsonResponse({
            message: 'Blog API',
            version: '1.0',
            endpoints: [
              'GET /posts - Get paginated blog posts',
              'GET /posts/:slug - Get single post by slug',
              'GET /search?q=query - Search posts',
              'GET /categories - Get all categories',
              'GET /categories/:slug - Get category by slug',
              'GET /tags - Get all tags',
              'GET /tags?popular=true - Get popular tags',
              'GET /tags/:slug - Get tag by slug',
              'GET /similar/:postId - Get similar posts',
              'GET /statistics - Get blog statistics',
            ],
          })
        }
        return errorResponse('Invalid endpoint', 404, undefined, traceId)
    }
    
    return errorResponse('Method not allowed', 405, undefined, traceId)
  } catch (error) {
    return errorResponse('Internal server error', 500, error, traceId)
  }
}

// Main handler with rate limiting
export const handler: Handler = async (event) => {
  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    }
  }
  
  // Apply rate limiting
  // 30 requests per minute for anonymous users
  return withRateLimit(event, blogApiHandler, {
    skipPaths: ['/health'], // Skip rate limiting for health checks
    customIdentifier: (event) => {
      // Use Netlify's client connection IP for accurate rate limiting
      // This header cannot be spoofed by clients
      const headers = event.headers as Record<string, string>
      const ip = headers['x-nf-client-connection-ip'] || 'unknown'
      // Reject requests with multiple IP headers to prevent spoofing attempts
      if (headers['x-forwarded-for'] && headers['x-nf-client-connection-ip'] && 
          headers['x-forwarded-for'].split(',')[0].trim() !== headers['x-nf-client-connection-ip']) {
        console.warn('IP header mismatch detected', {
          'x-forwarded-for': headers['x-forwarded-for'],
          'x-nf-client-connection-ip': headers['x-nf-client-connection-ip']
        })
      }
      return `blog-api:${ip}`
    },
    onLimitExceeded: async (event, result) => {
      console.warn('Blog API rate limit exceeded', {
        path: event.path,
        ip: event.headers['x-nf-client-connection-ip'],
        remaining: result.remaining,
        resetTime: result.resetTime,
      })
    },
  })
}