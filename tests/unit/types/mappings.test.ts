import { describe, it, expectTypeOf } from 'vitest'
import type {
  BlogPost,
  BlogPostRow,
  BlogAuthor,
  BlogCategory,
  BlogTag,
  CreateBlogPostData,
  UpdateBlogPostData,
  BlogPostFilters,
  PaginatedResponse,
} from '../blog'

// Type mapping utilities
export type DatabaseToAPI<T extends BlogPostRow> = Omit<T, 'created_at' | 'updated_at'> & {
  createdAt: string
  updatedAt: string
}

export type APIToDatabase<T> = T extends { createdAt: string; updatedAt: string }
  ? Omit<T, 'createdAt' | 'updatedAt'> & {
      created_at: string
      updated_at: string
    }
  : T

export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type PickRequired<T, K extends keyof T> = T & {
  [P in K]-?: T[P]
}

export type MakeOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type MakeRequired<T, K extends keyof T> = T & {
  [P in K]-?: T[P]
}

// Blog-specific type transformations
export type BlogPostForAPI = DatabaseToAPI<BlogPostRow>
export type BlogPostFromAPI = APIToDatabase<BlogPostForAPI>

export type BlogPostWithRelations = BlogPost & {
  author: PickRequired<BlogAuthor, 'id' | 'display_name'>
  categories: PickRequired<BlogCategory, 'id' | 'name' | 'slug'>[]
  tags: PickRequired<BlogTag, 'id' | 'name' | 'slug'>[]
}

export type BlogPostSummary = Pick<BlogPost, 'id' | 'title' | 'slug' | 'excerpt' | 'featured_image_url' | 'published_at'> & {
  author?: Pick<BlogAuthor, 'id' | 'display_name'>
  categoryCount: number
  tagCount: number
  commentCount: number
}

export type BlogPostCreateRequest = CreateBlogPostData & {
  authorId: string
}

export type BlogPostUpdateRequest = UpdateBlogPostData & {
  updatedBy: string
}

// Filter mapping utilities
export type FilterToQuery<T> = {
  [K in keyof T]: T[K] extends string | undefined
    ? string | undefined
    : T[K] extends string[] | undefined
    ? string | undefined  // Convert arrays to comma-separated strings
    : T[K]
}

export type QueryToFilter<T> = {
  [K in keyof T]: T[K] extends string | undefined
    ? T[K] | string[] | undefined  // Allow both string and array forms
    : T[K]
}

// Response transformation types
export type TransformResponse<T> = T extends BlogPost[]
  ? BlogPostSummary[]
  : T extends BlogPost
  ? BlogPostWithRelations
  : T

export type APIResponse<T> = {
  data: T
  success: boolean
  message?: string
  timestamp: string
}

export type ErrorResponse = {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  timestamp: string
}

describe('Blog Type Mappings', () => {
  describe('Database to API Transformations', () => {
    it('should correctly map database row to API format', () => {
      expectTypeOf<BlogPostForAPI>().toHaveProperty('createdAt').toBeString()
      expectTypeOf<BlogPostForAPI>().toHaveProperty('updatedAt').toBeString()
      expectTypeOf<BlogPostForAPI>().not.toHaveProperty('created_at')
      expectTypeOf<BlogPostForAPI>().not.toHaveProperty('updated_at')
    })

    it('should correctly map API format back to database', () => {
      const apiData: BlogPostForAPI = {
        id: '123',
        title: 'Test',
        slug: 'test',
        content: 'Content',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      } as BlogPostForAPI

      type DatabaseFormat = APIToDatabase<typeof apiData>
      expectTypeOf<DatabaseFormat>().toHaveProperty('created_at').toBeString()
      expectTypeOf<DatabaseFormat>().toHaveProperty('updated_at').toBeString()
      
      // Keep variable for type testing purposes
      void apiData
    })
  })

  describe('Utility Type Transformations', () => {
    it('should correctly handle PartialExcept type', () => {
      type TestPartialExcept = PartialExcept<CreateBlogPostData, 'title' | 'content'>
      
      expectTypeOf<TestPartialExcept>().toHaveProperty('title').toBeString()
      expectTypeOf<TestPartialExcept>().toHaveProperty('content').toBeString()
      expectTypeOf<TestPartialExcept>().toHaveProperty('subtitle').toEqualTypeOf<string | undefined>()
    })

    it('should correctly handle DeepPartial type', () => {
      type TestDeepPartial = DeepPartial<BlogPostWithRelations>
      
      expectTypeOf<TestDeepPartial>().toHaveProperty('title').toEqualTypeOf<string | undefined>()
      expectTypeOf<TestDeepPartial>().toHaveProperty('author').toEqualTypeOf<{
        id?: string
        display_name?: string
      } | undefined>()
    })

    it('should correctly handle PickRequired type', () => {
      type TestPickRequired = PickRequired<BlogAuthor, 'id' | 'display_name'>
      
      expectTypeOf<TestPickRequired>().toHaveProperty('id').toBeString()
      expectTypeOf<TestPickRequired>().toHaveProperty('display_name').toBeString()
      expectTypeOf<TestPickRequired>().toHaveProperty('bio').toEqualTypeOf<string | null | undefined>()
    })

    it('should correctly handle MakeOptional type', () => {
      type TestMakeOptional = MakeOptional<CreateBlogPostData, 'title'>
      
      expectTypeOf<TestMakeOptional>().toHaveProperty('title').toEqualTypeOf<string | undefined>()
      expectTypeOf<TestMakeOptional>().toHaveProperty('content').toBeString()
    })

    it('should correctly handle MakeRequired type', () => {
      type TestMakeRequired = MakeRequired<BlogPostFilters, 'status'>
      
      expectTypeOf<TestMakeRequired>().toHaveProperty('status').not.toEqualTypeOf<undefined>()
      expectTypeOf<TestMakeRequired>().toHaveProperty('authorId').toEqualTypeOf<string | undefined>()
    })
  })

  describe('Blog-Specific Type Transformations', () => {
    it('should correctly define BlogPostWithRelations', () => {
      expectTypeOf<BlogPostWithRelations>().toMatchTypeOf<BlogPost>()
      expectTypeOf<BlogPostWithRelations>().toHaveProperty('author').toMatchTypeOf<{
        id: string
        display_name: string
      }>()
      expectTypeOf<BlogPostWithRelations>().toHaveProperty('categories').toEqualTypeOf<{
        id: string
        name: string
        slug: string
      }[]>()
    })

    it('should correctly define BlogPostSummary', () => {
      expectTypeOf<BlogPostSummary>().toHaveProperty('id').toBeString()
      expectTypeOf<BlogPostSummary>().toHaveProperty('title').toBeString()
      expectTypeOf<BlogPostSummary>().toHaveProperty('categoryCount').toBeNumber()
      expectTypeOf<BlogPostSummary>().toHaveProperty('tagCount').toBeNumber()
      expectTypeOf<BlogPostSummary>().toHaveProperty('commentCount').toBeNumber()
      expectTypeOf<BlogPostSummary>().not.toHaveProperty('content')
    })

    it('should correctly extend request types', () => {
      expectTypeOf<BlogPostCreateRequest>().toMatchTypeOf<CreateBlogPostData>()
      expectTypeOf<BlogPostCreateRequest>().toHaveProperty('authorId').toBeString()
      
      expectTypeOf<BlogPostUpdateRequest>().toMatchTypeOf<UpdateBlogPostData>()
      expectTypeOf<BlogPostUpdateRequest>().toHaveProperty('updatedBy').toBeString()
    })
  })

  describe('Filter Transformation Types', () => {
    it('should correctly transform filters to query parameters', () => {
      type TestFilterToQuery = FilterToQuery<BlogPostFilters>
      
      expectTypeOf<TestFilterToQuery>().toHaveProperty('status').toEqualTypeOf<string | undefined>()
      expectTypeOf<TestFilterToQuery>().toHaveProperty('authorId').toEqualTypeOf<string | undefined>()
      expectTypeOf<TestFilterToQuery>().toHaveProperty('search').toEqualTypeOf<string | undefined>()
    })

    it('should correctly transform query parameters back to filters', () => {
      type TestQueryToFilter = QueryToFilter<{
        categoryIds: string | undefined
        tagIds: string | undefined
      }>
      
      expectTypeOf<TestQueryToFilter>().toHaveProperty('categoryIds').toEqualTypeOf<string | string[] | undefined>()
      expectTypeOf<TestQueryToFilter>().toHaveProperty('tagIds').toEqualTypeOf<string | string[] | undefined>()
    })
  })

  describe('Response Transformation Types', () => {
    it('should correctly transform different response types', () => {
      type PostArrayTransform = TransformResponse<BlogPost[]>
      type SinglePostTransform = TransformResponse<BlogPost>
      type StringTransform = TransformResponse<string>
      
      expectTypeOf<PostArrayTransform>().toEqualTypeOf<BlogPostSummary[]>()
      expectTypeOf<SinglePostTransform>().toEqualTypeOf<BlogPostWithRelations>()
      expectTypeOf<StringTransform>().toEqualTypeOf<string>()
    })

    it('should correctly define API response wrapper', () => {
      type TestAPIResponse = APIResponse<BlogPost[]>
      
      expectTypeOf<TestAPIResponse>().toHaveProperty('data').toEqualTypeOf<BlogPost[]>()
      expectTypeOf<TestAPIResponse>().toHaveProperty('success').toEqualTypeOf<boolean>()
      expectTypeOf<TestAPIResponse>().toHaveProperty('message').toEqualTypeOf<string | undefined>()
      expectTypeOf<TestAPIResponse>().toHaveProperty('timestamp').toBeString()
    })

    it('should correctly define error response', () => {
      expectTypeOf<ErrorResponse>().toHaveProperty('success').toEqualTypeOf<false>()
      expectTypeOf<ErrorResponse>().toHaveProperty('error').toMatchTypeOf<{
        code: string
        message: string
        details?: Record<string, unknown>
      }>()
    })
  })

  describe('Complex Type Compositions', () => {
    it('should handle nested transformations', () => {
      type ComplexType = DeepPartial<BlogPostWithRelations> & {
        metadata: PickRequired<BlogPost, 'id' | 'title'>
      }
      
      expectTypeOf<ComplexType>().toHaveProperty('metadata').toMatchTypeOf<{
        id: string
        title: string
      }>()
      expectTypeOf<ComplexType>().toHaveProperty('author').toEqualTypeOf<{
        id?: string
        display_name?: string
      } | undefined>()
    })

    it('should handle conditional type mapping', () => {
      type ConditionalType<T> = T extends { id: string }
        ? T & { hasId: true }
        : T & { hasId: false }
      
      type WithId = ConditionalType<BlogPost>
      type WithoutId = ConditionalType<{ name: string }>
      
      expectTypeOf<WithId>().toHaveProperty('hasId').toEqualTypeOf<true>()
      expectTypeOf<WithoutId>().toHaveProperty('hasId').toEqualTypeOf<false>()
    })
  })

  describe('Real-world Usage Scenarios', () => {
    it('should support API endpoint parameter types', () => {
      type GetPostsEndpoint = {
        query: FilterToQuery<BlogPostFilters & { page?: number; limit?: number }>
        response: APIResponse<PaginatedResponse<BlogPostSummary>>
      }
      
      expectTypeOf<GetPostsEndpoint['query']>().toHaveProperty('page').toEqualTypeOf<number | undefined>()
      expectTypeOf<GetPostsEndpoint['response']['data']['data']>().toEqualTypeOf<BlogPostSummary[]>()
    })

    it('should support form data transformations', () => {
      type FormData = MakeOptional<CreateBlogPostData, 'status' | 'published_at'> & {
        isDraft: boolean
        publishNow: boolean
      }
      
      type ProcessedFormData = Omit<FormData, 'isDraft' | 'publishNow'> & {
        status: 'draft' | 'published'
        published_at?: string
      }
      
      expectTypeOf<FormData>().toHaveProperty('isDraft').toBeBoolean()
      expectTypeOf<ProcessedFormData>().toHaveProperty('status').not.toEqualTypeOf<undefined>()
    })
  })

  describe('Type Safety Verification', () => {
    it('should prevent invalid property access', () => {
      type SafePost = Pick<BlogPost, 'id' | 'title' | 'slug'>
      
      // This should compile
      const validAccess = (post: SafePost) => post.title
      
      // These should cause TypeScript errors
      // @ts-expect-error - Testing that content property is not accessible on SafePost type
      const invalidAccess1 = (post: SafePost) => post.content
      // @ts-expect-error - Testing that author property is not accessible on SafePost type
      const invalidAccess2 = (post: SafePost) => post.author
      
      // Keep variables for type testing purposes
      void validAccess
      void invalidAccess1
      void invalidAccess2
    })

    it('should enforce required fields in transformations', () => {
      type RequiredFields = PickRequired<BlogAuthor, 'id' | 'display_name'>
      
      // This should be valid
      const validAuthor: RequiredFields = {
        id: '123',
        display_name: 'Author',
      } as RequiredFields
      
      // This should cause TypeScript error
      // @ts-expect-error - Testing that missing required field display_name causes TypeScript error
      const invalidAuthor: RequiredFields = {
        id: '123',
        // missing display_name
      }
      
      // Keep variables for type testing purposes
      void validAuthor
      void invalidAuthor
    })
  })
})