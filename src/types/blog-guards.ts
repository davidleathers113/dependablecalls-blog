/**
 * Type guards and validation functions for blog types
 *
 * Generated at: 2025-07-29T16:07:57.236Z
 *
 * To regenerate: npm run generate:types
 */

import type { Database } from './database.generated'
import type { PostStatus, CommentStatus, BlogSEOMetadata, AuthorSocialLinks } from './blog'

// Type aliases for database rows
type BlogPostRow = Database['public']['Tables']['blog_posts']['Row']
type BlogAuthorRow = Database['public']['Tables']['blog_authors']['Row']
type BlogCategoryRow = Database['public']['Tables']['blog_categories']['Row']
type BlogTagRow = Database['public']['Tables']['blog_tags']['Row']
type BlogCommentRow = Database['public']['Tables']['blog_comments']['Row']

/**
 * Check if a value is a valid PostStatus
 */
export function isValidPostStatus(value: unknown): value is PostStatus {
  return typeof value === 'string' && ['draft', 'published', 'archived'].includes(value)
}

/**
 * Check if a value is a valid CommentStatus
 */
export function isValidCommentStatus(value: unknown): value is CommentStatus {
  return typeof value === 'string' && ['pending', 'approved', 'spam', 'deleted'].includes(value)
}

/**
 * Type guard for BlogPostRow
 */
export function isBlogPostRow(value: unknown): value is BlogPostRow {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.slug === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.author_id === 'string' &&
    isValidPostStatus(obj.status) &&
    typeof obj.view_count === 'number' &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  )
}

/**
 * Type guard for BlogAuthorRow
 */
export function isBlogAuthorRow(value: unknown): value is BlogAuthorRow {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  return (
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  )
}

/**
 * Type guard for BlogCategoryRow
 */
export function isBlogCategoryRow(value: unknown): value is BlogCategoryRow {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string' &&
    typeof obj.display_order === 'number' &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  )
}

/**
 * Type guard for BlogTagRow
 */
export function isBlogTagRow(value: unknown): value is BlogTagRow {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string' &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  )
}

/**
 * Type guard for BlogCommentRow
 */
export function isBlogCommentRow(value: unknown): value is BlogCommentRow {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  return (
    typeof obj.id === 'string' &&
    typeof obj.post_id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.content === 'string' &&
    isValidCommentStatus(obj.status) &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  )
}

/**
 * Type guard for BlogSEOMetadata
 */
export function isBlogSEOMetadata(value: unknown): value is BlogSEOMetadata {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  // All fields are optional, so we just check the shape
  return (
    (obj.title === undefined || typeof obj.title === 'string') &&
    (obj.description === undefined || typeof obj.description === 'string') &&
    (obj.keywords === undefined || Array.isArray(obj.keywords)) &&
    (obj.ogImage === undefined || typeof obj.ogImage === 'string') &&
    (obj.ogTitle === undefined || typeof obj.ogTitle === 'string') &&
    (obj.ogDescription === undefined || typeof obj.ogDescription === 'string') &&
    (obj.canonicalUrl === undefined || typeof obj.canonicalUrl === 'string') &&
    (obj.noIndex === undefined || typeof obj.noIndex === 'boolean') &&
    (obj.noFollow === undefined || typeof obj.noFollow === 'boolean')
  )
}

/**
 * Type guard for AuthorSocialLinks
 */
export function isAuthorSocialLinks(value: unknown): value is AuthorSocialLinks {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  // All fields are optional, so we just check the shape
  return (
    (obj.twitter === undefined || typeof obj.twitter === 'string') &&
    (obj.linkedin === undefined || typeof obj.linkedin === 'string') &&
    (obj.github === undefined || typeof obj.github === 'string') &&
    (obj.website === undefined || typeof obj.website === 'string') &&
    (obj.facebook === undefined || typeof obj.facebook === 'string') &&
    (obj.instagram === undefined || typeof obj.instagram === 'string')
  )
}

/**
 * Validate and sanitize blog post data
 */
export function validateBlogPost(data: unknown): BlogPostRow | null {
  if (!isBlogPostRow(data)) return null

  // Additional validation
  if (data.title.length < 1 || data.title.length > 200) return null
  if (data.slug.length < 1 || data.slug.length > 200) return null
  if (data.content.length < 1) return null

  // Validate slug format (lowercase, alphanumeric with hyphens)
  if (!data.slug.match(/^[a-z0-9-]+$/)) return null

  // Validate dates
  if (data.published_at && isNaN(Date.parse(data.published_at))) return null
  if (isNaN(Date.parse(data.created_at))) return null
  if (isNaN(Date.parse(data.updated_at))) return null

  return data
}

/**
 * Validate and sanitize comment data
 */
export function validateComment(data: unknown): BlogCommentRow | null {
  if (!isBlogCommentRow(data)) return null

  // Additional validation
  if (data.content.length < 1 || data.content.length > 5000) return null

  // Validate dates
  if (isNaN(Date.parse(data.created_at))) return null
  if (isNaN(Date.parse(data.updated_at))) return null

  return data
}

/**
 * Create a type-safe blog post row
 */
export function createBlogPostRow(data: Partial<BlogPostRow>): BlogPostRow {
  const now = new Date().toISOString()

  return {
    id: data.id || crypto.randomUUID(),
    title: data.title || '',
    subtitle: data.subtitle ?? null,
    slug: data.slug || '',
    content: data.content || '',
    excerpt: data.excerpt ?? null,
    featured_image_url: data.featured_image_url ?? null,
    author_id: data.author_id || '',
    status: data.status || 'draft',
    published_at: data.published_at ?? null,
    metadata: data.metadata ?? null,
    view_count: data.view_count ?? 0,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
  }
}

/**
 * Array type guards
 */
export function isBlogPostRowArray(value: unknown): value is BlogPostRow[] {
  return Array.isArray(value) && value.every(isBlogPostRow)
}

export function isBlogAuthorRowArray(value: unknown): value is BlogAuthorRow[] {
  return Array.isArray(value) && value.every(isBlogAuthorRow)
}

export function isBlogCategoryRowArray(value: unknown): value is BlogCategoryRow[] {
  return Array.isArray(value) && value.every(isBlogCategoryRow)
}

export function isBlogTagRowArray(value: unknown): value is BlogTagRow[] {
  return Array.isArray(value) && value.every(isBlogTagRow)
}

export function isBlogCommentRowArray(value: unknown): value is BlogCommentRow[] {
  return Array.isArray(value) && value.every(isBlogCommentRow)
}
