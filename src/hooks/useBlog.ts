import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PostService, TaxonomyService, CommentService, AuthorService, AnalyticsService } from '../services/blog'
import type {
  GetBlogPostsParams,
  GetBlogPostParams,
  CreateBlogPostData,
  UpdateBlogPostData,
  CreateCommentData,
  ModerateCommentData,
  GetCommentsParams,
  BlogAuthorUpdate,
  PaginatedResponse,
  BlogPost,
} from '../types/blog'

// Query key factory for blog-related queries
export const blogQueryKeys = {
  all: ['blog'] as const,
  posts: {
    all: ['blog', 'posts'] as const,
    lists: () => [...blogQueryKeys.posts.all, 'list'] as const,
    list: (params: GetBlogPostsParams) => [...blogQueryKeys.posts.lists(), params] as const,
    details: () => [...blogQueryKeys.posts.all, 'detail'] as const,
    detail: (slug: string) => [...blogQueryKeys.posts.details(), slug] as const,
    search: (query: string) => [...blogQueryKeys.posts.all, 'search', query] as const,
    similar: (postId: string) => [...blogQueryKeys.posts.all, 'similar', postId] as const,
  },
  categories: {
    all: ['blog', 'categories'] as const,
    detail: (slug: string) => [...blogQueryKeys.categories.all, slug] as const,
  },
  tags: {
    all: ['blog', 'tags'] as const,
    detail: (slug: string) => [...blogQueryKeys.tags.all, slug] as const,
    popular: () => [...blogQueryKeys.tags.all, 'popular'] as const,
  },
  authors: {
    all: ['blog', 'authors'] as const,
    profile: (userId: string) => [...blogQueryKeys.authors.all, userId] as const,
  },
  comments: {
    all: ['blog', 'comments'] as const,
    list: (params: GetCommentsParams) => [...blogQueryKeys.comments.all, 'list', params] as const,
  },
  statistics: {
    all: ['blog', 'statistics'] as const,
    author: (authorId: string) => [...blogQueryKeys.statistics.all, authorId] as const,
    global: () => [...blogQueryKeys.statistics.all, 'global'] as const,
  },
}

/**
 * Hook to fetch paginated blog posts
 */
export function useBlogPosts(params: GetBlogPostsParams = {}) {
  return useQuery({
    queryKey: blogQueryKeys.posts.list(params),
    queryFn: () => PostService.getPosts(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to fetch a single blog post by slug
 */
export function useBlogPost(params: GetBlogPostParams) {
  return useQuery({
    queryKey: blogQueryKeys.posts.detail(params.slug),
    queryFn: () => PostService.getPost(params),
    enabled: !!params.slug,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to search blog posts
 */
export function useSearchBlogPosts(query: string, limit = 10) {
  return useQuery({
    queryKey: blogQueryKeys.posts.search(query),
    queryFn: () => PostService.searchPosts(query, limit),
    enabled: query.length > 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Hook to get similar blog posts
 */
export function useSimilarPosts(postId: string, limit = 5) {
  return useQuery({
    queryKey: blogQueryKeys.posts.similar(postId),
    queryFn: () => PostService.getSimilarPosts(postId, limit),
    enabled: !!postId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to create a new blog post
 */
export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateBlogPostData) => PostService.createPost(data),
    onSuccess: () => {
      // Invalidate posts list to refetch
      queryClient.invalidateQueries({ queryKey: blogQueryKeys.posts.lists() })
    },
  })
}

/**
 * Hook to update a blog post
 */
export function useUpdatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateBlogPostData) => PostService.updatePost(data),
    onSuccess: (updatedPost) => {
      // Invalidate specific post
      queryClient.invalidateQueries({
        queryKey: blogQueryKeys.posts.detail(updatedPost.slug),
      })
      // Invalidate posts list
      queryClient.invalidateQueries({ queryKey: blogQueryKeys.posts.lists() })
    },
  })
}

/**
 * Hook to delete a blog post
 */
export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => PostService.deletePost(id),
    onSuccess: () => {
      // Invalidate posts list
      queryClient.invalidateQueries({ queryKey: blogQueryKeys.posts.lists() })
    },
  })
}

/**
 * Hook to fetch all categories
 */
export function useBlogCategories() {
  return useQuery({
    queryKey: blogQueryKeys.categories.all,
    queryFn: () => TaxonomyService.getCategories(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to fetch a category by slug
 */
export function useBlogCategory(slug: string) {
  return useQuery({
    queryKey: blogQueryKeys.categories.detail(slug),
    queryFn: () => TaxonomyService.getCategoryBySlug(slug),
    enabled: !!slug,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to fetch all tags
 */
export function useBlogTags() {
  return useQuery({
    queryKey: blogQueryKeys.tags.all,
    queryFn: () => TaxonomyService.getTags(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to fetch a tag by slug
 */
export function useBlogTag(slug: string) {
  return useQuery({
    queryKey: blogQueryKeys.tags.detail(slug),
    queryFn: () => TaxonomyService.getTagBySlug(slug),
    enabled: !!slug,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to fetch popular tags
 */
export function usePopularTags(limit = 10) {
  return useQuery({
    queryKey: blogQueryKeys.tags.popular(),
    queryFn: () => TaxonomyService.getPopularTags(limit),
    staleTime: 15 * 60 * 1000, // 15 minutes
  })
}

/**
 * Hook to fetch author profile
 */
export function useAuthorProfile(userId: string) {
  return useQuery({
    queryKey: blogQueryKeys.authors.profile(userId),
    queryFn: () => AuthorService.getAuthorProfile(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to update author profile
 */
export function useUpdateAuthorProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: Partial<BlogAuthorUpdate> }) =>
      AuthorService.updateAuthorProfile(userId, updates),
    onSuccess: (_, variables) => {
      // Invalidate author profile
      queryClient.invalidateQueries({
        queryKey: blogQueryKeys.authors.profile(variables.userId),
      })
    },
  })
}

/**
 * Hook to fetch comments
 */
export function useComments(params: GetCommentsParams) {
  return useQuery({
    queryKey: blogQueryKeys.comments.list(params),
    queryFn: () => CommentService.getComments(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

/**
 * Hook to create a comment
 */
export function useCreateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCommentData) => CommentService.createComment(data),
    onSuccess: (_, variables) => {
      // Invalidate comments for the post
      queryClient.invalidateQueries({
        queryKey: blogQueryKeys.comments.list({ postId: variables.post_id }),
      })
    },
  })
}

/**
 * Hook to moderate a comment
 */
export function useModerateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ModerateCommentData) => CommentService.moderateComment(data),
    onSuccess: () => {
      // Invalidate all comments lists
      queryClient.invalidateQueries({
        queryKey: blogQueryKeys.comments.all,
      })
    },
  })
}

/**
 * Hook to fetch blog statistics
 */
export function useBlogStatistics(authorId?: string) {
  return useQuery({
    queryKey: authorId
      ? blogQueryKeys.statistics.author(authorId)
      : blogQueryKeys.statistics.global(),
    queryFn: () => AnalyticsService.getStatistics(authorId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to prefetch a blog post
 */
export function usePrefetchBlogPost() {
  const queryClient = useQueryClient()

  return (params: GetBlogPostParams) => {
    return queryClient.prefetchQuery({
      queryKey: blogQueryKeys.posts.detail(params.slug),
      queryFn: () => PostService.getPost(params),
      staleTime: 10 * 60 * 1000, // 10 minutes
    })
  }
}

/**
 * Hook for optimistic updates when creating/updating posts
 */
export function useOptimisticPost() {
  const queryClient = useQueryClient()

  const optimisticCreate = (data: CreateBlogPostData) => {
    // Add optimistic post to cache
    queryClient.setQueryData(
      blogQueryKeys.posts.lists(),
      (old: PaginatedResponse<BlogPost> | undefined) => {
        if (!old) return old
        return {
          ...old,
          data: [
            {
              id: 'temp-' + Date.now(),
              ...data,
              slug: data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              view_count: 0,
              author_id: 'current-user', // This should come from auth context
            },
            ...old.data,
          ],
        }
      }
    )
  }

  const optimisticUpdate = (data: UpdateBlogPostData) => {
    // Update post in cache optimistically
    queryClient.setQueryData(
      blogQueryKeys.posts.lists(),
      (old: PaginatedResponse<BlogPost> | undefined) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map((post: BlogPost) =>
            post.id === data.id ? { ...post, ...data, updated_at: new Date().toISOString() } : post
          ),
        }
      }
    )
  }

  return { optimisticCreate, optimisticUpdate }
}
