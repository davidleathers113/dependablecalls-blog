import { describe, expect, it, expectTypeOf } from 'vitest'
import {
  POST_STATUS_LABELS,
  COMMENT_STATUS_LABELS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../../src/types/blog'
import type {
  BlogPost,
  BlogAuthor,
  BlogCategory,
  BlogTag,
  BlogComment,
  BlogPostRow,
  BlogPostInsert,
  BlogPostUpdate,
  PostStatus,
  CommentStatus,
  PaginationParams,
  PaginationMeta,
  PaginatedResponse,
  BlogPostFilters,
  BlogPostSortBy,
  SortOrder,
  BlogPostSort,
  GetBlogPostsParams,
  CreateBlogPostData,
  UpdateBlogPostData,
  GetCommentsParams,
  CreateCommentData,
  ModerateCommentData,
  BlogStatistics,
  BlogSEOMetadata,
  AuthorSocialLinks,
  BlogPostResponse,
  AuthorProfileResponse,
} from '../../../src/types/blog'

describe('Blog Type Definitions', () => {
  describe('Database Row Types', () => {
    it('should have correct BlogPostRow type structure', () => {
      expectTypeOf<BlogPostRow>().toHaveProperty('id').toBeString()
      expectTypeOf<BlogPostRow>().toHaveProperty('title').toBeString()
      expectTypeOf<BlogPostRow>().toHaveProperty('slug').toBeString()
      expectTypeOf<BlogPostRow>().toHaveProperty('content').toBeString()
      expectTypeOf<BlogPostRow>().toHaveProperty('created_at').toEqualTypeOf<string>()
      expectTypeOf<BlogPostRow>().toHaveProperty('updated_at').toEqualTypeOf<string>()
    })

    it('should have correct optional fields in BlogPostRow', () => {
      expectTypeOf<BlogPostRow>().toHaveProperty('subtitle').toEqualTypeOf<string | null>()
      expectTypeOf<BlogPostRow>().toHaveProperty('excerpt').toEqualTypeOf<string | null>()
      expectTypeOf<BlogPostRow>().toHaveProperty('featured_image_url').toEqualTypeOf<string | null>()
      expectTypeOf<BlogPostRow>().toHaveProperty('published_at').toEqualTypeOf<string | null>()
    })

    it('should have correct BlogPostInsert type', () => {
      expectTypeOf<BlogPostInsert>().toBeObject()
      expectTypeOf<BlogPostInsert>().toHaveProperty('title')
      
      // Insert should allow partial fields
      const validInsert: BlogPostInsert = {
        title: 'Test',
        slug: 'test',
        content: 'Content',
      }
      expect(validInsert).toBeDefined()
    })

    it('should have correct BlogPostUpdate type', () => {
      expectTypeOf<BlogPostUpdate>().toBeObject()
      
      // Update should allow partial fields
      const validUpdate: BlogPostUpdate = {
        title: 'Updated Title',
      }
      expect(validUpdate).toBeDefined()
    })
  })

  describe('Enum Types', () => {
    it('should have correct PostStatus values', () => {
      const statuses: PostStatus[] = ['draft', 'published', 'archived']
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      statuses.forEach(status => {
        expectTypeOf<PostStatus>().toMatchTypeOf<typeof status>()
      })
    })

    it('should have correct CommentStatus values', () => {
      const statuses: CommentStatus[] = ['pending', 'approved', 'spam', 'deleted']
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      statuses.forEach(status => {
        expectTypeOf<CommentStatus>().toMatchTypeOf<typeof status>()
      })
    })

    it('should not allow invalid status values', () => {
      // @ts-expect-error - Invalid status
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const invalidPostStatus: PostStatus = 'invalid'
      // @ts-expect-error - Invalid status
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const invalidCommentStatus: CommentStatus = 'invalid'
    })
  })

  describe('Extended Types with Relations', () => {
    it('should have correct BlogPost type with relations', () => {
      expectTypeOf<BlogPost>().toMatchTypeOf<BlogPostRow>()
      expectTypeOf<BlogPost>().toHaveProperty('author').toEqualTypeOf<BlogAuthor | undefined>()
      expectTypeOf<BlogPost>().toHaveProperty('categories').toEqualTypeOf<BlogCategory[] | undefined>()
      expectTypeOf<BlogPost>().toHaveProperty('tags').toEqualTypeOf<BlogTag[] | undefined>()
      expectTypeOf<BlogPost>().toHaveProperty('comments').toEqualTypeOf<BlogComment[] | undefined>()
    })

    it('should have correct BlogAuthor type with relations', () => {
      expectTypeOf<BlogAuthor>().toHaveProperty('posts').toEqualTypeOf<BlogPost[] | undefined>()
      expectTypeOf<BlogAuthor>().toHaveProperty('postsCount').toEqualTypeOf<number | undefined>()
      expectTypeOf<BlogAuthor>().toHaveProperty('user').toMatchTypeOf<{
        id: string
        email: string
        username?: string
      } | undefined>()
    })

    it('should have correct BlogCategory type with hierarchy', () => {
      expectTypeOf<BlogCategory>().toHaveProperty('parent').toEqualTypeOf<BlogCategory | undefined>()
      expectTypeOf<BlogCategory>().toHaveProperty('children').toEqualTypeOf<BlogCategory[] | undefined>()
      expectTypeOf<BlogCategory>().toHaveProperty('postsCount').toEqualTypeOf<number | undefined>()
    })

    it('should have correct BlogComment type with threading', () => {
      expectTypeOf<BlogComment>().toHaveProperty('parent').toEqualTypeOf<BlogComment | undefined>()
      expectTypeOf<BlogComment>().toHaveProperty('replies').toEqualTypeOf<BlogComment[] | undefined>()
      expectTypeOf<BlogComment>().toHaveProperty('user').toMatchTypeOf<{
        id: string
        email: string
        username?: string
        avatar_url?: string
      } | undefined>()
    })
  })

  describe('Pagination Types', () => {
    it('should have correct PaginationParams structure', () => {
      expectTypeOf<PaginationParams>().toHaveProperty('page').toEqualTypeOf<number | undefined>()
      expectTypeOf<PaginationParams>().toHaveProperty('limit').toEqualTypeOf<number | undefined>()
      expectTypeOf<PaginationParams>().toHaveProperty('offset').toEqualTypeOf<number | undefined>()
    })

    it('should have correct PaginationMeta structure', () => {
      expectTypeOf<PaginationMeta>().toHaveProperty('page').toBeNumber()
      expectTypeOf<PaginationMeta>().toHaveProperty('limit').toBeNumber()
      expectTypeOf<PaginationMeta>().toHaveProperty('total').toBeNumber()
      expectTypeOf<PaginationMeta>().toHaveProperty('totalPages').toBeNumber()
      expectTypeOf<PaginationMeta>().toHaveProperty('hasNextPage').toBeBoolean()
      expectTypeOf<PaginationMeta>().toHaveProperty('hasPreviousPage').toBeBoolean()
    })

    it('should have correct generic PaginatedResponse', () => {
      type TestPaginatedPosts = PaginatedResponse<BlogPost>
      expectTypeOf<TestPaginatedPosts>().toHaveProperty('data').toEqualTypeOf<BlogPost[]>()
      expectTypeOf<TestPaginatedPosts>().toHaveProperty('meta').toEqualTypeOf<PaginationMeta>()
    })
  })

  describe('Filter and Sort Types', () => {
    it('should have correct BlogPostFilters structure', () => {
      expectTypeOf<BlogPostFilters>().toHaveProperty('status').toEqualTypeOf<PostStatus | undefined>()
      expectTypeOf<BlogPostFilters>().toHaveProperty('authorId').toEqualTypeOf<string | undefined>()
      expectTypeOf<BlogPostFilters>().toHaveProperty('categoryId').toEqualTypeOf<string | undefined>()
      expectTypeOf<BlogPostFilters>().toHaveProperty('search').toEqualTypeOf<string | undefined>()
      expectTypeOf<BlogPostFilters>().toHaveProperty('startDate').toEqualTypeOf<string | undefined>()
      expectTypeOf<BlogPostFilters>().toHaveProperty('endDate').toEqualTypeOf<string | undefined>()
    })

    it('should have correct BlogPostSortBy values', () => {
      const sortOptions: BlogPostSortBy[] = [
        'published_at',
        'created_at',
        'updated_at',
        'title',
        'view_count',
      ]
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      sortOptions.forEach(option => {
        expectTypeOf<BlogPostSortBy>().toMatchTypeOf<typeof option>()
      })
    })

    it('should have correct SortOrder values', () => {
      const orders: SortOrder[] = ['asc', 'desc']
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      orders.forEach(order => {
        expectTypeOf<SortOrder>().toMatchTypeOf<typeof order>()
      })
    })
  })

  describe('Request Types', () => {
    it('should have correct GetBlogPostsParams structure', () => {
      expectTypeOf<GetBlogPostsParams>().toMatchTypeOf<PaginationParams>()
      expectTypeOf<GetBlogPostsParams>().toHaveProperty('filters').toEqualTypeOf<BlogPostFilters | undefined>()
      expectTypeOf<GetBlogPostsParams>().toHaveProperty('sort').toEqualTypeOf<BlogPostSort | undefined>()
      expectTypeOf<GetBlogPostsParams>().toHaveProperty('includeAuthor').toEqualTypeOf<boolean | undefined>()
      expectTypeOf<GetBlogPostsParams>().toHaveProperty('includeCategories').toEqualTypeOf<boolean | undefined>()
      expectTypeOf<GetBlogPostsParams>().toHaveProperty('includeTags').toEqualTypeOf<boolean | undefined>()
    })

    it('should have correct CreateBlogPostData structure', () => {
      expectTypeOf<CreateBlogPostData>().toHaveProperty('title').toBeString()
      expectTypeOf<CreateBlogPostData>().toHaveProperty('content').toBeString()
      expectTypeOf<CreateBlogPostData>().toHaveProperty('status').toEqualTypeOf<PostStatus | undefined>()
      expectTypeOf<CreateBlogPostData>().toHaveProperty('categoryIds').toEqualTypeOf<string[] | undefined>()
      expectTypeOf<CreateBlogPostData>().toHaveProperty('tagIds').toEqualTypeOf<string[] | undefined>()
      expectTypeOf<CreateBlogPostData>().toHaveProperty('metadata').toEqualTypeOf<Record<string, unknown> | undefined>()
    })

    it('should have correct UpdateBlogPostData structure', () => {
      expectTypeOf<UpdateBlogPostData>().toHaveProperty('id').toBeString()
      expectTypeOf<UpdateBlogPostData>().toMatchTypeOf<Partial<CreateBlogPostData>>()
    })
  })

  describe('Comment Types', () => {
    it('should have correct GetCommentsParams structure', () => {
      expectTypeOf<GetCommentsParams>().toMatchTypeOf<PaginationParams>()
      expectTypeOf<GetCommentsParams>().toHaveProperty('postId').toEqualTypeOf<string | undefined>()
      expectTypeOf<GetCommentsParams>().toHaveProperty('userId').toEqualTypeOf<string | undefined>()
      expectTypeOf<GetCommentsParams>().toHaveProperty('status').toEqualTypeOf<CommentStatus | undefined>()
      expectTypeOf<GetCommentsParams>().toHaveProperty('parentId').toEqualTypeOf<string | null | undefined>()
    })

    it('should have correct CreateCommentData structure', () => {
      expectTypeOf<CreateCommentData>().toHaveProperty('post_id').toBeString()
      expectTypeOf<CreateCommentData>().toHaveProperty('content').toBeString()
      expectTypeOf<CreateCommentData>().toHaveProperty('parent_id').toEqualTypeOf<string | undefined>()
    })

    it('should have correct ModerateCommentData structure', () => {
      expectTypeOf<ModerateCommentData>().toHaveProperty('id').toBeString()
      expectTypeOf<ModerateCommentData>().toHaveProperty('status').toEqualTypeOf<CommentStatus>()
    })
  })

  describe('SEO and Metadata Types', () => {
    it('should have correct BlogSEOMetadata structure', () => {
      expectTypeOf<BlogSEOMetadata>().toHaveProperty('title').toEqualTypeOf<string | undefined>()
      expectTypeOf<BlogSEOMetadata>().toHaveProperty('description').toEqualTypeOf<string | undefined>()
      expectTypeOf<BlogSEOMetadata>().toHaveProperty('keywords').toEqualTypeOf<string[] | undefined>()
      expectTypeOf<BlogSEOMetadata>().toHaveProperty('ogImage').toEqualTypeOf<string | undefined>()
      expectTypeOf<BlogSEOMetadata>().toHaveProperty('noIndex').toEqualTypeOf<boolean | undefined>()
      expectTypeOf<BlogSEOMetadata>().toHaveProperty('noFollow').toEqualTypeOf<boolean | undefined>()
    })

    it('should have correct AuthorSocialLinks structure', () => {
      expectTypeOf<AuthorSocialLinks>().toHaveProperty('twitter').toEqualTypeOf<string | undefined>()
      expectTypeOf<AuthorSocialLinks>().toHaveProperty('linkedin').toEqualTypeOf<string | undefined>()
      expectTypeOf<AuthorSocialLinks>().toHaveProperty('github').toEqualTypeOf<string | undefined>()
      expectTypeOf<AuthorSocialLinks>().toHaveProperty('website').toEqualTypeOf<string | undefined>()
    })
  })

  describe('Response Types', () => {
    it('should have correct BlogPostResponse structure', () => {
      expectTypeOf<BlogPostResponse>().toHaveProperty('post').toEqualTypeOf<BlogPost>()
      expectTypeOf<BlogPostResponse>().toHaveProperty('relatedPosts').toEqualTypeOf<BlogPost[] | undefined>()
    })

    it('should have correct AuthorProfileResponse structure', () => {
      expectTypeOf<AuthorProfileResponse>().toHaveProperty('author').toEqualTypeOf<BlogAuthor>()
      expectTypeOf<AuthorProfileResponse>().toHaveProperty('statistics').toEqualTypeOf<BlogStatistics>()
      expectTypeOf<AuthorProfileResponse>().toHaveProperty('recentPosts').toEqualTypeOf<BlogPost[]>()
    })
  })

  describe('Constants', () => {
    it('should have correct POST_STATUS_LABELS', () => {
      expect(POST_STATUS_LABELS).toEqual({
        draft: 'Draft',
        published: 'Published',
        archived: 'Archived',
      })
      expectTypeOf(POST_STATUS_LABELS).toEqualTypeOf<Record<PostStatus, string>>()
    })

    it('should have correct COMMENT_STATUS_LABELS', () => {
      expect(COMMENT_STATUS_LABELS).toEqual({
        pending: 'Pending',
        approved: 'Approved',
        spam: 'Spam',
        deleted: 'Deleted',
      })
      expectTypeOf(COMMENT_STATUS_LABELS).toEqualTypeOf<Record<CommentStatus, string>>()
    })

    it('should have correct pagination constants', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(10)
      expect(MAX_PAGE_SIZE).toBe(100)
      expectTypeOf(DEFAULT_PAGE_SIZE).toBeNumber()
      expectTypeOf(MAX_PAGE_SIZE).toBeNumber()
    })
  })

  describe('Type Narrowing and Guards', () => {
    it('should allow type narrowing for PostStatus', () => {
      const checkStatus = (status: PostStatus) => {
        switch (status) {
          case 'draft':
            expectTypeOf(status).toEqualTypeOf<'draft'>()
            break
          case 'published':
            expectTypeOf(status).toEqualTypeOf<'published'>()
            break
          case 'archived':
            expectTypeOf(status).toEqualTypeOf<'archived'>()
            break
          default: {
            // This should never happen - exhaustiveness check
            const _exhaustive: never = status
            void _exhaustive
          }
        }
      }
      
      // Test the function with actual data
      checkStatus('draft')
      checkStatus('published')
      checkStatus('archived')
    })

    it('should allow discriminated unions with metadata', () => {
      type PostWithStatus = 
        | { status: 'draft'; published_at: null }
        | { status: 'published'; published_at: string }
        | { status: 'archived'; published_at: string; archived_at: string }

      const checkPost = (post: PostWithStatus) => {
        if (post.status === 'draft') {
          expectTypeOf(post.published_at).toEqualTypeOf<null>()
        } else if (post.status === 'published') {
          expectTypeOf(post.published_at).toEqualTypeOf<string>()
        } else {
          expectTypeOf(post.published_at).toEqualTypeOf<string>()
          expectTypeOf(post).toHaveProperty('archived_at').toBeString()
        }
      }
      
      // Test the function with actual data
      checkPost({ status: 'draft', published_at: null })
      checkPost({ status: 'published', published_at: '2024-01-01' })
      checkPost({ status: 'archived', published_at: '2024-01-01', archived_at: '2024-01-02' })
    })
  })
})