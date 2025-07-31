import React, { useEffect, useState } from 'react'
import { useBlogAnalytics, useNewsletterTracking, useCTATracking, useShareTracking } from '../../hooks/useBlogAnalytics'
import type { PopularPost, BlogPostAnalytics, ABTestVariant } from '../../lib/blog-analytics'
import { Button } from '../common/Button'
import { Card } from '../common/Card'

/**
 * Demo component showing how to integrate blog analytics tracking
 * into React components. This demonstrates:
 * 
 * - Automatic page view tracking
 * - Manual engagement event tracking
 * - A/B test variant assignment
 * - Analytics data retrieval
 * - Performance monitoring
 */

interface BlogAnalyticsDemoProps {
  postSlug: string
  postTitle: string
}

export function BlogAnalyticsDemo({ postSlug, postTitle }: BlogAnalyticsDemoProps) {
  // Set up analytics tracking with all features enabled
  const analytics = useBlogAnalytics(postSlug, {
    autoTrack: true,
    trackScrollProgress: true,
    trackReadingTime: true,
    trackPerformance: true,
    scrollDebounceMs: 300
  })

  // Specialized tracking hooks
  const { trackSignup } = useNewsletterTracking(postSlug)
  const { trackCTAClick } = useCTATracking(postSlug)
  const { trackShare } = useShareTracking(postSlug)

  // State for demo data
  const [popularPosts, setPopularPosts] = useState<PopularPost[]>([])
  const [postAnalytics, setPostAnalytics] = useState<BlogPostAnalytics | null>(null)
  const [abTestVariant, setAbTestVariant] = useState<ABTestVariant>('control')
  const [isLoading, setIsLoading] = useState(true)
  const [email, setEmail] = useState('')

  // Load analytics data on mount
  useEffect(() => {
    const loadAnalyticsData = async () => {
      try {
        setIsLoading(true)

        // Get A/B test variant for this user
        const variant = await analytics.getABTestVariant('cta_color_test')
        setAbTestVariant(variant)

        // Load popular posts
        const popular = await analytics.getPopularPosts('7d', { limit: 5 })
        setPopularPosts(popular)

        // Load current post analytics
        const postStats = await analytics.getPostAnalytics(postSlug, '30d')
        setPostAnalytics(postStats)

      } catch (error) {
        console.error('Failed to load analytics data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAnalyticsData()
  }, [analytics, postSlug])

  // Event handlers with analytics tracking
  const handleCTAClick = async () => {
    await trackCTAClick('main-cta', 'button', '/signup')
    // Redirect to signup page
    window.location.href = '/signup'
  }

  const handleNewsletterSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    try {
      await trackSignup(email, 'inline')
      alert('Thanks for signing up! Check your email for confirmation.')
      setEmail('')
    } catch (error) {
      console.error('Newsletter signup failed:', error)
    }
  }

  const handleShare = async (platform: 'twitter' | 'facebook' | 'linkedin') => {
    await trackShare(platform, postTitle)
    
    // Open share dialog
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(postTitle)}&url=${encodeURIComponent(window.location.href)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`
    }
    
    window.open(urls[platform], '_blank', 'width=600,height=400')
  }

  const handleEngagementEvent = async (eventType: 'cta_click' | 'newsletter_signup' | 'comment_posted' | 'share_click', metadata?: Record<string, unknown>) => {
    await analytics.trackEngagement(eventType, metadata)
  }

  const handleSearchExample = async () => {
    const query = 'pay per call marketing'
    const resultsCount = 12
    const selectedIndex = 0
    
    await analytics.trackSearch(query, resultsCount, selectedIndex)
    alert('Search event tracked!')
  }

  // Get CTA button style based on A/B test variant
  const getCtaButtonProps = () => {
    const baseProps = {
      size: 'lg' as const,
      onClick: handleCTAClick
    }

    switch (abTestVariant) {
      case 'variant_a':
        return { ...baseProps, variant: 'primary' as const, children: 'Get Started Now!' }
      case 'variant_b':
        return { ...baseProps, variant: 'secondary' as const, children: 'Start Your Free Trial' }
      case 'variant_c':
        return { ...baseProps, variant: 'danger' as const, children: 'Join 10,000+ Users' }
      default:
        return { ...baseProps, variant: 'primary' as const, children: 'Sign Up Today' }
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-32 bg-gray-200 rounded mb-4"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Analytics Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Analytics Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium">Session ID:</span>
            <br />
            <code className="text-xs text-gray-600">{analytics.sessionId}</code>
          </div>
          <div>
            <span className="font-medium">Tracking Active:</span>
            <br />
            <span className={analytics.isTracking ? 'text-green-600' : 'text-red-600'}>
              {analytics.isTracking ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <span className="font-medium">A/B Test Variant:</span>
            <br />
            <span className="capitalize">{abTestVariant}</span>
          </div>
        </div>
      </Card>

      {/* Interactive Elements for Testing */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Interactive Analytics Demo</h3>
        
        {/* A/B Tested CTA Button */}
        <div className="mb-6">
          <h4 className="font-medium mb-2">A/B Tested CTA Button (Variant: {abTestVariant})</h4>
          <Button {...getCtaButtonProps()} />
        </div>

        {/* Newsletter Signup */}
        <div className="mb-6">
          <h4 className="font-medium mb-2">Newsletter Signup Tracking</h4>
          <form onSubmit={handleNewsletterSignup} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <Button type="submit" variant="primary">
              Subscribe
            </Button>
          </form>
        </div>

        {/* Social Sharing */}
        <div className="mb-6">
          <h4 className="font-medium mb-2">Social Share Tracking</h4>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleShare('twitter')}
            >
              Share on Twitter
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleShare('facebook')}
            >
              Share on Facebook
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleShare('linkedin')}
            >
              Share on LinkedIn
            </Button>
          </div>
        </div>

        {/* Other Engagement Events */}
        <div className="mb-6">
          <h4 className="font-medium mb-2">Other Engagement Events</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEngagementEvent('cta_click', { action: 'like' })}
            >
              Like Post
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEngagementEvent('cta_click', { action: 'bookmark' })}
            >
              Bookmark
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEngagementEvent('comment_posted', { comment_length: 150 })}
            >
              Simulate Comment
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSearchExample}
            >
              Track Search
            </Button>
          </div>
        </div>
      </Card>

      {/* Current Post Analytics */}
      {postAnalytics && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Current Post Analytics (Last 30 Days)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{postAnalytics.totalViews.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Views</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{postAnalytics.uniqueViews.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Unique Views</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{Math.round(postAnalytics.averageTimeSpent)}s</div>
              <div className="text-sm text-gray-600">Avg Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{Math.round(postAnalytics.scrollDepthAverage * 100)}%</div>
              <div className="text-sm text-gray-600">Avg Scroll</div>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">{Math.round(postAnalytics.bounceRate * 100)}%</div>
              <div className="text-sm text-gray-600">Bounce Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-indigo-600">{Math.round(postAnalytics.completionRate * 100)}%</div>
              <div className="text-sm text-gray-600">Completion</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-pink-600">{postAnalytics.shareCount}</div>
              <div className="text-sm text-gray-600">Shares</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-teal-600">{Math.round(postAnalytics.conversionRate * 100)}%</div>
              <div className="text-sm text-gray-600">Conversion</div>
            </div>
          </div>
        </Card>
      )}

      {/* Popular Posts */}
      {popularPosts.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Popular Posts (Last 7 Days)</h3>
          <div className="space-y-3">
            {popularPosts.map((post) => (
              <div key={post.slug} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <div className="flex-1">
                  <div className="font-medium text-sm">{post.title}</div>
                  <div className="text-xs text-gray-500">
                    {post.author && `By ${post.author}`}
                    {post.category && ` • ${post.category}`}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{post.viewCount.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">views</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Analytics Integration Notes */}
      <Card className="p-6 bg-blue-50">
        <h3 className="text-lg font-semibold mb-4">Implementation Notes</h3>
        <div className="text-sm space-y-2">
          <p>
            <strong>Automatic Tracking:</strong> Page views, scroll progress, reading time, and performance metrics 
            are tracked automatically when the component mounts.
          </p>
          <p>
            <strong>Privacy Compliant:</strong> All data is stored locally with automatic expiration and follows 
            GDPR guidelines for data retention.
          </p>
          <p>
            <strong>A/B Testing:</strong> Users are automatically assigned to test variants and their interactions 
            are tracked for statistical analysis.
          </p>
          <p>
            <strong>Performance Monitoring:</strong> Page load times, Core Web Vitals, and other performance 
            metrics are captured for optimization insights.
          </p>
          <p>
            <strong>Real-time Updates:</strong> Analytics data is sent to Supabase for real-time dashboard 
            updates and reporting.
          </p>
        </div>
      </Card>
    </div>
  )
}

// Example of a simpler blog post component with analytics
export function SimpleBlogPost({ slug, title, content }: { slug: string; title: string; content: string }) {
  const { trackEngagement } = useBlogAnalytics(slug, {
    autoTrack: true,
    trackScrollProgress: true
  })

  const { trackShare } = useShareTracking(slug)

  const handleLike = () => {
    trackEngagement('cta_click', { action: 'like' })
    // Update UI to show liked state
  }

  const handleBookmark = () => {
    trackEngagement('cta_click', { action: 'bookmark' })
    // Update UI to show bookmarked state
  }

  return (
    <article className="prose prose-lg max-w-none">
      <h1>{title}</h1>
      
      <div dangerouslySetInnerHTML={{ __html: content }} />
      
      {/* Engagement buttons */}
      <div className="flex items-center gap-4 mt-8 pt-8 border-t">
        <Button variant="outline" size="sm" onClick={handleLike}>
          👍 Like
        </Button>
        <Button variant="outline" size="sm" onClick={handleBookmark}>
          🔖 Bookmark
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => trackShare('twitter')}
        >
          🐦 Share
        </Button>
      </div>
    </article>
  )
}

export default BlogAnalyticsDemo