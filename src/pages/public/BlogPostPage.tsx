import { useParams, Link, Navigate } from 'react-router-dom'
import { useBlogPost, useComments, useCreateComment, useSimilarPosts } from '../../hooks/useBlog'
import { useAuthStore } from '../../store/authStore'
import { Breadcrumb } from '../../components/blog/Breadcrumb'
import { BlogErrorBoundary } from '../../components/blog/BlogErrorBoundary'
import { useState } from 'react'
import { format } from 'date-fns'
import { 
  CalendarIcon, 
  UserIcon, 
  TagIcon, 
  ChatBubbleLeftIcon,
  EyeIcon,
  ShareIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid'

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuthStore()
  const [commentContent, setCommentContent] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentSuccess, setCommentSuccess] = useState(false)

  // All hooks must be called at the top level before any conditionals
  const { data: post, isLoading: postLoading, error: postError } = useBlogPost({
    slug: slug || '', // Pass empty string if slug is undefined, hook should handle gracefully
    includeAuthor: true,
    includeCategories: true,
    includeTags: true,
    includeComments: false
  })

  const { data: commentsData } = useComments({
    postId: post?.id, // Will be undefined initially, hook should handle this gracefully
    status: 'approved',
    parentId: null,
    page: 1,
    limit: 50
  })

  const { data: similarPosts = [] } = useSimilarPosts(post?.id || '', 4)

  const createCommentMutation = useCreateComment()

  // Conditional logic comes after all hooks are called
  if (!slug) {
    return <Navigate to="/blog" replace />
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!post || !user || !commentContent.trim()) return

    setIsSubmittingComment(true)
    try {
      await createCommentMutation.mutateAsync({
        post_id: post.id,
        content: commentContent.trim()
      })
      setCommentContent('')
      setCommentSuccess(true)
      setTimeout(() => setCommentSuccess(false), 5000)
    } catch (error) {
      console.error('Failed to create comment:', error)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          url: window.location.href
        })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // User cancelled share - error intentionally unused
      }
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(window.location.href)
      // You could show a toast here
    }
  }

  if (postLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-64 mb-6" />
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8" />
          <div className="h-64 bg-gray-200 rounded mb-8" />
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      </div>
    )
  }

  if (postError || !post) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Post Not Found</h1>
          <p className="text-gray-600 mb-6">
            The blog post you're looking for doesn't exist or has been removed.
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Back to Blog
          </Link>
        </div>
      </div>
    )
  }

  const breadcrumbItems = [
    { label: 'Blog', href: '/blog' },
    { label: post.title }
  ]

  return (
    <BlogErrorBoundary>
      <div>
      {/* Article */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} className="mb-6" />

        {/* Article Header */}
        <header className="mb-8">
          {/* Categories */}
          {post.categories && post.categories.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              {post.categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/blog/category/${category.slug}`}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Subtitle */}
          {post.subtitle && (
            <p className="text-xl text-gray-600 mb-6">
              {post.subtitle}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-6">
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              {/* Author */}
              {post.author && (
                <div className="flex items-center">
                  <UserIcon className="h-4 w-4 mr-2" />
                  <Link
                    to={`/blog/author/${post.author.id}`}
                    className="hover:text-primary-600 transition-colors font-medium"
                  >
                    {post.author.display_name}
                  </Link>
                </div>
              )}

              {/* Date */}
              <div className="flex items-center">
                <CalendarIcon className="h-4 w-4 mr-2" />
                <time dateTime={post.published_at || post.created_at || ''}>
                  {format(new Date(post.published_at || post.created_at || new Date()), 'MMMM d, yyyy')}
                </time>
              </div>

              {/* Views */}
              {post.view_count && post.view_count > 0 && (
                <div className="flex items-center">
                  <EyeIcon className="h-4 w-4 mr-2" />
                  <span>{post.view_count?.toLocaleString() || 0} views</span>
                </div>
              )}

              {/* Comments count */}
              {commentsData && commentsData.meta.total > 0 && (
                <div className="flex items-center">
                  <ChatBubbleLeftIcon className="h-4 w-4 mr-2" />
                  <span>{commentsData.meta.total} comment{commentsData.meta.total !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex items-center text-sm text-gray-500 hover:text-primary-600 transition-colors"
            >
              <ShareIcon className="h-4 w-4 mr-2" />
              Share
            </button>
          </div>
        </header>

        {/* Featured Image */}
        {post.featured_image_url && (
          <div className="mb-8">
            <img
              src={post.featured_image_url}
              alt={post.title}
              className="w-full h-96 object-cover rounded-lg"
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-lg max-w-none mb-8">
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mb-8 pt-6 border-t border-gray-200">
            <TagIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Tags:</span>
            {post.tags.map((tag) => (
              <Link
                key={tag.id}
                to={`/blog?tag=${tag.slug}`}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Author Bio */}
        {post.author && (
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="flex items-start space-x-4">
              {post.author.avatar_url && (
                <img
                  src={post.author.avatar_url}
                  alt={post.author.display_name}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  <Link
                    to={`/blog/author/${post.author.id}`}
                    className="hover:text-primary-600 transition-colors"
                  >
                    {post.author.display_name}
                  </Link>
                </h3>
                {post.author.bio && (
                  <p className="text-gray-600 mb-3">{post.author.bio}</p>
                )}
                {post.author.social_links && (
                  <div className="flex items-center space-x-4 text-sm">
                    {Object.entries(post.author.social_links).map(([platform, url]) => (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-primary-600 transition-colors capitalize"
                      >
                        {platform}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </article>

      {/* Comments Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="border-t border-gray-200 pt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Comments ({commentsData?.meta.total || 0})
          </h2>

          {/* Comment Form */}
          {user ? (
            <form onSubmit={handleCommentSubmit} className="mb-8">
              <div className="mb-4">
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                  Add a comment
                </label>
                <textarea
                  id="comment"
                  rows={4}
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              
              {commentSuccess && (
                <div className="flex items-center mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm text-green-700">
                    Comment submitted successfully! It will appear after moderation.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingComment || !commentContent.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingComment ? 'Submitting...' : 'Submit Comment'}
              </button>
            </form>
          ) : (
            <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
                <span className="text-sm text-yellow-700">
                  Please{' '}
                  <Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`} className="font-medium underline">
                    log in
                  </Link>
                  {' '}to leave a comment.
                </span>
              </div>
            </div>
          )}

          {/* Comments List */}
          {commentsData?.data && commentsData.data.length > 0 ? (
            <div className="space-y-6">
              {commentsData.data.map((comment) => (
                <div key={comment.id} className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {comment.user?.avatar_url && (
                        <img
                          src={comment.user.avatar_url}
                          alt={comment.user.username || comment.user.email}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {comment.user?.username || comment.user?.email || 'Anonymous'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(comment.created_at || new Date()), 'MMM d, yyyy at h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <p>{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No comments yet. Be the first to share your thoughts!
            </p>
          )}
        </div>
      </section>

      {/* Related Posts */}
      {similarPosts.length > 0 && (
        <section className="bg-gray-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Related Posts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {similarPosts.map((relatedPost) => (
                <article
                  key={relatedPost.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
                >
                  {relatedPost.featured_image_url && (
                    <div className="aspect-w-16 aspect-h-9">
                      <img
                        src={relatedPost.featured_image_url}
                        alt={relatedPost.title}
                        className="w-full h-32 object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">
                      <Link
                        to={`/blog/post/${relatedPost.slug}`}
                        className="hover:text-primary-600 transition-colors"
                      >
                        {relatedPost.title}
                      </Link>
                    </h3>
                    <p className="text-xs text-gray-500">
                      {format(new Date(relatedPost.published_at || relatedPost.created_at || new Date()), 'MMM d, yyyy')}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      </div>
    </BlogErrorBoundary>
  )
}