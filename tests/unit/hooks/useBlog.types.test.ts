import { describe, it, expectTypeOf } from 'vitest'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import {
  useBlogPosts,
  useBlogPost,
  useSearchBlogPosts,
  useSimilarPosts,
  useCreatePost,
  useUpdatePost,
  useDeletePost,
  useBlogCategories,
  useBlogCategory,
  useBlogTags,
  useBlogTag,
  usePopularTags,
  useAuthorProfile,
  useUpdateAuthorProfile,
  useComments,
  useCreateComment,
  useModerateComment,
  useBlogStatistics,
  usePrefetchBlogPost,
  useOptimisticPost,
  blogQueryKeys,
} from '../useBlog'
import type {
  BlogPost,
  BlogAuthor,
  BlogCategory,
  BlogTag,
  BlogComment,
  PaginatedResponse,
  CreateBlogPostData,
  UpdateBlogPostData,
  CreateCommentData,
  ModerateCommentData,
  GetBlogPostsParams,
  GetBlogPostParams,
  BlogStatistics,
  PopularTag,
  AuthorProfileResponse,
  BlogPostResponse,
  BlogAuthorUpdate,
} from '../../types/blog'

describe('Blog Hook Type Inference', () => {
  describe('Query Hook Return Types', () => {
    it('should correctly infer useBlogPosts return type', () => {
      const result = useBlogPosts()
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<PaginatedResponse<BlogPost>, Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<PaginatedResponse<BlogPost> | undefined>()
      expectTypeOf(result.error).toEqualTypeOf<Error | null>()
      expectTypeOf(result.isLoading).toBeBoolean()
      expectTypeOf(result.isSuccess).toBeBoolean()
      expectTypeOf(result.isError).toBeBoolean()
    })

    it('should correctly infer useBlogPost return type', () => {
      const result = useBlogPost({ slug: 'test' })
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<BlogPostResponse, Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<BlogPostResponse | undefined>()
      if (result.data) {
        expectTypeOf(result.data.post).toEqualTypeOf<BlogPost>()
        expectTypeOf(result.data.relatedPosts).toEqualTypeOf<BlogPost[] | undefined>()
      }
    })

    it('should correctly infer useSearchBlogPosts return type', () => {
      const result = useSearchBlogPosts('query')
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<BlogPost[], Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<BlogPost[] | undefined>()
    })

    it('should correctly infer useSimilarPosts return type', () => {
      const result = useSimilarPosts('post-id')
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<BlogPost[], Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<BlogPost[] | undefined>()
    })

    it('should correctly infer useBlogCategories return type', () => {
      const result = useBlogCategories()
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<BlogCategory[], Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<BlogCategory[] | undefined>()
    })

    it('should correctly infer useBlogCategory return type', () => {
      const result = useBlogCategory('category-slug')
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<BlogCategory, Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<BlogCategory | undefined>()
    })

    it('should correctly infer useBlogTags return type', () => {
      const result = useBlogTags()
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<BlogTag[], Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<BlogTag[] | undefined>()
    })

    it('should correctly infer useBlogTag return type', () => {
      const result = useBlogTag('tag-slug')
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<BlogTag, Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<BlogTag | undefined>()
    })

    it('should correctly infer usePopularTags return type', () => {
      const result = usePopularTags()
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<PopularTag[], Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<PopularTag[] | undefined>()
    })

    it('should correctly infer useAuthorProfile return type', () => {
      const result = useAuthorProfile('user-id')
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<AuthorProfileResponse, Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<AuthorProfileResponse | undefined>()
      if (result.data) {
        expectTypeOf(result.data.author).toEqualTypeOf<BlogAuthor>()
        expectTypeOf(result.data.statistics).toEqualTypeOf<BlogStatistics>()
        expectTypeOf(result.data.recentPosts).toEqualTypeOf<BlogPost[]>()
      }
    })

    it('should correctly infer useComments return type', () => {
      const result = useComments({ postId: 'post-id' })
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<PaginatedResponse<BlogComment>, Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<PaginatedResponse<BlogComment> | undefined>()
    })

    it('should correctly infer useBlogStatistics return type', () => {
      const result = useBlogStatistics()
      
      expectTypeOf(result).toEqualTypeOf<
        UseQueryResult<BlogStatistics, Error>
      >()
      
      expectTypeOf(result.data).toEqualTypeOf<BlogStatistics | undefined>()
    })
  })

  describe('Mutation Hook Return Types', () => {
    it('should correctly infer useCreatePost return type', () => {
      const result = useCreatePost()
      
      expectTypeOf(result).toEqualTypeOf<
        UseMutationResult<BlogPost, Error, CreateBlogPostData, unknown>
      >()
      
      expectTypeOf(result.mutate).toEqualTypeOf<
        (variables: CreateBlogPostData, options?: unknown) => void
      >()
      expectTypeOf(result.mutateAsync).toEqualTypeOf<
        (variables: CreateBlogPostData, options?: unknown) => Promise<BlogPost>
      >()
    })

    it('should correctly infer useUpdatePost return type', () => {
      const result = useUpdatePost()
      
      expectTypeOf(result).toEqualTypeOf<
        UseMutationResult<BlogPost, Error, UpdateBlogPostData, unknown>
      >()
      
      expectTypeOf(result.mutate).toEqualTypeOf<
        (variables: UpdateBlogPostData, options?: unknown) => void
      >()
    })

    it('should correctly infer useDeletePost return type', () => {
      const result = useDeletePost()
      
      expectTypeOf(result).toEqualTypeOf<
        UseMutationResult<void, Error, string, unknown>
      >()
      
      expectTypeOf(result.mutate).toEqualTypeOf<
        (variables: string, options?: unknown) => void
      >()
    })

    it('should correctly infer useUpdateAuthorProfile return type', () => {
      const result = useUpdateAuthorProfile()
      
      expectTypeOf(result).toEqualTypeOf<
        UseMutationResult<
          BlogAuthor, 
          Error, 
          { userId: string; updates: Partial<BlogAuthorUpdate> }, 
          unknown
        >
      >()
      
      expectTypeOf(result.mutate).toEqualTypeOf<
        (variables: { userId: string; updates: Partial<BlogAuthorUpdate> }, options?: unknown) => void
      >()
    })

    it('should correctly infer useCreateComment return type', () => {
      const result = useCreateComment()
      
      expectTypeOf(result).toEqualTypeOf<
        UseMutationResult<BlogComment, Error, CreateCommentData, unknown>
      >()
      
      expectTypeOf(result.mutate).toEqualTypeOf<
        (variables: CreateCommentData, options?: unknown) => void
      >()
    })

    it('should correctly infer useModerateComment return type', () => {
      const result = useModerateComment()
      
      expectTypeOf(result).toEqualTypeOf<
        UseMutationResult<BlogComment, Error, ModerateCommentData, unknown>
      >()
      
      expectTypeOf(result.mutate).toEqualTypeOf<
        (variables: ModerateCommentData, options?: unknown) => void
      >()
    })
  })

  describe('Parameter Type Safety', () => {
    it('should enforce correct parameter types for useBlogPosts', () => {
      // Valid parameters
      const validParams: GetBlogPostsParams = {
        page: 1,
        limit: 10,
        filters: { status: 'published' },
        includeAuthor: true,
      }
      useBlogPosts(validParams)
      
      // Empty parameters should work
      useBlogPosts()
      useBlogPosts({})
      
      // Type errors should be caught
      // @ts-expect-error - Testing invalid parameter detection
      useBlogPosts({ invalid: 'param' })
      // @ts-expect-error - Testing page type validation
      useBlogPosts({ page: 'not-a-number' })
    })

    it('should enforce correct parameter types for useBlogPost', () => {
      // Valid parameters
      const validParams: GetBlogPostParams = {
        slug: 'my-post',
        includeAuthor: true,
        includeCategories: true,
      }
      useBlogPost(validParams)
      
      // Type errors should be caught
      // @ts-expect-error - Testing slug requirement validation
      useBlogPost({})
      // @ts-expect-error - Testing slug type validation
      useBlogPost({ slug: 123 })
    })

    it('should enforce correct parameter types for mutation functions', () => {
      const createPost = useCreatePost()
      const updatePost = useUpdatePost()
      const deletePost = useDeletePost()
      
      // Valid mutation calls
      createPost.mutate({
        title: 'Test Post',
        content: 'Content',
        status: 'draft',
      })
      
      updatePost.mutate({
        id: '123',
        title: 'Updated Title',
      })
      
      deletePost.mutate('post-id')
      
      // Type errors should be caught
      // @ts-expect-error - Testing required content field validation
      createPost.mutate({ title: 'Missing content' })
      // @ts-expect-error - Testing required id field validation  
      updatePost.mutate({ title: 'Missing id' })
      // @ts-expect-error - Testing string parameter validation
      deletePost.mutate(123)
    })
  })

  describe('Query Key Type Safety', () => {
    it('should have correctly typed query keys', () => {
      expectTypeOf(blogQueryKeys.all).toEqualTypeOf<readonly ['blog']>()
      expectTypeOf(blogQueryKeys.posts.all).toEqualTypeOf<readonly ['blog', 'posts']>()
      expectTypeOf(blogQueryKeys.posts.lists()).toEqualTypeOf<readonly ['blog', 'posts', 'list']>()
      
      // Test parameterized query keys
      const listKey = blogQueryKeys.posts.list({ page: 1 })
      expectTypeOf(listKey).toEqualTypeOf<
        readonly ['blog', 'posts', 'list', GetBlogPostsParams]
      >()
      
      const detailKey = blogQueryKeys.posts.detail('my-slug')
      expectTypeOf(detailKey).toEqualTypeOf<
        readonly ['blog', 'posts', 'detail', string]
      >()
    })

    it('should enforce parameter types in query key functions', () => {
      // Valid calls
      blogQueryKeys.posts.list({ page: 1, limit: 10 })
      blogQueryKeys.posts.detail('valid-slug')
      blogQueryKeys.categories.detail('category-slug')
      blogQueryKeys.comments.list({ postId: 'post-id' })
      
      // Type errors should be caught
      // @ts-expect-error - Testing slug string type validation
      blogQueryKeys.posts.detail(123)
      // @ts-expect-error - Testing page number type validation
      blogQueryKeys.posts.list({ page: 'not-a-number' })
    })
  })

  describe('Utility Hook Type Safety', () => {
    it('should correctly type usePrefetchBlogPost', () => {
      const prefetchPost = usePrefetchBlogPost()
      
      expectTypeOf(prefetchPost).toEqualTypeOf<
        (params: GetBlogPostParams) => Promise<void>
      >()
      
      // Valid usage
      prefetchPost({ slug: 'my-post' })
      
      // Type errors should be caught
      // @ts-expect-error - Testing slug requirement validation
      prefetchPost({})
      // @ts-expect-error - Testing slug type validation
      prefetchPost({ slug: 123 })
    })

    it('should correctly type useOptimisticPost', () => {
      const { optimisticCreate, optimisticUpdate } = useOptimisticPost()
      
      expectTypeOf(optimisticCreate).toEqualTypeOf<
        (data: CreateBlogPostData) => void
      >()
      
      expectTypeOf(optimisticUpdate).toEqualTypeOf<
        (data: UpdateBlogPostData) => void
      >()
      
      // Valid usage
      optimisticCreate({
        title: 'Test',
        content: 'Content',
      })
      
      optimisticUpdate({
        id: '123',
        title: 'Updated',
      })
      
      // Type errors should be caught
      // @ts-expect-error - Testing required content field validation
      optimisticCreate({ title: 'Missing content' })
      // @ts-expect-error - Testing required id field validation
      optimisticUpdate({ title: 'Missing id' })
    })
  })

  describe('Complex Type Scenarios', () => {
    it('should handle conditional types in hook parameters', () => {
      // useBlogStatistics can be called with or without authorId
      const globalStats = useBlogStatistics()
      const authorStats = useBlogStatistics('author-id')
      
      expectTypeOf(globalStats).toEqualTypeOf<
        UseQueryResult<BlogStatistics, Error>
      >()
      expectTypeOf(authorStats).toEqualTypeOf<
        UseQueryResult<BlogStatistics, Error>
      >()
    })

    it('should handle generic type inference in paginated responses', () => {
      const postsResult = useBlogPosts()
      const commentsResult = useComments({ postId: 'post-id' })
      
      if (postsResult.data) {
        expectTypeOf(postsResult.data.data).toEqualTypeOf<BlogPost[]>()
        expectTypeOf(postsResult.data.meta.total).toBeNumber()
      }
      
      if (commentsResult.data) {
        expectTypeOf(commentsResult.data.data).toEqualTypeOf<BlogComment[]>()
        expectTypeOf(commentsResult.data.meta.hasNextPage).toBeBoolean()
      }
    })

    it('should handle union types in hook responses', () => {
      const result = useBlogPost({ slug: 'test' })
      
      // Before type narrowing
      expectTypeOf(result.data).toEqualTypeOf<BlogPostResponse | undefined>()
      
      // After type narrowing
      if (result.data) {
        expectTypeOf(result.data.post).toEqualTypeOf<BlogPost>()
        expectTypeOf(result.data.relatedPosts).toEqualTypeOf<BlogPost[] | undefined>()
      }
    })
  })

  describe('Error Type Handling', () => {
    it('should consistently use Error type for all hooks', () => {
      const queryResult = useBlogPosts()
      const mutationResult = useCreatePost()
      
      expectTypeOf(queryResult.error).toEqualTypeOf<Error | null>()
      expectTypeOf(mutationResult.error).toEqualTypeOf<Error | null>()
    })

    it('should handle error states properly in mutations', () => {
      const createPost = useCreatePost()
      
      if (createPost.isError && createPost.error) {
        expectTypeOf(createPost.error).toEqualTypeOf<Error>()
        expectTypeOf(createPost.error.message).toBeString()
      }
    })
  })

  describe('React Query Integration Types', () => {
    it('should properly extend UseQueryResult interface', () => {
      const result = useBlogPosts()
      
      // Standard UseQueryResult properties
      expectTypeOf(result.data).toEqualTypeOf<PaginatedResponse<BlogPost> | undefined>()
      expectTypeOf(result.error).toEqualTypeOf<Error | null>()
      expectTypeOf(result.isLoading).toBeBoolean()
      expectTypeOf(result.isFetching).toBeBoolean()
      expectTypeOf(result.isSuccess).toBeBoolean()
      expectTypeOf(result.isError).toBeBoolean()
      expectTypeOf(result.refetch).toBeFunction()
      
      // Additional React Query properties should be available
      expectTypeOf(result.status).toEqualTypeOf<'pending' | 'error' | 'success'>()
      expectTypeOf(result.fetchStatus).toEqualTypeOf<'fetching' | 'paused' | 'idle'>()
    })

    it('should properly extend UseMutationResult interface', () => {
      const result = useCreatePost()
      
      // Standard UseMutationResult properties
      expectTypeOf(result.mutate).toBeFunction()
      expectTypeOf(result.mutateAsync).toBeFunction()
      expectTypeOf(result.data).toEqualTypeOf<BlogPost | undefined>()
      expectTypeOf(result.error).toEqualTypeOf<Error | null>()
      expectTypeOf(result.isIdle).toBeBoolean()
      expectTypeOf(result.isPending).toBeBoolean()
      expectTypeOf(result.isSuccess).toBeBoolean()
      expectTypeOf(result.isError).toBeBoolean()
      expectTypeOf(result.reset).toBeFunction()
      
      // Mutation-specific properties
      expectTypeOf(result.variables).toEqualTypeOf<CreateBlogPostData | undefined>()
      expectTypeOf(result.context).toEqualTypeOf<unknown>()
    })
  })
})