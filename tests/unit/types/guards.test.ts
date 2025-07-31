import { describe, expect, it } from 'vitest'
import type {
  BlogPost,
  BlogAuthor,
  BlogCategory,
  BlogTag,
  BlogComment,
  PostStatus,
  CommentStatus,
  BlogPostFilters,
  CreateBlogPostData,
  UpdateBlogPostData,
  PaginationParams,
  PaginatedResponse,
  BlogError,
} from '../blog'

// Type guard implementations
export const isPostStatus = (value: unknown): value is PostStatus => {
  return typeof value === 'string' && ['draft', 'published', 'archived'].includes(value)
}

export const isCommentStatus = (value: unknown): value is CommentStatus => {
  return typeof value === 'string' && ['pending', 'approved', 'spam', 'deleted'].includes(value)
}

export const isBlogError = (value: unknown): value is BlogError => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as BlogError).code === 'string' &&
    typeof (value as BlogError).message === 'string'
  )
}

export const isPaginationParams = (value: unknown): value is PaginationParams => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  
  return (
    (obj.page === undefined || typeof obj.page === 'number') &&
    (obj.limit === undefined || typeof obj.limit === 'number') &&
    (obj.offset === undefined || typeof obj.offset === 'number')
  )
}

export const isBlogPostFilters = (value: unknown): value is BlogPostFilters => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  
  return (
    (obj.status === undefined || isPostStatus(obj.status)) &&
    (obj.authorId === undefined || typeof obj.authorId === 'string') &&
    (obj.categoryId === undefined || typeof obj.categoryId === 'string') &&
    (obj.categorySlug === undefined || typeof obj.categorySlug === 'string') &&
    (obj.tagId === undefined || typeof obj.tagId === 'string') &&
    (obj.tagSlug === undefined || typeof obj.tagSlug === 'string') &&
    (obj.search === undefined || typeof obj.search === 'string') &&
    (obj.startDate === undefined || typeof obj.startDate === 'string') &&
    (obj.endDate === undefined || typeof obj.endDate === 'string')
  )
}

export const isCreateBlogPostData = (value: unknown): value is CreateBlogPostData => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  
  return (
    typeof obj.title === 'string' &&
    typeof obj.content === 'string' &&
    (obj.subtitle === undefined || typeof obj.subtitle === 'string') &&
    (obj.excerpt === undefined || typeof obj.excerpt === 'string') &&
    (obj.featured_image_url === undefined || typeof obj.featured_image_url === 'string') &&
    (obj.status === undefined || isPostStatus(obj.status)) &&
    (obj.published_at === undefined || typeof obj.published_at === 'string') &&
    (obj.metadata === undefined || typeof obj.metadata === 'object') &&
    (obj.categoryIds === undefined || (Array.isArray(obj.categoryIds) && obj.categoryIds.every(id => typeof id === 'string'))) &&
    (obj.tagIds === undefined || (Array.isArray(obj.tagIds) && obj.tagIds.every(id => typeof id === 'string')))
  )
}

export const isUpdateBlogPostData = (value: unknown): value is UpdateBlogPostData => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  
  // Must have id
  if (typeof obj.id !== 'string') return false
  
  // All other fields are optional but must be valid if present
  return (
    (obj.title === undefined || typeof obj.title === 'string') &&
    (obj.content === undefined || typeof obj.content === 'string') &&
    (obj.subtitle === undefined || typeof obj.subtitle === 'string') &&
    (obj.excerpt === undefined || typeof obj.excerpt === 'string') &&
    (obj.featured_image_url === undefined || typeof obj.featured_image_url === 'string') &&
    (obj.status === undefined || isPostStatus(obj.status)) &&
    (obj.published_at === undefined || typeof obj.published_at === 'string') &&
    (obj.metadata === undefined || typeof obj.metadata === 'object') &&
    (obj.categoryIds === undefined || (Array.isArray(obj.categoryIds) && obj.categoryIds.every(id => typeof id === 'string'))) &&
    (obj.tagIds === undefined || (Array.isArray(obj.tagIds) && obj.tagIds.every(id => typeof id === 'string')))
  )
}

export const isPaginatedResponse = <T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is PaginatedResponse<T> => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  
  return (
    Array.isArray(obj.data) &&
    obj.data.every(item => itemGuard(item)) &&
    typeof obj.meta === 'object' &&
    obj.meta !== null &&
    typeof (obj.meta as Record<string, unknown>).page === 'number' &&
    typeof (obj.meta as Record<string, unknown>).limit === 'number' &&
    typeof (obj.meta as Record<string, unknown>).total === 'number' &&
    typeof (obj.meta as Record<string, unknown>).totalPages === 'number' &&
    typeof (obj.meta as Record<string, unknown>).hasNextPage === 'boolean' &&
    typeof (obj.meta as Record<string, unknown>).hasPreviousPage === 'boolean'
  )
}

// Advanced type guards for nested structures
export const isBlogPost = (value: unknown): value is BlogPost => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.slug === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string' &&
    (obj.author === undefined || isBlogAuthor(obj.author)) &&
    (obj.categories === undefined || (Array.isArray(obj.categories) && obj.categories.every(isBlogCategory))) &&
    (obj.tags === undefined || (Array.isArray(obj.tags) && obj.tags.every(isBlogTag))) &&
    (obj.comments === undefined || (Array.isArray(obj.comments) && obj.comments.every(isBlogComment)))
  )
}

export const isBlogAuthor = (value: unknown): value is BlogAuthor => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.display_name === 'string' &&
    (obj.posts === undefined || Array.isArray(obj.posts)) &&
    (obj.postsCount === undefined || typeof obj.postsCount === 'number')
  )
}

export const isBlogCategory = (value: unknown): value is BlogCategory => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string'
  )
}

export const isBlogTag = (value: unknown): value is BlogTag => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string'
  )
}

export const isBlogComment = (value: unknown): value is BlogComment => {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.post_id === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.created_at === 'string'
  )
}

describe('Blog Type Guards', () => {
  describe('Enum Type Guards', () => {
    it('should correctly identify valid PostStatus', () => {
      expect(isPostStatus('draft')).toBe(true)
      expect(isPostStatus('published')).toBe(true)
      expect(isPostStatus('archived')).toBe(true)
      expect(isPostStatus('invalid')).toBe(false)
      expect(isPostStatus(123)).toBe(false)
      expect(isPostStatus(null)).toBe(false)
      expect(isPostStatus(undefined)).toBe(false)
    })

    it('should correctly identify valid CommentStatus', () => {
      expect(isCommentStatus('pending')).toBe(true)
      expect(isCommentStatus('approved')).toBe(true)
      expect(isCommentStatus('spam')).toBe(true)
      expect(isCommentStatus('deleted')).toBe(true)
      expect(isCommentStatus('invalid')).toBe(false)
      expect(isCommentStatus(123)).toBe(false)
    })
  })

  describe('Error Type Guards', () => {
    it('should correctly identify BlogError', () => {
      expect(isBlogError({ code: 'ERR001', message: 'Error message' })).toBe(true)
      expect(isBlogError({ code: 'ERR001', message: 'Error message', details: { field: 'value' } })).toBe(true)
      expect(isBlogError({ code: 123, message: 'Error' })).toBe(false)
      expect(isBlogError({ message: 'Error' })).toBe(false)
      expect(isBlogError({ code: 'ERR001' })).toBe(false)
      expect(isBlogError(null)).toBe(false)
      expect(isBlogError('error')).toBe(false)
    })
  })

  describe('Pagination Type Guards', () => {
    it('should correctly identify PaginationParams', () => {
      expect(isPaginationParams({})).toBe(true)
      expect(isPaginationParams({ page: 1 })).toBe(true)
      expect(isPaginationParams({ page: 1, limit: 10 })).toBe(true)
      expect(isPaginationParams({ page: 1, limit: 10, offset: 0 })).toBe(true)
      expect(isPaginationParams({ page: '1' })).toBe(false)
      expect(isPaginationParams({ limit: '10' })).toBe(false)
      expect(isPaginationParams(null)).toBe(false)
    })

    it('should correctly identify PaginatedResponse', () => {
      const validResponse = {
        data: [
          { id: '1', name: 'Tag 1', slug: 'tag-1' },
          { id: '2', name: 'Tag 2', slug: 'tag-2' },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }

      expect(isPaginatedResponse(validResponse, isBlogTag)).toBe(true)

      const invalidResponse = {
        data: ['not', 'tags'],
        meta: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }

      expect(isPaginatedResponse(invalidResponse, isBlogTag)).toBe(false)
    })
  })

  describe('Filter Type Guards', () => {
    it('should correctly identify BlogPostFilters', () => {
      expect(isBlogPostFilters({})).toBe(true)
      expect(isBlogPostFilters({ status: 'published' })).toBe(true)
      expect(isBlogPostFilters({ status: 'published', authorId: '123' })).toBe(true)
      expect(isBlogPostFilters({ 
        status: 'published',
        authorId: '123',
        search: 'test',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      })).toBe(true)
      
      expect(isBlogPostFilters({ status: 'invalid' })).toBe(false)
      expect(isBlogPostFilters({ authorId: 123 })).toBe(false)
      expect(isBlogPostFilters(null)).toBe(false)
    })
  })

  describe('Data Type Guards', () => {
    it('should correctly identify CreateBlogPostData', () => {
      const validData: CreateBlogPostData = {
        title: 'Test Post',
        content: 'Test content',
      }
      expect(isCreateBlogPostData(validData)).toBe(true)

      const validDataWithOptionals: CreateBlogPostData = {
        title: 'Test Post',
        content: 'Test content',
        subtitle: 'Subtitle',
        status: 'draft',
        categoryIds: ['123', '456'],
        tagIds: ['789'],
      }
      expect(isCreateBlogPostData(validDataWithOptionals)).toBe(true)

      expect(isCreateBlogPostData({ content: 'Missing title' })).toBe(false)
      expect(isCreateBlogPostData({ title: 'Missing content' })).toBe(false)
      expect(isCreateBlogPostData({ title: 123, content: 'Invalid title type' })).toBe(false)
    })

    it('should correctly identify UpdateBlogPostData', () => {
      const validData: UpdateBlogPostData = {
        id: '123',
        title: 'Updated Title',
      }
      expect(isUpdateBlogPostData(validData)).toBe(true)

      const validDataAllFields: UpdateBlogPostData = {
        id: '123',
        title: 'Updated Title',
        content: 'Updated content',
        status: 'published',
        categoryIds: ['456'],
      }
      expect(isUpdateBlogPostData(validDataAllFields)).toBe(true)

      expect(isUpdateBlogPostData({ title: 'Missing id' })).toBe(false)
      expect(isUpdateBlogPostData({ id: 123, title: 'Invalid id type' })).toBe(false)
    })
  })

  describe('Entity Type Guards', () => {
    it('should correctly identify BlogPost', () => {
      const validPost = {
        id: '123',
        title: 'Test Post',
        slug: 'test-post',
        content: 'Content',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }
      expect(isBlogPost(validPost)).toBe(true)

      const validPostWithRelations = {
        ...validPost,
        author: {
          id: '456',
          user_id: '789',
          display_name: 'Author Name',
        },
        categories: [
          { id: '1', name: 'Category 1', slug: 'category-1' },
        ],
        tags: [
          { id: '2', name: 'Tag 1', slug: 'tag-1' },
        ],
      }
      expect(isBlogPost(validPostWithRelations)).toBe(true)

      expect(isBlogPost({ ...validPost, id: 123 })).toBe(false)
      expect(isBlogPost(null)).toBe(false)
    })

    it('should correctly identify BlogAuthor', () => {
      const validAuthor = {
        id: '123',
        user_id: '456',
        display_name: 'Author Name',
      }
      expect(isBlogAuthor(validAuthor)).toBe(true)

      const validAuthorWithMeta = {
        ...validAuthor,
        postsCount: 10,
        posts: [],
      }
      expect(isBlogAuthor(validAuthorWithMeta)).toBe(true)

      expect(isBlogAuthor({ ...validAuthor, user_id: 123 })).toBe(false)
    })
  })

  describe('Type Narrowing with Guards', () => {
    it('should narrow types correctly in conditional blocks', () => {
      const unknownValue: unknown = { status: 'published' }
      
      if (isBlogPostFilters(unknownValue)) {
        // TypeScript should know this is BlogPostFilters
        expect(unknownValue.status).toBe('published')
      }
    })

    it('should work with array filtering', () => {
      const mixedArray: unknown[] = [
        { id: '1', name: 'Tag 1', slug: 'tag-1' },
        { invalid: 'object' },
        { id: '2', name: 'Tag 2', slug: 'tag-2' },
        null,
        'string',
      ]

      const tags = mixedArray.filter(isBlogTag)
      expect(tags).toHaveLength(2)
      expect(tags[0].name).toBe('Tag 1')
      expect(tags[1].name).toBe('Tag 2')
    })
  })
})