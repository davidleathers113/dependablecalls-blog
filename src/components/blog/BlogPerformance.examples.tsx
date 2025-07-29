/**
 * BlogPerformance Integration Examples
 * 
 * This file demonstrates how to integrate the BlogPerformance component
 * with existing blog components in the DCE website.
 */

import React, { useEffect, useState } from 'react'
import { 
  BlogPerformance, 
  useBlogPerformance, 
  useBlogMetrics, 
  withBlogPerformance,
  type BlogPerformanceConfig 
} from './BlogPerformance'
import { BlogPost, BlogComment } from '../../types/blog'
import { useBlog } from '../../hooks/useBlog'

// Example 1: Blog Post Page with Comprehensive Performance Monitoring
export function BlogPostPageExample({ postSlug }: { postSlug: string }) {
  const [performanceAlerts, setPerformanceAlerts] = useState<string[]>([])

  const handleBudgetExceeded = (metric: string, value: number, budget: number) => {
    const alert = `⚠️ ${metric.toUpperCase()} budget exceeded: ${Math.round(value)}ms > ${budget}ms`
    setPerformanceAlerts(prev => [...prev.slice(-4), alert]) // Keep last 5 alerts
    
    // Send to analytics
    if (window.gtag) {
      window.gtag('event', 'performance_budget_exceeded', {
        metric,
        value,
        budget,
        page: 'blog-post',
      })
    }
  }

  const handlePerformanceUpdate = (metrics: Record<string, unknown>) => {
    // Send real-time metrics to dashboard
    const webVitals = metrics.webVitals as Record<string, { rating?: string; value?: number }>
    if (webVitals?.lcp?.rating === 'poor') {
      console.warn('Poor LCP detected:', webVitals.lcp.value)
    }
  }

  const performanceConfig: Partial<BlogPerformanceConfig> = {
    enableWebVitals: true,
    enableUserTracking: true,
    enableBudgetAlerting: true,
    sampleRate: 0.1, // 10% sampling in production
    budgets: {
      lcp: 2500,
      fid: 100,
      cls: 0.1,
      contentRender: 1000,
      imageLoad: 2000,
      apiResponse: 800,
    },
    alertThresholds: {
      errorRate: 0.05,
      slowResponseRate: 0.15,
    },
  }

  return (
    <BlogPerformance
      componentName="blog-post-page"
      config={performanceConfig}
      enableRealTimeUpdates={true}
      onBudgetExceeded={handleBudgetExceeded}
      onPerformanceUpdate={handlePerformanceUpdate}
      className="min-h-screen"
    >
      <div className="container mx-auto px-4 py-8">
        {/* Performance Alerts (Development/Admin only) */}
        {process.env.NODE_ENV === 'development' && performanceAlerts.length > 0 && (
          <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400">
            <h4 className="text-yellow-800 font-semibold">Performance Alerts</h4>
            <ul className="text-yellow-700 text-sm mt-2">
              {performanceAlerts.map((alert, idx) => (
                <li key={idx}>{alert}</li>
              ))}
            </ul>
          </div>
        )}

        <BlogPostContent postSlug={postSlug} />
        <BlogCommentsSection postSlug={postSlug} />
        <BlogRelatedPostsSection postSlug={postSlug} />
      </div>
    </BlogPerformance>
  )
}

// Example 2: Enhanced Blog Post Content with Performance Tracking
function BlogPostContent({ postSlug }: { postSlug: string }) {
  const { trackUserAction, trackApiCall } = useBlogPerformance()
  const { measureContentRender } = useBlogMetrics()
  const { getPost, loading, error } = useBlog()
  const [post, setPost] = useState<BlogPost | null>(null)

  useEffect(() => {
    const loadPost = async () => {
      await measureContentRender(async () => {
        try {
          const postData = await trackApiCall('get-post', () => getPost(postSlug))
          setPost(postData)
        } catch (err) {
          console.error('Failed to load post:', err)
        }
      })
    }

    loadPost()
  }, [postSlug, getPost, measureContentRender, trackApiCall])

  const handleShare = (platform: string) => {
    trackUserAction('share', { 
      platform, 
      postId: post?.id, 
      postTitle: post?.title 
    })
  }

  const handleReadingProgress = (progress: number) => {
    if (progress % 25 === 0) { // Track at 25%, 50%, 75%, 100%
      trackUserAction('reading-progress', { progress, postId: post?.id })
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-gray-900">Post Not Found</h2>
        <p className="text-gray-600 mt-2">The blog post you're looking for doesn't exist.</p>
      </div>
    )
  }

  return (
    <article className="prose prose-lg max-w-none">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
        {post.subtitle && (
          <p className="text-xl text-gray-600 mb-6">{post.subtitle}</p>
        )}
        
        {/* Enhanced Featured Image with Performance Tracking */}
        {post.featured_image_url && (
          <EnhancedBlogImage 
            src={post.featured_image_url} 
            alt={post.title}
            className="w-full h-64 object-cover rounded-lg mb-6"
          />
        )}
      </header>

      {/* Content with Reading Progress Tracking */}
      <BlogContentRenderer 
        content={post.content} 
        onReadingProgress={handleReadingProgress}
      />

      {/* Social Sharing with Performance Tracking */}
      <footer className="mt-8 pt-8 border-t border-gray-200">
        <div className="flex space-x-4">
          <button 
            onClick={() => handleShare('twitter')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Share on Twitter
          </button>
          <button 
            onClick={() => handleShare('linkedin')}
            className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800"
          >
            Share on LinkedIn
          </button>
        </div>
      </footer>
    </article>
  )
}

// Example 3: Enhanced Image Component with Performance Tracking
function EnhancedBlogImage({ 
  src, 
  alt, 
  className 
}: { 
  src: string
  alt: string
  className?: string 
}) {
  const { measureImageLoad } = useBlogMetrics()
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const handleImageLoad = async () => {
    await measureImageLoad(async () => {
      // Simulate image processing time
      await new Promise(resolve => setTimeout(resolve, 10))
      setLoaded(true)
    })
  }

  const handleImageError = () => {
    setError(true)
  }

  return (
    <div className={`relative ${className}`}>
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      )}
      
      <img
        src={src}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        style={{ display: error ? 'none' : 'block' }}
      />
      
      {error && (
        <div className={`${className} bg-gray-100 flex items-center justify-center`}>
          <span className="text-gray-500">Failed to load image</span>
        </div>
      )}
    </div>
  )
}

// Example 4: Comments Section with Performance Monitoring
function BlogCommentsSection({ postSlug }: { postSlug: string }) {
  const { trackApiCall } = useBlogPerformance()
  const { measureCommentsLoad } = useBlogMetrics()
  const [comments, setComments] = useState<BlogComment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadComments = async () => {
      await measureCommentsLoad(async () => {
        try {
          const commentsData = await trackApiCall('get-comments', async () => {
            const response = await fetch(`/api/blog/posts/${postSlug}/comments`)
            if (!response.ok) throw new Error('Failed to load comments')
            return response.json()
          })
          setComments(commentsData)
        } catch (err) {
          console.error('Failed to load comments:', err)
        } finally {
          setLoading(false)
        }
      })
    }

    loadComments()
  }, [postSlug, trackApiCall, measureCommentsLoad])

  if (loading) {
    return (
      <section className="mt-12">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Comments</h3>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="mt-12">
      <h3 className="text-2xl font-bold text-gray-900 mb-6">
        Comments ({comments.length})
      </h3>
      
      {comments.length === 0 ? (
        <p className="text-gray-600">No comments yet. Be the first to comment!</p>
      ) : (
        <div className="space-y-6">
          {comments.map(comment => (
            <CommentCard key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </section>
  )
}

// Example 5: Related Posts with HOC Performance Wrapper
const BlogRelatedPostsSection = withBlogPerformance(
  function RelatedPosts({ postSlug }: { postSlug: string }) {
    const { trackApiCall } = useBlogPerformance()
    const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      const loadRelatedPosts = async () => {
        try {
          const posts = await trackApiCall('get-related-posts', async () => {
            const response = await fetch(`/api/blog/posts/${postSlug}/related`)
            if (!response.ok) throw new Error('Failed to load related posts')
            return response.json()
          })
          setRelatedPosts(posts)
        } catch (err) {
          console.error('Failed to load related posts:', err)
        } finally {
          setLoading(false)
        }
      }

      loadRelatedPosts()
    }, [postSlug, trackApiCall])

    if (loading || relatedPosts.length === 0) return null

    return (
      <section className="mt-12">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Related Posts</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {relatedPosts.map(post => (
            <RelatedPostCard key={post.id} post={post} />
          ))}
        </div>
      </section>
    )
  },
  {
    enableWebVitals: false, // Disable heavy monitoring for related section
    enableUserTracking: true,
    budgets: {
      contentRender: 500,
      apiResponse: 300,
      imageLoad: 1500,
    },
  }
)

// Example 6: Performance Dashboard Component (Admin/Development)
interface PerformanceReport {
  summary: {
    overallScore: number
    budgetStatus: 'passed' | 'warning' | 'failed'
    issues: string[]
  }
}

export function BlogPerformanceDashboard() {
  const { metrics, getPerformanceReport } = useBlogPerformance()
  const [report, setReport] = useState<PerformanceReport | null>(null)

  useEffect(() => {
    const updateReport = () => {
      setReport(getPerformanceReport())
    }

    updateReport()
    const interval = setInterval(updateReport, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [getPerformanceReport])

  if (!report) return null

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm">
      <h4 className="font-semibold text-gray-900 mb-2">Performance Monitor</h4>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Overall Score:</span>
          <span className={`font-semibold ${
            report.summary.overallScore >= 90 ? 'text-green-600' :
            report.summary.overallScore >= 75 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {report.summary.overallScore}/100
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Budget Status:</span>
          <span className={`font-semibold ${
            report.summary.budgetStatus === 'passed' ? 'text-green-600' :
            report.summary.budgetStatus === 'warning' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {report.summary.budgetStatus}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Scroll Depth:</span>
          <span>{metrics.userMetrics.scrollDepth}%</span>
        </div>

        <div className="flex justify-between">
          <span>Engagement:</span>
          <span>{Math.round(metrics.userMetrics.engagementTime / 60)}m</span>
        </div>
      </div>

      {report.summary.issues.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h5 className="font-medium text-red-600 mb-1">Issues:</h5>
          <ul className="text-xs text-red-600 space-y-1">
            {report.summary.issues.slice(0, 3).map((issue: string, idx: number) => (
              <li key={idx}>• {issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Helper Components
function BlogContentRenderer({ 
  content 
}: { 
  content: string
  onReadingProgress?: (progress: number) => void
}) {
  // Implementation would include scroll tracking for reading progress
  return <div dangerouslySetInnerHTML={{ __html: content }} />
}

function CommentCard({ comment }: { comment: BlogComment }) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex items-center mb-2">
        <div className="w-8 h-8 bg-gray-300 rounded-full mr-3"></div>
        <div>
          <p className="font-semibold text-gray-900">{comment.user?.username || 'Anonymous'}</p>
          <p className="text-sm text-gray-500">
            {new Date(comment.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <p className="text-gray-700">{comment.content}</p>
    </div>
  )
}

function RelatedPostCard({ post }: { post: BlogPost }) {
  return (
    <article className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {post.featured_image_url && (
        <img 
          src={post.featured_image_url} 
          alt={post.title}
          className="w-full h-32 object-cover"
        />
      )}
      <div className="p-4">
        <h4 className="font-semibold text-gray-900 mb-2">{post.title}</h4>
        <p className="text-sm text-gray-600">{post.excerpt}</p>
      </div>
    </article>
  )
}

// TypeScript declarations for global analytics
declare global {
  interface Window {
    gtag?: (command: string, action: string, parameters: Record<string, unknown>) => void
  }
}