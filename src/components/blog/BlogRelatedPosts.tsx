import { useState, useEffect } from 'react'
import { 
  BookOpenIcon,
  EyeIcon,
  ArrowRightIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { AccessibleIcon } from '../common/AccessibleIcon'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { BlogReadingTime } from './BlogReadingTime'
import type { BlogPost } from '../../types/blog'

export interface BlogRelatedPostsProps {
  /** Current post ID to find related posts for */
  currentPostId: string
  /** Current post data for similarity matching */
  currentPost?: BlogPost
  /** Maximum number of related posts to show */
  maxPosts?: number
  /** Display variant */
  variant?: 'grid' | 'list' | 'carousel' | 'sidebar'
  /** Algorithm for finding related posts */
  algorithm?: 'tags' | 'category' | 'author' | 'mixed' | 'ai'
  /** Whether to show post excerpts */
  showExcerpts?: boolean
  /** Whether to show reading time */
  showReadingTime?: boolean
  /** Whether to show view counts */
  showViewCounts?: boolean
  /** Whether to show post dates */
  showDates?: boolean
  /** Whether to show author information */
  showAuthors?: boolean
  /** Whether to show similarity scores (for debugging) */
  showSimilarityScores?: boolean
  /** Custom title for the section */
  title?: string
  /** Called when a related post is clicked */
  onPostClick?: (post: BlogPost) => void
  /** Custom empty state message */
  emptyStateMessage?: string
  /** Additional CSS classes */
  className?: string
}

interface RelatedPost extends BlogPost {
  similarityScore?: number
  matchReason?: string
}

interface RelatedPostsAlgorithm {
  name: string
  getRelatedPosts: (currentPost: BlogPost, allPosts: BlogPost[], maxPosts: number) => RelatedPost[]
}

/**
 * Calculate similarity score between two posts based on tags
 */
const calculateTagSimilarity = (post1: BlogPost, post2: BlogPost): number => {
  if (!post1.tags?.length || !post2.tags?.length) return 0
  
  const tags1 = new Set(post1.tags.map(tag => tag.name.toLowerCase()))
  const tags2 = new Set(post2.tags.map(tag => tag.name.toLowerCase()))
  
  const intersection = new Set([...tags1].filter(tag => tags2.has(tag)))
  const union = new Set([...tags1, ...tags2])
  
  return intersection.size / union.size // Jaccard similarity
}

/**
 * Calculate similarity score based on category
 */
const calculateCategorySimilarity = (post1: BlogPost, post2: BlogPost): number => {
  const cat1 = post1.categories?.[0]
  const cat2 = post2.categories?.[0]
  
  if (!cat1 || !cat2) return 0
  if (cat1.id === cat2.id) return 1
  if (cat1.parent_id === cat2.parent_id && cat1.parent_id) return 0.7
  return 0
}

/**
 * Calculate text similarity using basic word overlap
 */
const calculateTextSimilarity = (text1: string, text2: string): number => {
  const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 3))
  const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 3))
  
  const intersection = new Set([...words1].filter(word => words2.has(word)))
  const union = new Set([...words1, ...words2])
  
  return intersection.size / union.size
}

/**
 * Different algorithms for finding related posts
 */
const getRelatedPostsAlgorithms = (): Record<string, RelatedPostsAlgorithm> => ({
  tags: {
    name: 'By Tags',
    getRelatedPosts: (currentPost, allPosts, maxPosts) => {
      return allPosts
        .filter(post => post.id !== currentPost.id)
        .map(post => ({
          ...post,
          similarityScore: calculateTagSimilarity(currentPost, post),
          matchReason: 'Similar tags'
        }))
        .filter(post => post.similarityScore > 0)
        .sort((a, b) => b.similarityScore! - a.similarityScore!)
        .slice(0, maxPosts)
    }
  },
  
  category: {
    name: 'By Category',
    getRelatedPosts: (currentPost, allPosts, maxPosts) => {
      return allPosts
        .filter(post => post.id !== currentPost.id)
        .map(post => ({
          ...post,
          similarityScore: calculateCategorySimilarity(currentPost, post),
          matchReason: post.categories?.[0]?.id === currentPost.categories?.[0]?.id ? 'Same category' : 'Related category'
        }))
        .filter(post => post.similarityScore > 0)
        .sort((a, b) => b.similarityScore! - a.similarityScore!)
        .slice(0, maxPosts)
    }
  },
  
  author: {
    name: 'By Author',
    getRelatedPosts: (currentPost, allPosts, maxPosts) => {
      return allPosts
        .filter(post => 
          post.id !== currentPost.id && 
          post.author?.id === currentPost.author?.id
        )
        .map(post => ({
          ...post,
          similarityScore: 1,
          matchReason: 'Same author'
        }))
        .sort((a, b) => {
          const dateA = new Date(a.published_at || a.created_at || '')
          const dateB = new Date(b.published_at || b.created_at || '')
          return dateB.getTime() - dateA.getTime()
        })
        .slice(0, maxPosts)
    }
  },
  
  mixed: {
    name: 'Mixed Algorithm',
    getRelatedPosts: (currentPost, allPosts, maxPosts) => {
      return allPosts
        .filter(post => post.id !== currentPost.id)
        .map(post => {
          const tagSimilarity = calculateTagSimilarity(currentPost, post)
          const categorySimilarity = calculateCategorySimilarity(currentPost, post)
          const titleSimilarity = calculateTextSimilarity(currentPost.title, post.title)
          const excerptSimilarity = currentPost.excerpt && post.excerpt 
            ? calculateTextSimilarity(currentPost.excerpt, post.excerpt) 
            : 0
          
          const combinedScore = (
            tagSimilarity * 0.4 +
            categorySimilarity * 0.3 +
            titleSimilarity * 0.2 +
            excerptSimilarity * 0.1
          )
          
          let matchReason = 'Content similarity'
          if (categorySimilarity > 0.5) matchReason = 'Category match'
          else if (tagSimilarity > 0.3) matchReason = 'Tag similarity'
          else if (titleSimilarity > 0.2) matchReason = 'Title similarity'
          
          return {
            ...post,
            similarityScore: combinedScore,
            matchReason
          }
        })
        .filter(post => post.similarityScore > 0.1)
        .sort((a, b) => b.similarityScore! - a.similarityScore!)
        .slice(0, maxPosts)
    }
  },
  
  ai: {
    name: 'AI Recommendations',
    getRelatedPosts: (currentPost, allPosts, maxPosts) => {
      // This would integrate with an AI service for semantic similarity
      // For now, we'll use the mixed algorithm as a fallback
      const mixedAlgorithm = getRelatedPostsAlgorithms().mixed
      return mixedAlgorithm.getRelatedPosts(currentPost, allPosts, maxPosts)
        .map(post => ({
          ...post,
          matchReason: 'AI recommendation'
        }))
    }
  }
})

const RelatedPostCard: React.FC<{
  post: RelatedPost
  variant: 'grid' | 'list' | 'carousel' | 'sidebar'
  showExcerpt: boolean
  showReadingTime: boolean
  showViewCount: boolean
  showDate: boolean
  showAuthor: boolean
  showSimilarityScore: boolean
  onClick?: (post: BlogPost) => void
}> = ({ 
  post, 
  variant, 
  showExcerpt, 
  showReadingTime, 
  showViewCount, 
  showDate, 
  showAuthor,
  showSimilarityScore,
  onClick 
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(post)
    } else {
      // Default navigation
      window.location.href = `/blog/${post.slug}`
    }
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(dateString))
  }

  const cardClasses = {
    grid: 'cursor-pointer hover:shadow-md transition-shadow',
    list: 'cursor-pointer hover:bg-gray-50 transition-colors',
    carousel: 'flex-shrink-0 w-80 cursor-pointer hover:shadow-md transition-shadow',
    sidebar: 'cursor-pointer hover:bg-gray-50 transition-colors'
  }

  const imageClasses = {
    grid: 'h-40 w-full object-cover',
    list: 'h-20 w-20 object-cover rounded',
    carousel: 'h-32 w-full object-cover',
    sidebar: 'h-16 w-16 object-cover rounded'
  }

  if (variant === 'list' || variant === 'sidebar') {
    return (
      <Card 
        variant="bordered" 
        padding="md" 
        className={cardClasses[variant]}
        onClick={handleClick}
      >
        <div className="flex space-x-3">
          {post.featured_image_url && (
            <img
              src={post.featured_image_url}
              alt={post.title}
              className={imageClasses[variant]}
            />
          )}
          <div className="flex-1 min-w-0">
            <h4 className={`font-medium text-gray-900 line-clamp-2 ${variant === 'sidebar' ? 'text-sm' : 'text-base'}`}>
              {post.title}
            </h4>
            
            {showExcerpt && post.excerpt && variant !== 'sidebar' && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {post.excerpt}
              </p>
            )}
            
            <div className={`mt-2 flex items-center space-x-3 text-xs text-gray-500`}>
              {showAuthor && post.author && (
                <span>{post.author?.user?.username || post.author?.user?.email || 'Unknown Author'}</span>
              )}
              
              {showDate && (
                <span>{(() => {
                  const date = post.published_at || post.created_at;
                  return date ? formatDate(date) : 'No date';
                })()}</span>
              )}
              
              {showReadingTime && post.content && (
                <BlogReadingTime 
                  content={post.content} 
                  variant="minimal" 
                  showIcon={false}
                  className="text-xs"
                />
              )}
              
              {showViewCount && post.view_count && (
                <div className="flex items-center">
                  <AccessibleIcon icon={EyeIcon} className="h-3 w-3 mr-1" />
                  <span>{post.view_count.toLocaleString()}</span>
                </div>
              )}
            </div>
            
            {showSimilarityScore && post.similarityScore && (
              <div className="mt-1 flex items-center space-x-2">
                <Badge variant="neutral" className="text-xs">
                  {Math.round(post.similarityScore * 100)}% match
                </Badge>
                {post.matchReason && (
                  <span className="text-xs text-gray-400">{post.matchReason}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card 
      variant="bordered" 
      padding="none" 
      className={cardClasses[variant]}
      onClick={handleClick}
    >
      {post.featured_image_url && (
        <img
          src={post.featured_image_url}
          alt={post.title}
          className={imageClasses[variant]}
        />
      )}
      
      <div className="p-4">
        <h4 className="font-semibold text-gray-900 line-clamp-2 mb-2">
          {post.title}
        </h4>
        
        {showExcerpt && post.excerpt && (
          <p className="text-sm text-gray-600 line-clamp-3 mb-3">
            {post.excerpt}
          </p>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-3">
            {showAuthor && post.author && (
              <span>{post.author?.user?.username || post.author?.user?.email || 'Unknown Author'}</span>
            )}
            
            {showDate && (
              <span>{(() => {
                const date = post.published_at || post.created_at;
                return date ? formatDate(date) : 'No date';
              })()}</span>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {showReadingTime && post.content && (
              <BlogReadingTime 
                content={post.content} 
                variant="minimal" 
                showIcon={true}
                className="text-xs"
              />
            )}
            
            {showViewCount && post.view_count && (
              <div className="flex items-center">
                <AccessibleIcon icon={EyeIcon} className="h-3 w-3 mr-1" />
                <span>{post.view_count.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        
        {showSimilarityScore && post.similarityScore && (
          <div className="mt-3 flex items-center justify-between">
            <Badge variant="neutral" className="text-xs">
              {Math.round(post.similarityScore * 100)}% similarity
            </Badge>
            {post.matchReason && (
              <span className="text-xs text-gray-400">{post.matchReason}</span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

const BlogRelatedPostsInner: React.FC<BlogRelatedPostsProps> = ({
  currentPostId,
  currentPost,
  maxPosts = 3,
  variant = 'grid',
  algorithm = 'mixed',
  showExcerpts = true,
  showReadingTime = true,
  showViewCounts = false,
  showDates = true,
  showAuthors = true,
  showSimilarityScores = false,
  title,
  onPostClick,
  emptyStateMessage = "No related posts found",
  className = ''
}) => {
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const algorithms = getRelatedPostsAlgorithms()
  const selectedAlgorithm = algorithms[algorithm] || algorithms.mixed

  // Load related posts
  useEffect(() => {
    const loadRelatedPosts = async () => {
      if (!currentPost && !currentPostId) return

      setIsLoading(true)
      setError(null)

      try {
        // TODO: Replace with actual API calls
        // If we don't have currentPost data, fetch it first
        const postData = currentPost
        if (!postData && currentPostId) {
          // const response = await fetchBlogPost(currentPostId)
          // postData = response.post
          return // Skip for now without post data
        }

        if (!postData) {
          throw new Error('Post data not available')
        }

        // Fetch all posts for similarity comparison
        // const allPostsResponse = await fetchAllBlogPosts()
        // const allPosts = allPostsResponse.posts
        
        // Mock data for development
        const allPosts: BlogPost[] = []
        
        const related = selectedAlgorithm.getRelatedPosts(postData, allPosts, maxPosts)
        setRelatedPosts(related)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load related posts')
      } finally {
        setIsLoading(false)
      }
    }

    loadRelatedPosts()
  }, [currentPostId, currentPost, algorithm, maxPosts, selectedAlgorithm])

  const sectionTitle = title || `Related ${variant === 'sidebar' ? 'Articles' : 'Posts'}`

  if (error) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  if (isLoading) {
    const skeletonCount = variant === 'carousel' ? maxPosts : Math.min(maxPosts, 3)
    
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse" />
          {showSimilarityScores && (
            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
          )}
        </div>
        
        <div className={`
          ${variant === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : ''}
          ${variant === 'list' || variant === 'sidebar' ? 'space-y-4' : ''}
          ${variant === 'carousel' ? 'flex space-x-4 overflow-x-auto pb-4' : ''}
        `}>
          {[...Array(skeletonCount)].map((_, i) => (
            <Card key={i} variant="bordered" padding="none">
              <div className={`bg-gray-200 animate-pulse ${
                variant === 'grid' ? 'h-40' : 
                variant === 'carousel' ? 'h-32' : 'h-20'
              }`} />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (relatedPosts.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <AccessibleIcon icon={BookOpenIcon} className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">{emptyStateMessage}</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-gray-900 flex items-center ${
          variant === 'sidebar' ? 'text-base' : 'text-lg'
        }`}>
          <AccessibleIcon icon={SparklesIcon} className="h-5 w-5 mr-2" />
          {sectionTitle}
        </h3>
        
        {showSimilarityScores && (
          <span className="text-xs text-gray-500">
            via {selectedAlgorithm.name}
          </span>
        )}
      </div>

      {/* Posts Grid/List */}
      <div className={`
        ${variant === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : ''}
        ${variant === 'list' || variant === 'sidebar' ? 'space-y-4' : ''}
        ${variant === 'carousel' ? 'flex space-x-4 overflow-x-auto pb-4' : ''}
      `}>
        {relatedPosts.map((post) => (
          <RelatedPostCard
            key={post.id}
            post={post}
            variant={variant}
            showExcerpt={showExcerpts}
            showReadingTime={showReadingTime}
            showViewCount={showViewCounts}
            showDate={showDates}
            showAuthor={showAuthors}
            showSimilarityScore={showSimilarityScores}
            onClick={onPostClick}
          />
        ))}
      </div>

      {/* View All Button (for sidebar variant) */}
      {variant === 'sidebar' && relatedPosts.length >= maxPosts && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<ArrowRightIcon className="w-4 h-4" />}
            className="w-full justify-center"
          >
            View More Related Posts
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Blog Related Posts Component
 * 
 * An intelligent recommendation system supporting:
 * - Multiple similarity algorithms (tags, category, author, mixed, AI)
 * - Various display layouts (grid, list, carousel, sidebar)
 * - Similarity scoring and match explanations
 * - Configurable metadata display
 * - Performance optimized rendering
 * - Accessibility features
 * - Loading and error states
 * 
 * Algorithms:
 * - Tags: Jaccard similarity on post tags
 * - Category: Exact and hierarchical category matching
 * - Author: Posts by same author, sorted chronologically
 * - Mixed: Weighted combination of multiple factors
 * - AI: Semantic similarity (requires backend integration)
 * 
 * @example
 * ```tsx
 * <BlogRelatedPosts
 *   currentPostId="123"
 *   currentPost={postData}
 *   algorithm="mixed"
 *   variant="grid"
 *   maxPosts={4}
 *   showSimilarityScores={true}
 *   onPostClick={(post) => navigate(`/blog/${post.slug}`)}
 * />
 * ```
 */
export const BlogRelatedPosts: React.FC<BlogRelatedPostsProps> = (props) => {
  return (
    <ErrorBoundary>
      <BlogRelatedPostsInner {...props} />
    </ErrorBoundary>
  )
}

export default BlogRelatedPosts