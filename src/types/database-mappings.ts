/**
 * Database type mappings and converters
 *
 * Utilities for converting between database rows and application types
 *
 * Generated at: 2025-07-29T16:07:57.237Z
 *
 * To regenerate: npm run generate:types
 */

import type { Database } from './database-extended'
import type {
  BlogPost,
  BlogAuthor,
  BlogCategory,
  BlogTag,
  BlogComment,
  BlogSEOMetadata,
  AuthorSocialLinks,
} from './blog'
import { isBlogSEOMetadata, isAuthorSocialLinks } from './blog-guards'

// Type aliases for database rows
type BlogPostRow = Database['public']['Tables']['blog_posts']['Row']
type BlogAuthorRow = Database['public']['Tables']['blog_authors']['Row']
type BlogCategoryRow = Database['public']['Tables']['blog_categories']['Row']
type BlogTagRow = Database['public']['Tables']['blog_tags']['Row']
type BlogCommentRow = Database['public']['Tables']['blog_comments']['Row']

/**
 * Parse JSON metadata safely
 */
function parseJsonSafely<T>(json: unknown, validator?: (value: unknown) => value is T): T | null {
  if (!json) return null

  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json
    if (validator) {
      return validator(parsed) ? parsed : null
    }
    return parsed as T
  } catch {
    return null
  }
}

/**
 * Convert database blog post row to application type
 */
export function mapBlogPostRow(row: BlogPostRow): BlogPost {
  const seoMetadata = parseJsonSafely<BlogSEOMetadata>(row.metadata, isBlogSEOMetadata)

  return {
    ...row,
    seo_metadata: seoMetadata,
  }
}

/**
 * Convert database blog author row to application type
 */
export function mapBlogAuthorRow(row: BlogAuthorRow): BlogAuthor {
  // const socialLinks = parseJsonSafely<AuthorSocialLinks>(row.social_links, isAuthorSocialLinks) // unused for now

  return {
    ...row,
  }
}

/**
 * Convert database blog category row to application type
 */
export function mapBlogCategoryRow(row: BlogCategoryRow): BlogCategory {
  return {
    ...row,
  }
}

/**
 * Convert database blog tag row to application type
 */
export function mapBlogTagRow(row: BlogTagRow): BlogTag {
  return {
    ...row,
  }
}

/**
 * Convert database blog comment row to application type
 */
export function mapBlogCommentRow(row: BlogCommentRow): BlogComment {
  return {
    ...row,
  }
}

/**
 * Convert application blog post to database insert type
 */
export function mapBlogPostToInsert(
  post: Partial<BlogPost> & { author_id: string; content: string; title: string; slug: string }
): Database['public']['Tables']['blog_posts']['Insert'] {
  const { seo_metadata, author, categories, tags, comments, ...rest } = post

  return {
    ...rest,
    metadata: seo_metadata ? JSON.stringify(seo_metadata) : null,
  }
}

/**
 * Convert application blog post to database update type
 */
export function mapBlogPostToUpdate(
  post: Partial<BlogPost>
): Database['public']['Tables']['blog_posts']['Update'] {
  const { seo_metadata, ...rest } = post

  return {
    ...rest,
    metadata: seo_metadata !== undefined ? JSON.stringify(seo_metadata) : undefined,
  }
}

/**
 * Convert application blog author to database insert type
 */
export function mapBlogAuthorToInsert(
  author: Partial<BlogAuthor>
): Database['public']['Tables']['blog_authors']['Insert'] {
  const { social_links, ...rest } = author

  return {
    ...rest,
    display_name: author.display_name || 'Unknown Author',
    email: author.email || '',
    social_links: social_links ? JSON.stringify(social_links) : null,
  }
}

/**
 * Convert application blog author to database update type
 */
export function mapBlogAuthorToUpdate(
  author: Partial<BlogAuthor>
): Database['public']['Tables']['blog_authors']['Update'] {
  const { social_links, ...rest } = author

  return {
    ...rest,
    social_links: social_links !== undefined ? JSON.stringify(social_links) : undefined,
  }
}

/**
 * Batch converters for arrays
 */
export function mapBlogPostRows(rows: BlogPostRow[]): BlogPost[] {
  return rows.map(mapBlogPostRow)
}

export function mapBlogAuthorRows(rows: BlogAuthorRow[]): BlogAuthor[] {
  return rows.map(mapBlogAuthorRow)
}

export function mapBlogCategoryRows(rows: BlogCategoryRow[]): BlogCategory[] {
  return rows.map(mapBlogCategoryRow)
}

export function mapBlogTagRows(rows: BlogTagRow[]): BlogTag[] {
  return rows.map(mapBlogTagRow)
}

export function mapBlogCommentRows(rows: BlogCommentRow[]): BlogComment[] {
  return rows.map(mapBlogCommentRow)
}

/**
 * Helper to extract IDs from relations
 */
export function extractCategoryIds(categories?: BlogCategory[]): string[] {
  return categories?.map((c) => c.id) || []
}

export function extractTagIds(tags?: BlogTag[]): string[] {
  return tags?.map((t) => t.id) || []
}

/**
 * Slug generation helper
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200)
}

/**
 * Excerpt generation helper
 */
export function generateExcerpt(content: string, maxLength = 160): string {
  // Strip HTML tags if present
  const stripped = content.replace(/<[^>]*>/g, '')

  // Truncate at word boundary
  if (stripped.length <= maxLength) return stripped

  const truncated = stripped.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...'
}

/**
 * Reading time calculation
 */
export function calculateReadingTime(content: string, wordsPerMinute = 200): number {
  const text = content.replace(/<[^>]*>/g, '')
  const wordCount = text.split(/\s+/).length
  return Math.ceil(wordCount / wordsPerMinute)
}
