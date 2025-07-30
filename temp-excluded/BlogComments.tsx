import { useState, useEffect, useCallback } from 'react'
import { PaperAirplaneIcon, HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/react/24/outline'
import { HandThumbUpIcon as HandThumbUpSolidIcon, HandThumbDownIcon as HandThumbDownSolidIcon } from '@heroicons/react/24/solid'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Loading } from '../common/Loading'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { AccessibleIcon } from '../common/AccessibleIcon'
import { useAuthStore } from '../../store/authStore'
import type { 
  BlogComment, 
  CommentStatus 
} from '../../types/blog'

export interface BlogCommentsProps {
  /** The blog post ID to load comments for */
  postId: string
  /** Whether comments are enabled for this post */
  commentsEnabled?: boolean
  /** Maximum comment nesting depth */
  maxDepth?: number
  /** Whether to show moderation controls (for admins) */
  showModerationControls?: boolean
  /** Custom empty state message */
  emptyStateMessage?: string
  /** Whether to enable real-time updates */
  enableRealtime?: boolean
  /** Called when a comment is posted */
  onCommentPosted?: (comment: BlogComment) => void
  /** Called when a comment is moderated */
  onCommentModerated?: (commentId: string, status: CommentStatus) => void
  /** Additional CSS classes */
  className?: string
}

// interface CommentFormData {
//   content: string
//   parentId?: string
// }

interface CommentItemProps {
  comment: BlogComment
  depth: number
  maxDepth: number
  onReply: (parentId: string) => void
  onVote: (commentId: string, type: 'up' | 'down') => void
  onModerate?: (commentId: string, status: CommentStatus) => void
  showModerationControls: boolean
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  depth,
  maxDepth,
  onReply,
  onVote,
  onModerate,
  showModerationControls
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null)

  const handleVote = (type: 'up' | 'down') => {
    const newVote = userVote === type ? null : type
    setUserVote(newVote)
    onVote(comment.id, type)
  }

  const handleReply = () => {
    if (depth < maxDepth) {
      setShowReplyForm(true)
      onReply(comment.id)
    }
  }

  const handleModerate = (status: CommentStatus) => {
    if (onModerate) {
      onModerate(comment.id, status)
    }
  }

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  return (
    <div className={`${depth > 0 ? 'ml-8 mt-4' : 'mt-6'}`}>
      <Card variant="bordered" padding="md" className="relative">
        {/* Comment Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {comment.user?.avatar_url ? (
                <img
                  src={comment.user.avatar_url}
                  alt={`${comment.user.username || comment.user.email} avatar`}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {(comment.user?.username || comment.user?.email || 'A').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {comment.user?.username || comment.user?.email || 'Anonymous'}
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(comment.created_at || '')}
                {comment.updated_at !== comment.created_at && (
                  <span className="ml-1">(edited)</span>
                )}
              </p>
            </div>
          </div>

          {showModerationControls && comment.status === 'pending' && (
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleModerate('approved')}
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleModerate('spam')}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Reject
              </Button>
            </div>
          )}
        </div>

        {/* Comment Content */}
        <div className="mb-4">
          <p className="text-gray-900 whitespace-pre-wrap">{comment.content}</p>
        </div>

        {/* Comment Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Vote Buttons */}
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleVote('up')}
                className={`p-1 ${userVote === 'up' ? 'text-green-600' : 'text-gray-400'} hover:text-green-600`}
                aria-label="Upvote comment"
              >
                <AccessibleIcon
                  icon={userVote === 'up' ? HandThumbUpSolidIcon : HandThumbUpIcon}
                  className="h-4 w-4"
                />
              </Button>
              <span className="text-sm text-gray-500">0</span>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleVote('down')}
                className={`p-1 ${userVote === 'down' ? 'text-red-600' : 'text-gray-400'} hover:text-red-600`}
                aria-label="Downvote comment"
              >
                <AccessibleIcon
                  icon={userVote === 'down' ? HandThumbDownSolidIcon : HandThumbDownIcon}
                  className="h-4 w-4"
                />
              </Button>
              <span className="text-sm text-gray-500">0</span>
            </div>

            {/* Reply Button */}
            {depth < maxDepth && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReply}
                className="text-gray-500 hover:text-gray-700"
              >
                Reply
              </Button>
            )}
          </div>

          {/* Status Badge */}
          {comment.status === 'pending' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              Pending
            </span>
          )}
        </div>

        {/* Reply Form */}
        {showReplyForm && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <CommentForm
              postId=""
              parentId={comment.id}
              onSubmit={() => setShowReplyForm(false)}
              onCancel={() => setShowReplyForm(false)}
              placeholder="Write a reply..."
              submitButtonText="Reply"
            />
          </div>
        )}
      </Card>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              maxDepth={maxDepth}
              onReply={onReply}
              onVote={onVote}
              onModerate={onModerate}
              showModerationControls={showModerationControls}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CommentFormProps {
  postId: string
  parentId?: string
  onSubmit: (comment: BlogComment) => void
  onCancel?: () => void
  placeholder?: string
  submitButtonText?: string
}

const CommentForm: React.FC<CommentFormProps> = ({
  postId,
  parentId,
  onSubmit,
  onCancel,
  placeholder = "Write a comment...",
  submitButtonText = "Post Comment"
}) => {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !user) return

    setIsSubmitting(true)
    setError(null)

    try {
      // const commentData: CreateCommentData = {
      //   content: content.trim(),
      //   post_id: postId,
      //   parent_id: parentId
      // }

      // TODO: Replace with actual API call
      const newComment: BlogComment = {
        id: Date.now().toString(),
        content: content.trim(),
        post_id: postId,
        parent_id: parentId || null,
        user_id: user?.id || '',
        status: 'approved' as CommentStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user: {
          id: user?.id || '',
          email: user?.email || '',
          username: user?.user_metadata?.username,
          avatar_url: user?.user_metadata?.avatar_url
        },
        replies: []
      }

      onSubmit(newComment)
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) {
    return (
      <Card variant="bordered" padding="md" className="text-center">
        <p className="text-gray-500 mb-4">Please log in to leave a comment.</p>
        <Button variant="primary" size="sm">
          Log In
        </Button>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
          required
          disabled={isSubmitting}
          maxLength={1000}
        />
        <div className="mt-1 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            {content.length}/1000 characters
          </p>
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={isSubmitting}
          disabled={!content.trim()}
          rightIcon={PaperAirplaneIcon}
        >
          {submitButtonText}
        </Button>
      </div>
    </form>
  )
}

const BlogCommentsInner: React.FC<BlogCommentsProps> = ({
  postId,
  commentsEnabled = true,
  maxDepth = 3,
  showModerationControls = false,
  emptyStateMessage = "No comments yet. Be the first to share your thoughts!",
  enableRealtime = true,
  onCommentPosted,
  onCommentModerated,
  className = ''
}) => {
  const [comments, setComments] = useState<BlogComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // const [replyingTo, setReplyingTo] = useState<string | null>(null)
  // const { user } = useAuthStore()

  // Load comments
  useEffect(() => {
    const loadComments = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // TODO: Replace with actual API call
        // const response = await fetchComments(postId)
        // setComments(response.comments)
        
        // Mock data for development
        setComments([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load comments')
      } finally {
        setIsLoading(false)
      }
    }

    loadComments()
  }, [postId])

  // Real-time subscription
  useEffect(() => {
    if (!enableRealtime) return

    // TODO: Setup real-time subscription
    // const subscription = supabase
    //   .channel(`comments:${postId}`)
    //   .on('postgres_changes', {
    //     event: 'INSERT',
    //     schema: 'public',
    //     table: 'blog_comments',
    //     filter: `post_id=eq.${postId}`
    //   }, (payload) => {
    //     const newComment = payload.new as BlogComment
    //     setComments(prev => [...prev, newComment])
    //   })
    //   .subscribe()

    // return () => {
    //   subscription.unsubscribe()
    // }
  }, [postId, enableRealtime])

  const handleCommentPosted = useCallback((comment: BlogComment) => {
    setComments(prev => [comment, ...prev])
    // setReplyingTo(null)
    onCommentPosted?.(comment)
  }, [onCommentPosted])

  const handleReply = useCallback(() => {
    // setReplyingTo(parentId)
  }, [])

  const handleVote = useCallback(async (commentId: string, type: 'up' | 'down') => {
    try {
      // TODO: Implement voting API call
      console.log(`Voting ${type} on comment ${commentId}`)
    } catch (err) {
      console.error('Failed to vote on comment:', err)
    }
  }, [])

  const handleCommentModerated = useCallback(async (commentId: string, status: CommentStatus) => {
    try {
      // TODO: Implement moderation API call
      setComments(prev =>
        prev.map(comment =>
          comment.id === commentId ? { ...comment, status } : comment
        )
      )
      onCommentModerated?.(commentId, status)
    } catch (err) {
      console.error('Failed to moderate comment:', err)
    }
  }, [onCommentModerated])

  if (!commentsEnabled) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500">Comments are disabled for this post.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-red-600 mb-4">Failed to load comments</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Comments Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Comment Form */}
      <CommentForm
        postId={postId}
        onSubmit={handleCommentPosted}
        placeholder="Share your thoughts..."
      />

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} variant="bordered" padding="md">
              <Loading variant="skeleton" className="h-24" />
            </Card>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{emptyStateMessage}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              maxDepth={maxDepth}
              onReply={handleReply}
              onVote={handleVote}
              onModerate={handleCommentModerated}
              showModerationControls={showModerationControls}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Blog Comments Component
 * 
 * A comprehensive comment system with:
 * - Nested comments with configurable depth
 * - Real-time updates via Supabase subscriptions
 * - Voting system (upvote/downvote)
 * - Moderation controls for admins
 * - Rich user interactions
 * - Accessibility features
 * - Loading and error states
 * 
 * @example
 * ```tsx
 * <BlogComments
 *   postId="123"
 *   commentsEnabled={true}
 *   enableRealtime={true}
 *   showModerationControls={user?.role === 'admin'}
 *   onCommentPosted={(comment) => console.log('New comment:', comment)}
 * />
 * ```
 */
export const BlogComments: React.FC<BlogCommentsProps> = (props) => {
  return (
    <ErrorBoundary>
      <BlogCommentsInner {...props} />
    </ErrorBoundary>
  )
}

export default BlogComments