import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Database } from '../src/types/database'
import type { BlogCategoryInsert, BlogTagInsert } from '../src/types/blog'

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize Supabase client with service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- VITE_SUPABASE_URL or SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Sample blog post data interface
interface SampleBlogPost {
  title: string
  subtitle?: string
  content: string
  excerpt?: string
  author_email: string
  categories: string[]
  tags: string[]
  featured_image?: string
  status: 'draft' | 'published'
  published_at?: string
  metadata?: Record<string, unknown>
}

// Sample categories
const sampleCategories: BlogCategoryInsert[] = [
  {
    name: 'Industry News',
    slug: 'industry-news',
    description: 'Latest updates and trends in the pay-per-call industry'
  },
  {
    name: 'Best Practices',
    slug: 'best-practices',
    description: 'Tips and strategies for maximizing your pay-per-call campaigns'
  },
  {
    name: 'Case Studies',
    slug: 'case-studies',
    description: 'Real-world success stories from our platform'
  },
  {
    name: 'Product Updates',
    slug: 'product-updates',
    description: 'New features and improvements to the DCE platform'
  },
  {
    name: 'Marketing Tips',
    slug: 'marketing-tips',
    description: 'Expert advice for call generation and optimization'
  }
]

// Sample tags
const sampleTags: BlogTagInsert[] = [
  { name: 'Call Tracking', slug: 'call-tracking' },
  { name: 'Lead Generation', slug: 'lead-generation' },
  { name: 'Analytics', slug: 'analytics' },
  { name: 'Fraud Prevention', slug: 'fraud-prevention' },
  { name: 'ROI Optimization', slug: 'roi-optimization' },
  { name: 'Mobile Marketing', slug: 'mobile-marketing' },
  { name: 'Compliance', slug: 'compliance' },
  { name: 'API Integration', slug: 'api-integration' },
  { name: 'Real-time Reporting', slug: 'real-time-reporting' },
  { name: 'Campaign Management', slug: 'campaign-management' }
]

// Sample blog posts
const samplePosts: SampleBlogPost[] = [
  {
    title: 'Welcome to the New DCE Blog',
    subtitle: 'Your source for pay-per-call insights and industry updates',
    content: `
# Welcome to the DCE Blog

We're excited to launch our new blog, dedicated to helping you succeed in the pay-per-call industry. Here, you'll find:

## What to Expect

### Industry Insights
Stay up-to-date with the latest trends, regulations, and opportunities in pay-per-call marketing.

### Best Practices
Learn from experts about optimizing campaigns, preventing fraud, and maximizing ROI.

### Platform Updates
Be the first to know about new features, integrations, and improvements to the DCE platform.

### Success Stories
Read case studies from successful suppliers and buyers using our platform.

## Our Commitment

We're committed to providing valuable, actionable content that helps you:
- Generate higher quality calls
- Improve conversion rates
- Reduce fraud and compliance risks
- Scale your business effectively

## Stay Connected

Subscribe to our newsletter to receive weekly updates, and follow us on social media for daily tips and insights.

*Thank you for being part of the DCE community!*
    `,
    excerpt: 'Introducing the DCE blog - your go-to resource for pay-per-call marketing insights, best practices, and platform updates.',
    author_email: 'admin@dependablecalls.com',
    categories: ['industry-news', 'product-updates'],
    tags: ['call-tracking', 'lead-generation'],
    status: 'published',
    published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
  },
  {
    title: '5 Essential Fraud Prevention Strategies for Pay-Per-Call',
    subtitle: 'Protect your campaigns and maximize legitimate conversions',
    content: `
# 5 Essential Fraud Prevention Strategies for Pay-Per-Call

Fraud prevention is crucial for maintaining profitable pay-per-call campaigns. Here are five essential strategies to protect your business:

## 1. Implement Real-Time Call Verification

Use advanced algorithms to detect suspicious patterns:
- Unusual call volumes from single sources
- Rapid, repeated calls with short durations
- Geographic anomalies in caller data

## 2. Set Up Intelligent Call Filtering

Create rules to automatically flag or block:
- Calls from known fraudulent numbers
- Patterns matching previous fraud attempts
- Suspicious caller behavior patterns

## 3. Use Multi-Factor Authentication

Verify call legitimacy through:
- IVR challenges for high-value calls
- SMS verification for new callers
- Voice biometric analysis

## 4. Monitor Campaign Performance Metrics

Watch for red flags like:
- Sudden spikes in call volume
- Dramatic drops in conversion rates
- Unusual geographic distribution changes

## 5. Leverage Machine Learning

Deploy AI-powered systems that:
- Learn from historical fraud patterns
- Adapt to new fraud techniques
- Provide real-time risk scoring

## Conclusion

By implementing these strategies, you can significantly reduce fraud while maintaining a smooth experience for legitimate callers. The DCE platform includes built-in fraud prevention tools to help you implement these best practices effectively.

*Stay tuned for our detailed guide on each strategy!*
    `,
    excerpt: 'Learn how to protect your pay-per-call campaigns from fraud with these five essential strategies, including real-time verification and AI-powered detection.',
    author_email: 'admin@dependablecalls.com',
    categories: ['best-practices'],
    tags: ['fraud-prevention', 'compliance', 'roi-optimization'],
    status: 'published',
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
  },
  {
    title: 'Real-Time Analytics: The Key to Campaign Success',
    subtitle: 'How instant insights drive better decision-making',
    content: `
# Real-Time Analytics: The Key to Campaign Success

In the fast-paced world of pay-per-call marketing, real-time analytics aren't just nice to have—they're essential for success.

## Why Real-Time Matters

### Immediate Optimization Opportunities
- Identify underperforming campaigns instantly
- Redirect budget to high-converting sources
- Catch and fix issues before they impact ROI

### Fraud Detection and Prevention
Real-time monitoring helps you:
- Spot suspicious patterns as they emerge
- Block fraudulent sources immediately
- Protect your advertising spend

## Key Metrics to Monitor

### Call Volume and Distribution
- Calls per hour/day
- Geographic distribution
- Source performance comparison

### Quality Indicators
- Average call duration
- Conversion rates by source
- Caller intent signals

### Financial Performance
- Cost per acquisition
- Revenue per call
- ROI by campaign and source

## Implementation Best Practices

1. **Set Up Custom Dashboards**: Create views tailored to your specific KPIs
2. **Configure Smart Alerts**: Get notified of anomalies or opportunities
3. **Integrate with Other Tools**: Connect analytics to your CRM and billing systems
4. **Train Your Team**: Ensure everyone understands how to use the data

## The DCE Advantage

Our platform provides:
- Sub-second data updates
- Customizable real-time dashboards
- Automated alerting and reporting
- API access for custom integrations

*Ready to supercharge your campaigns with real-time insights? Contact us for a demo!*
    `,
    excerpt: 'Discover how real-time analytics can transform your pay-per-call campaigns, from instant optimization to fraud prevention.',
    author_email: 'admin@dependablecalls.com',
    categories: ['best-practices', 'product-updates'],
    tags: ['analytics', 'real-time-reporting', 'campaign-management'],
    status: 'published',
    published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
  },
  {
    title: 'Mobile-First Strategies for Call Generation',
    subtitle: 'Optimizing for the smartphone era',
    content: `
# Mobile-First Strategies for Call Generation

With over 60% of calls now originating from mobile devices, a mobile-first approach is critical for pay-per-call success.

## Understanding Mobile User Behavior

### The Mobile Mindset
- Users expect instant connection
- Click-to-call is the preferred action
- Speed and simplicity drive conversions

### Key Mobile Metrics
- Page load time (aim for under 3 seconds)
- Click-to-call conversion rate
- Mobile vs. desktop performance

## Optimization Strategies

### 1. Streamline Your Landing Pages
- Single-column layouts
- Large, thumb-friendly buttons
- Minimal form fields
- Clear value propositions

### 2. Implement Click-to-Call Effectively
\`\`\`html
<a href="tel:+18005551234" class="cta-button">
  Call Now: (800) 555-1234
</a>
\`\`\`

### 3. Use Mobile-Specific Features
- GPS for local targeting
- Device detection for customization
- Mobile-optimized tracking parameters

### 4. Test Across Devices
- Various screen sizes
- Different operating systems
- Multiple browsers
- Network conditions

## Advanced Techniques

### Dynamic Number Insertion
Automatically display local numbers based on caller location for higher answer rates.

### Progressive Web Apps (PWA)
Create app-like experiences without app store requirements.

### Voice Search Optimization
Prepare for the growing trend of voice-initiated calls.

## Measuring Success

Track these mobile-specific KPIs:
- Mobile conversion rate
- Average mobile call duration
- Cost per mobile acquisition
- Mobile traffic quality scores

*Need help implementing mobile-first strategies? Our platform includes all the tools you need for mobile optimization.*
    `,
    excerpt: 'Learn how to optimize your pay-per-call campaigns for mobile users with strategies that drive higher conversion rates and better call quality.',
    author_email: 'admin@dependablecalls.com',
    categories: ['marketing-tips', 'best-practices'],
    tags: ['mobile-marketing', 'lead-generation', 'campaign-management'],
    status: 'published',
    published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
  },
  {
    title: 'API Integration Guide: Connecting Your Systems',
    subtitle: 'Step-by-step integration with the DCE platform',
    content: `
# API Integration Guide: Connecting Your Systems

Seamlessly integrate the DCE platform with your existing tools and workflows using our comprehensive API.

## Getting Started

### Authentication
All API requests require authentication using your API key:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.dependablecalls.com/v1/calls
\`\`\`

### Base URL
All API endpoints start with: \`https://api.dependablecalls.com/v1/\`

## Core Endpoints

### Call Tracking
\`\`\`javascript
// Get call details
GET /calls/:id

// List calls with filters
GET /calls?start_date=2024-01-01&status=completed

// Update call metadata
PATCH /calls/:id
\`\`\`

### Campaign Management
\`\`\`javascript
// Create campaign
POST /campaigns

// Update campaign settings
PUT /campaigns/:id

// Get campaign statistics
GET /campaigns/:id/stats
\`\`\`

### Real-Time Webhooks
Configure webhooks for instant notifications:

\`\`\`json
{
  "url": "https://your-domain.com/webhook",
  "events": ["call.started", "call.completed", "call.converted"],
  "secret": "your-webhook-secret"
}
\`\`\`

## Integration Examples

### CRM Integration
\`\`\`python
import requests

def sync_call_to_crm(call_data):
    # Map DCE call data to CRM format
    crm_lead = {
        "phone": call_data["caller_number"],
        "source": call_data["campaign_name"],
        "duration": call_data["duration"],
        "recording_url": call_data["recording_url"]
    }
    
    # Send to CRM
    crm_response = requests.post(
        "https://your-crm.com/api/leads",
        json=crm_lead,
        headers={"Authorization": "Bearer CRM_TOKEN"}
    )
    
    return crm_response.json()
\`\`\`

### Analytics Platform Integration
\`\`\`javascript
// Send conversion data to analytics
function trackConversion(callData) {
  gtag('event', 'call_conversion', {
    'value': callData.payout,
    'currency': 'USD',
    'transaction_id': callData.id,
    'campaign': callData.campaign_name
  });
}
\`\`\`

## Best Practices

1. **Rate Limiting**: Respect our rate limits (1000 requests/hour)
2. **Error Handling**: Implement retry logic with exponential backoff
3. **Data Validation**: Validate all inputs before sending
4. **Security**: Never expose API keys in client-side code

## SDKs and Libraries

We provide official SDKs for:
- JavaScript/TypeScript
- Python
- PHP
- Ruby
- Go

*Visit our [Developer Portal](https://developers.dependablecalls.com) for complete API documentation and interactive examples.*
    `,
    excerpt: 'Complete guide to integrating your systems with the DCE platform API, including authentication, endpoints, and real-world examples.',
    author_email: 'admin@dependablecalls.com',
    categories: ['product-updates', 'best-practices'],
    tags: ['api-integration', 'real-time-reporting'],
    status: 'published',
    published_at: new Date().toISOString() // Today
  }
]

// Helper function to create a slug
function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Main seeding function
async function seedBlogContent() {
  try {
    console.log('🌱 Starting blog content seeding...\n')

    // Step 1: Create authors
    console.log('Creating authors...')
    const adminEmail = 'admin@dependablecalls.com'
    
    // Check if admin author exists
    const { data: existingAuthor } = await supabase
      .from('blog_authors')
      .select('id')
      .eq('email', adminEmail)
      .single()

    let authorId: string
    
    if (existingAuthor) {
      console.log('Admin author already exists')
      authorId = existingAuthor.id
    } else {
      const { data: author, error: authorError } = await supabase
        .from('blog_authors')
        .insert({
          email: adminEmail,
          name: 'DCE Team',
          bio: 'The official blog of Dependable Calls Exchange - your trusted pay-per-call platform.',
          avatar_url: '/images/team-avatar.jpg',
          social_links: {
            twitter: 'https://twitter.com/dependablecalls',
            linkedin: 'https://linkedin.com/company/dependablecalls'
          }
        })
        .select()
        .single()

      if (authorError) {
        console.error('Error creating author:', authorError)
        return
      }

      console.log('✅ Created author:', author.name)
      authorId = author.id
    }

    // Step 2: Create categories
    console.log('\nCreating categories...')
    const categoryMap = new Map<string, string>()
    
    for (const category of sampleCategories) {
      const { data: existingCategory } = await supabase
        .from('blog_categories')
        .select('id')
        .eq('slug', category.slug)
        .single()

      if (existingCategory) {
        console.log(`Category "${category.name}" already exists`)
        categoryMap.set(category.slug, existingCategory.id)
      } else {
        const { data, error } = await supabase
          .from('blog_categories')
          .insert(category)
          .select()
          .single()

        if (error) {
          console.error(`Error creating category "${category.name}":`, error)
          continue
        }

        console.log(`✅ Created category: ${category.name}`)
        categoryMap.set(category.slug, data.id)
      }
    }

    // Step 3: Create tags
    console.log('\nCreating tags...')
    const tagMap = new Map<string, string>()
    
    for (const tag of sampleTags) {
      const { data: existingTag } = await supabase
        .from('blog_tags')
        .select('id')
        .eq('slug', tag.slug)
        .single()

      if (existingTag) {
        console.log(`Tag "${tag.name}" already exists`)
        tagMap.set(tag.slug, existingTag.id)
      } else {
        const { data, error } = await supabase
          .from('blog_tags')
          .insert(tag)
          .select()
          .single()

        if (error) {
          console.error(`Error creating tag "${tag.name}":`, error)
          continue
        }

        console.log(`✅ Created tag: ${tag.name}`)
        tagMap.set(tag.slug, data.id)
      }
    }

    // Step 4: Create blog posts
    console.log('\nCreating blog posts...')
    
    // Read posts from JSON file if it exists
    const jsonPath = join(__dirname, '../data/blog-posts.json')
    let postsToCreate = samplePosts
    
    if (existsSync(jsonPath)) {
      console.log('Found blog-posts.json, loading additional posts...')
      try {
        const jsonContent = readFileSync(jsonPath, 'utf-8')
        const jsonPosts = JSON.parse(jsonContent) as SampleBlogPost[]
        postsToCreate = [...samplePosts, ...jsonPosts]
        console.log(`Loaded ${jsonPosts.length} additional posts from JSON`)
      } catch (error) {
        console.warn('Error reading blog-posts.json:', error)
      }
    }

    for (const post of postsToCreate) {
      const slug = createSlug(post.title)
      
      // Check if post already exists
      const { data: existingPost } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', slug)
        .single()

      if (existingPost) {
        console.log(`Post "${post.title}" already exists`)
        continue
      }

      // Create the post (content will be automatically sanitized by the trigger)
      const { data: newPost, error: postError } = await supabase
        .from('blog_posts')
        .insert({
          title: post.title,
          subtitle: post.subtitle,
          content: post.content,
          excerpt: post.excerpt,
          slug,
          author_id: authorId,
          status: post.status,
          published_at: post.published_at,
          metadata: post.metadata || {},
          featured_image_url: null // Will be updated after image upload
        })
        .select()
        .single()

      if (postError) {
        console.error(`Error creating post "${post.title}":`, postError)
        continue
      }

      console.log(`✅ Created post: ${post.title}`)

      // Associate categories
      for (const categorySlug of post.categories) {
        const categoryId = categoryMap.get(categorySlug)
        if (categoryId) {
          await supabase
            .from('blog_post_categories')
            .insert({
              post_id: newPost.id,
              category_id: categoryId
            })
        }
      }

      // Associate tags
      for (const tagSlug of post.tags) {
        const tagId = tagMap.get(tagSlug)
        if (tagId) {
          await supabase
            .from('blog_post_tags')
            .insert({
              post_id: newPost.id,
              tag_id: tagId
            })
        }
      }

      // Handle featured image if specified
      if (post.featured_image) {
        const imagePath = join(__dirname, '../data/images', post.featured_image)
        
        if (existsSync(imagePath)) {
          try {
            const imageData = readFileSync(imagePath)
            const storagePath = `posts/${newPost.id}/featured.jpg`
            
            // Upload to storage
            const { error: uploadError } = await supabase.storage
              .from('blog-images')
              .upload(storagePath, imageData, {
                contentType: 'image/jpeg',
                upsert: true
              })

            if (uploadError) {
              console.error(`Failed to upload image for "${post.title}":`, uploadError)
            } else {
              // Create signed URL (1 year expiry)
              const { data: urlData } = await supabase.storage
                .from('blog-images')
                .createSignedUrl(storagePath, 31536000)

              if (urlData?.signedUrl) {
                // Update post with signed URL
                await supabase
                  .from('blog_posts')
                  .update({ featured_image_url: urlData.signedUrl })
                  .eq('id', newPost.id)
                
                console.log(`  📷 Uploaded featured image`)
              }
            }
          } catch {
            console.warn(`  ⚠️  Could not upload image: ${post.featured_image}`)
          }
        } else {
          console.log(`  ℹ️  Featured image not found: ${post.featured_image}`)
        }
      }
    }

    console.log('\n✨ Blog content seeding completed!')
    
    // Display summary
    const { count: postCount } = await supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
    
    const { count: categoryCount } = await supabase
      .from('blog_categories')
      .select('*', { count: 'exact', head: true })
    
    const { count: tagCount } = await supabase
      .from('blog_tags')
      .select('*', { count: 'exact', head: true })

    console.log('\n📊 Summary:')
    console.log(`- Posts: ${postCount || 0}`)
    console.log(`- Categories: ${categoryCount || 0}`)
    console.log(`- Tags: ${tagCount || 0}`)

  } catch (error) {
    console.error('Error seeding blog content:', error)
    process.exit(1)
  }
}

// Run the seeding
seedBlogContent()