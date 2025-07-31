/**
 * Blog Mock Data Service
 * 
 * Provides mock blog data when environment variables are placeholders
 * or when VITE_USE_MOCK_BLOG_DATA is true
 */

import type { Database } from '../types/database-extended'

type BlogPost = Database['public']['Tables']['blog_posts']['Row']
type BlogCategory = Database['public']['Tables']['blog_categories']['Row']
type BlogTag = Database['public']['Tables']['blog_tags']['Row']
type BlogAuthor = Database['public']['Tables']['blog_authors']['Row']

// Check if we should use mock data
const shouldUseMockData = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const useMockData = import.meta.env.VITE_USE_MOCK_BLOG_DATA === 'true'
  
  // Use mock data if:
  // 1. Explicitly enabled via env var
  // 2. Supabase URL is placeholder
  // 3. No Supabase URL at all
  return useMockData || 
         !supabaseUrl || 
         supabaseUrl.includes('your-project.supabase.co') ||
         supabaseUrl === 'your_supabase_url'
}

// Mock data
const mockAuthors: BlogAuthor[] = [
  {
    id: 'author-1',
    display_name: 'Alex Chen',
    email: 'alex@dependablecalls.com',
    bio: 'Lead developer and technical writer specializing in call tracking and performance optimization.',
    avatar_url: null,
    social_links: null,
    storage_quota_mb: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'author-2', 
    display_name: 'Sarah Johnson',
    email: 'sarah@dependablecalls.com',
    bio: 'Marketing strategist with expertise in lead generation and call conversion optimization.',
    avatar_url: null,
    social_links: null,
    storage_quota_mb: null,
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z'
  }
]

const mockCategories: BlogCategory[] = [
  {
    id: 'cat-1',
    name: 'Call Tracking',
    slug: 'call-tracking',
    description: 'Best practices and insights for call tracking and analytics',
    display_order: 1,
    parent_id: null,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z'
  },
  {
    id: 'cat-2',
    name: 'Lead Generation',
    slug: 'lead-generation', 
    description: 'Strategies and tips for generating high-quality leads',
    display_order: 2,
    parent_id: null,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z'
  },
  {
    id: 'cat-3',
    name: 'Industry Insights',
    slug: 'industry-insights',
    description: 'Market trends and industry analysis',
    display_order: 3,
    parent_id: null,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z'
  }
]

const mockTags: BlogTag[] = [
  {
    id: 'tag-1',
    name: 'Performance',
    slug: 'performance',
    created_at: '2024-01-01T10:00:00Z'
  },
  {
    id: 'tag-2',
    name: 'Analytics',
    slug: 'analytics',
    created_at: '2024-01-01T10:00:00Z'
  },
  {
    id: 'tag-3',
    name: 'Best Practices',
    slug: 'best-practices',
    created_at: '2024-01-01T10:00:00Z'
  }
]

const mockPosts: (BlogPost & { author?: BlogAuthor })[] = [
  {
    id: 'post-1',
    title: 'Optimizing Call Tracking for Maximum ROI',
    slug: 'optimizing-call-tracking-roi',
    excerpt: 'Learn how to set up your call tracking campaigns for maximum return on investment with proven strategies and best practices.',
    content: `# Optimizing Call Tracking for Maximum ROI

Call tracking is essential for understanding which marketing channels drive the highest quality leads. In this comprehensive guide, we'll explore proven strategies to maximize your return on investment.

## Key Metrics to Track

- **Call volume**: Total number of calls received
- **Call duration**: Average length of conversations
- **Conversion rate**: Percentage of calls that convert
- **Cost per call**: Total spend divided by call volume

## Best Practices

1. **Set up proper attribution** - Ensure each marketing channel has unique tracking numbers
2. **Monitor call quality** - Use call recording and scoring to improve performance
3. **Optimize for mobile** - Most calls now originate from mobile devices
4. **Track offline conversions** - Connect phone calls to actual sales

## Conclusion

By implementing these strategies, you can significantly improve your call tracking ROI and make data-driven decisions about your marketing spend.`,
    featured_image_url: null,
    status: 'published',
    author_id: 'author-1',
    published_at: '2024-01-20T10:00:00Z',
    created_at: '2024-01-18T10:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
    content_sanitized: null,
    metadata: null,
    reading_time_minutes: 5,
    search_vector: null,
    subtitle: null,
    view_count: 0,
    author: mockAuthors[0]
  },
  {
    id: 'post-2',
    title: 'The Future of Lead Generation in 2024',
    slug: 'future-lead-generation-2024',
    excerpt: 'Discover the emerging trends and technologies that will shape lead generation strategies in 2024 and beyond.',
    content: `# The Future of Lead Generation in 2024

The lead generation landscape is rapidly evolving. New technologies and changing consumer behaviors are reshaping how businesses attract and convert prospects.

## Emerging Trends

### AI-Powered Lead Scoring
Artificial intelligence is revolutionizing how we identify and prioritize high-quality leads.

### Conversational Marketing
Real-time chat and messaging platforms are becoming essential for capturing and nurturing leads.

### Privacy-First Approaches
With increasing privacy regulations, businesses must adapt their lead generation strategies.

## Key Takeaways

- Focus on quality over quantity
- Embrace new technologies while respecting privacy
- Personalize the customer journey
- Measure and optimize continuously

The future belongs to companies that can adapt quickly while maintaining trust with their audience.`,
    featured_image_url: null,
    status: 'published',
    author_id: 'author-2',
    published_at: '2024-01-25T10:00:00Z',
    created_at: '2024-01-23T10:00:00Z',
    updated_at: '2024-01-25T10:00:00Z',
    content_sanitized: null,
    metadata: null,
    reading_time_minutes: 7,
    search_vector: null,
    subtitle: null,
    view_count: 0,
    author: mockAuthors[1]
  },
  {
    id: 'post-3',
    title: 'Understanding Call Quality Metrics',
    slug: 'understanding-call-quality-metrics',
    excerpt: 'A deep dive into the metrics that matter most for measuring and improving call quality in your campaigns.',
    content: `# Understanding Call Quality Metrics

Call quality is more than just connection clarity. It encompasses everything from initial contact to final conversion, helping you optimize your entire call handling process.

## Essential Quality Metrics

### Call Duration
Longer calls often indicate higher engagement and conversion potential.

### First Call Resolution
The percentage of issues resolved on the first call.

### Customer Satisfaction Scores
Direct feedback from callers about their experience.

### Conversion Rates
The ultimate measure of call effectiveness.

## Implementing Quality Measurement

1. **Set clear benchmarks** - Establish baseline metrics for your industry
2. **Use call recording** - Review actual conversations for insights
3. **Train your team** - Regular coaching based on quality metrics
4. **Monitor in real-time** - Catch and address issues quickly

Quality metrics provide the foundation for continuous improvement in your call operations.`,
    featured_image_url: null,
    status: 'published',
    author_id: 'author-1',
    published_at: '2024-01-30T10:00:00Z',
    created_at: '2024-01-28T10:00:00Z',
    updated_at: '2024-01-30T10:00:00Z',
    content_sanitized: null,
    metadata: null,
    reading_time_minutes: 6,
    search_vector: null,
    subtitle: null,
    view_count: 0,
    author: mockAuthors[0]
  }
]

export class BlogMockDataService {
  static shouldUseMockData = shouldUseMockData()

  static async getBlogPosts(options: {
    limit?: number
    offset?: number
    status?: string
  } = {}) {
    if (!this.shouldUseMockData) {
      throw new Error('Mock data service should not be used with real database')
    }

    const { limit = 12, offset = 0, status = 'published' } = options

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200))

    let filteredPosts = mockPosts.filter(post => post.status === status)

    const paginatedPosts = filteredPosts
      .sort((a, b) => new Date(b.published_at || b.created_at || '').getTime() - new Date(a.published_at || a.created_at || '').getTime())
      .slice(offset, offset + limit)

    console.info('🔧 Blog: Using mock data for posts', { count: paginatedPosts.length })

    return {
      data: paginatedPosts,
      error: null
    }
  }

  static async getBlogCategories() {
    if (!this.shouldUseMockData) {
      throw new Error('Mock data service should not be used with real database')
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))

    console.info('🔧 Blog: Using mock data for categories', { count: mockCategories.length })

    return {
      data: mockCategories,
      error: null
    }
  }

  static async getBlogTags(options: { limit?: number } = {}) {
    if (!this.shouldUseMockData) {
      throw new Error('Mock data service should not be used with real database')
    }

    const { limit = 10 } = options

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))

    console.info('🔧 Blog: Using mock data for tags', { count: Math.min(mockTags.length, limit) })

    return {
      data: mockTags.slice(0, limit),
      error: null
    }
  }

  static async getBlogPost(slug: string) {
    if (!this.shouldUseMockData) {
      throw new Error('Mock data service should not be used with real database')
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 150))

    const post = mockPosts.find(p => p.slug === slug && p.status === 'published')

    console.info('🔧 Blog: Using mock data for post', { slug, found: !!post })

    return {
      data: post || null,
      error: post ? null : { message: 'Post not found', code: 'NOT_FOUND' }
    }
  }

  static async getBlogAuthors() {
    if (!this.shouldUseMockData) {
      throw new Error('Mock data service should not be used with real database')
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))

    console.info('🔧 Blog: Using mock data for authors', { count: mockAuthors.length })

    return {
      data: mockAuthors,
      error: null
    }
  }

  static logUsage(operation: string) {
    if (this.shouldUseMockData) {
      console.info(`🔧 BlogMockData: ${operation}`)
    }
  }
}

// Helper to determine if mock data should be used
export function shouldUseBlogMockData(): boolean {
  return BlogMockDataService.shouldUseMockData
}