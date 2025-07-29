import type { Database } from './database.generated'

// Database table types
export type BlogPostRow = Database['public']['Tables']['blog_posts']['Row']
export type BlogPostInsert = Database['public']['Tables']['blog_posts']['Insert']
export type BlogPostUpdate = Database['public']['Tables']['blog_posts']['Update']

export type BlogAuthorRow = Database['public']['Tables']['blog_authors']['Row']
export type BlogAuthorInsert = Database['public']['Tables']['blog_authors']['Insert']
export type BlogAuthorUpdate = Database['public']['Tables']['blog_authors']['Update']

export type BlogCategoryRow = Database['public']['Tables']['blog_categories']['Row']
export type BlogCategoryInsert = Database['public']['Tables']['blog_categories']['Insert']
export type BlogCategoryUpdate = Database['public']['Tables']['blog_categories']['Update']

export type BlogTagRow = Database['public']['Tables']['blog_tags']['Row']
export type BlogTagInsert = Database['public']['Tables']['blog_tags']['Insert']
export type BlogTagUpdate = Database['public']['Tables']['blog_tags']['Update']

export type BlogCommentRow = Database['public']['Tables']['blog_comments']['Row']
export type BlogCommentInsert = Database['public']['Tables']['blog_comments']['Insert']
export type BlogCommentUpdate = Database['public']['Tables']['blog_comments']['Update']

// Post status enum
export type PostStatus = 'draft' | 'published' | 'archived'

// Comment status enum
export type CommentStatus = 'pending' | 'approved' | 'spam' | 'deleted'

// Extended types with relations
export interface BlogPost extends BlogPostRow {
  author?: BlogAuthor
  categories?: BlogCategory[]
  tags?: BlogTag[]
  comments?: BlogComment[]
}

export interface BlogAuthor extends BlogAuthorRow {
  posts?: BlogPost[]
  postsCount?: number
  title?: string
  location?: string
  user?: {
    id: string
    email: string
    username?: string
  }
}

export interface BlogCategory extends BlogCategoryRow {
  posts?: BlogPost[]
  postsCount?: number
  parent?: BlogCategory
  children?: BlogCategory[]
}

export interface BlogTag extends BlogTagRow {
  posts?: BlogPost[]
  postsCount?: number
}

export interface BlogComment extends BlogCommentRow {
  post?: BlogPost
  user?: {
    id: string
    email: string
    username?: string
    avatar_url?: string
  }
  parent?: BlogComment
  replies?: BlogComment[]
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// Filter and sort types
export interface BlogPostFilters {
  status?: PostStatus
  authorId?: string
  categoryId?: string
  categorySlug?: string
  tagId?: string
  tagSlug?: string
  search?: string
  startDate?: string
  endDate?: string
}

export type BlogPostSortBy = 'published_at' | 'created_at' | 'updated_at' | 'title' | 'view_count'

export type SortOrder = 'asc' | 'desc'

export interface BlogPostSort {
  by: BlogPostSortBy
  order: SortOrder
}

// Request types
export interface GetBlogPostsParams extends PaginationParams {
  filters?: BlogPostFilters
  sort?: BlogPostSort
  includeAuthor?: boolean
  includeCategories?: boolean
  includeTags?: boolean
}

export interface GetBlogPostParams {
  slug: string
  includeAuthor?: boolean
  includeCategories?: boolean
  includeTags?: boolean
  includeComments?: boolean
}

export interface CreateBlogPostData {
  title: string
  subtitle?: string
  content: string
  excerpt?: string
  featured_image_url?: string
  status?: PostStatus
  published_at?: string
  metadata?: Record<string, unknown>
  categoryIds?: string[]
  tagIds?: string[]
}

export interface UpdateBlogPostData extends Partial<CreateBlogPostData> {
  id: string
}

// Comment types
export interface GetCommentsParams extends PaginationParams {
  postId?: string
  userId?: string
  status?: CommentStatus
  parentId?: string | null
}

export interface CreateCommentData {
  post_id: string
  content: string
  parent_id?: string
}

export interface ModerateCommentData {
  id: string
  status: CommentStatus
}

// Statistics types
export interface BlogStatistics {
  totalPosts: number
  publishedPosts: number
  draftPosts: number
  totalViews: number
  totalComments: number
  avgReadingTime: number
}

export interface PopularTag {
  id: string
  name: string
  slug: string
  count: number
}

// SEO metadata types
export interface BlogSEOMetadata {
  title?: string
  description?: string
  keywords?: string[]
  ogImage?: string
  ogTitle?: string
  ogDescription?: string
  canonicalUrl?: string
  noIndex?: boolean
  noFollow?: boolean
}

// Author social links type
export interface AuthorSocialLinks {
  twitter?: string
  linkedin?: string
  github?: string
  website?: string
  facebook?: string
  instagram?: string
}

// Response types
export interface BlogPostResponse {
  post: BlogPost
  relatedPosts?: BlogPost[]
}

export interface AuthorProfileResponse {
  author: BlogAuthor
  statistics: BlogStatistics
  recentPosts: BlogPost[]
}

// Error types
export interface BlogError {
  code: string
  message: string
  details?: unknown
}

// Constants
export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  spam: 'Spam',
  deleted: 'Deleted',
}

export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 100
