import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

// Test configuration
const TEST_TIMEOUT = 30000 // 30 seconds
const RATE_LIMIT_REQUESTS = 35
// const RATE_LIMIT_WINDOW = 60000 // 1 minute

test.describe('Blog Integration Tests', () => {
  let supabase: ReturnType<typeof createClient<Database>>
  
  test.beforeAll(async () => {
    // Initialize Supabase client with anon key for public access testing
    supabase = createClient<Database>(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    )
  })

  test.describe('RLS (Row Level Security) Policies', () => {
    test('should only show published posts to anonymous users', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT)
      
      // Navigate to blog page
      await page.goto('/blog')
      
      // Wait for posts to load
      await page.waitForSelector('[data-testid="blog-post-item"]', { 
        timeout: 10000,
        state: 'visible' 
      })
      
      // Count visible posts on the page
      const visiblePosts = await page.locator('[data-testid="blog-post-item"]').count()
      
      // Query database directly to verify count
      const { count } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
      
      // Verify counts match (page might be paginated, so check if visible <= total)
      expect(visiblePosts).toBeGreaterThan(0)
      expect(visiblePosts).toBeLessThanOrEqual(count || 0)
      
      // Verify no draft or archived posts are visible
      const postTitles = await page.locator('[data-testid="blog-post-title"]').allTextContents()
      
      // Query for non-published posts
      const { data: nonPublishedPosts } = await supabase
        .from('blog_posts')
        .select('title')
        .in('status', ['draft', 'archived'])
      
      // Ensure no non-published post titles appear on the page
      const nonPublishedTitles = nonPublishedPosts?.map(p => p.title) || []
      for (const title of nonPublishedTitles) {
        expect(postTitles).not.toContain(title)
      }
    })

    test('should enforce author visibility for unpublished posts', async ({ page }) => {
      // Try to access a draft post directly (should fail for anonymous users)
      const { data: draftPost } = await supabase
        .from('blog_posts')
        .select('slug')
        .eq('status', 'draft')
        .limit(1)
        .single()
      
      if (draftPost) {
        const response = await page.goto(`/blog/${draftPost.slug}`)
        
        // Should either return 404 or redirect to blog listing
        expect(response?.status()).toBe(404)
        // Or check if redirected
        const currentUrl = page.url()
        expect(currentUrl).not.toContain(draftPost.slug)
      }
    })

    test('should allow reading published comments only', async ({ page }) => {
      // Find a published post with comments
      const { data: postWithComments } = await supabase
        .from('blog_posts')
        .select('slug')
        .eq('status', 'published')
        .limit(1)
        .single()
      
      if (postWithComments) {
        await page.goto(`/blog/${postWithComments.slug}`)
        
        // Check if comments section exists
        const commentsSection = page.locator('[data-testid="comments-section"]')
        const hasComments = await commentsSection.isVisible().catch(() => false)
        
        if (hasComments) {
          // Count visible comments
          const visibleComments = await page.locator('[data-testid="comment-item"]').count()
          
          // Get approved comments from database
          const { data: approvedComments } = await supabase
            .from('blog_comments')
            .select('*')
            .eq('post_id', postWithComments.slug)
            .eq('status', 'approved')
          
          // Verify only approved comments are shown
          expect(visibleComments).toBe(approvedComments?.length || 0)
        }
      }
    })
  })

  test.describe('Rate Limiting', () => {
    test('should enforce rate limiting after threshold', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT * 2) // Extended timeout for rate limit testing
      
      const requests: Promise<Response | null>[] = []
      
      // Make rapid requests to trigger rate limiting
      for (let i = 0; i < RATE_LIMIT_REQUESTS; i++) {
        requests.push(page.goto('/blog', { waitUntil: 'domcontentloaded' }))
      }
      
      const responses = await Promise.allSettled(requests)
      
      // Count successful and rate-limited responses
      let successCount = 0
      let rateLimitedCount = 0
      
      responses.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          const status = result.value.status()
          if (status === 200) {
            successCount++
          } else if (status === 429) {
            rateLimitedCount++
          }
        }
      })
      
      // Verify rate limiting kicked in
      expect(rateLimitedCount).toBeGreaterThan(0)
      expect(successCount).toBeGreaterThan(0)
      expect(successCount).toBeLessThan(RATE_LIMIT_REQUESTS)
    })

    test('should include rate limit headers', async ({ page }) => {
      const response = await page.goto('/blog')
      const headers = response?.headers() || {}
      
      // Check for rate limit headers
      expect(headers).toHaveProperty('x-ratelimit-limit')
      expect(headers).toHaveProperty('x-ratelimit-remaining')
      expect(headers).toHaveProperty('x-ratelimit-reset')
    })
  })

  test.describe('Security Headers', () => {
    test('should have all required security headers', async ({ page }) => {
      const response = await page.goto('/blog')
      const headers = response?.headers() || {}
      
      // Check critical security headers
      expect(headers['x-frame-options']).toBe('DENY')
      expect(headers['x-content-type-options']).toBe('nosniff')
      expect(headers['x-xss-protection']).toBe('1; mode=block')
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(headers['strict-transport-security']).toContain('max-age=31536000')
      
      // Check CSP header exists and has required directives
      const csp = headers['content-security-policy']
      expect(csp).toBeDefined()
      expect(csp).toContain("default-src 'none'")
      expect(csp).toContain("script-src 'self'")
      expect(csp).toContain("style-src 'self'")
      expect(csp).toContain("img-src 'self' data: https: blob:")
      expect(csp).toContain("frame-ancestors 'none'")
      expect(csp).toContain('upgrade-insecure-requests')
      
      // Check additional security headers
      expect(headers['cross-origin-embedder-policy']).toBe('credentialless')
      expect(headers['cross-origin-opener-policy']).toBe('same-origin')
      expect(headers['cross-origin-resource-policy']).toBe('same-origin')
    })

    test('should have proper CORS headers for API endpoints', async ({ request }) => {
      const response = await request.get('/api/blog/posts')
      const headers = response.headers()
      
      // API should have strict CORS
      expect(headers['access-control-allow-origin']).toBeUndefined()
      expect(headers['x-content-type-options']).toBe('nosniff')
    })
  })

  test.describe('Blog API Endpoints', () => {
    test('GET /api/blog/posts should return paginated posts', async ({ request }) => {
      const response = await request.get('/api/blog/posts')
      expect(response.ok()).toBeTruthy()
      
      const data = await response.json()
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('meta')
      expect(data.meta).toHaveProperty('page')
      expect(data.meta).toHaveProperty('limit')
      expect(data.meta).toHaveProperty('total')
      expect(data.meta).toHaveProperty('totalPages')
      
      // Verify all posts are published
      if (data.data.length > 0) {
        data.data.forEach((post: { status: string }) => {
          expect(post.status).toBe('published')
        })
      }
    })

    test('GET /api/blog/posts with filters', async ({ request }) => {
      // Test search filter
      const searchResponse = await request.get('/api/blog/posts?search=test')
      expect(searchResponse.ok()).toBeTruthy()
      
      const searchData = await searchResponse.json()
      expect(searchData.data).toBeDefined()
      
      // Test pagination
      const pageResponse = await request.get('/api/blog/posts?page=2&limit=5')
      expect(pageResponse.ok()).toBeTruthy()
      
      const pageData = await pageResponse.json()
      expect(pageData.meta.page).toBe(2)
      expect(pageData.meta.limit).toBe(5)
    })

    test('GET /api/blog/posts/:slug should return single post', async ({ request }) => {
      // Get a published post
      const { data: post } = await supabase
        .from('blog_posts')
        .select('slug')
        .eq('status', 'published')
        .limit(1)
        .single()
      
      if (post) {
        const response = await request.get(`/api/blog/posts/${post.slug}`)
        expect(response.ok()).toBeTruthy()
        
        const data = await response.json()
        expect(data).toHaveProperty('post')
        expect(data.post.slug).toBe(post.slug)
        expect(data.post.status).toBe('published')
      }
    })

    test('GET /api/blog/categories should return all categories', async ({ request }) => {
      const response = await request.get('/api/blog/categories')
      expect(response.ok()).toBeTruthy()
      
      const categories = await response.json()
      expect(Array.isArray(categories)).toBeTruthy()
      
      // Verify category structure
      if (categories.length > 0) {
        expect(categories[0]).toHaveProperty('id')
        expect(categories[0]).toHaveProperty('name')
        expect(categories[0]).toHaveProperty('slug')
      }
    })

    test('GET /api/blog/tags should return all tags', async ({ request }) => {
      const response = await request.get('/api/blog/tags')
      expect(response.ok()).toBeTruthy()
      
      const tags = await response.json()
      expect(Array.isArray(tags)).toBeTruthy()
      
      // Verify tag structure
      if (tags.length > 0) {
        expect(tags[0]).toHaveProperty('id')
        expect(tags[0]).toHaveProperty('name')
        expect(tags[0]).toHaveProperty('slug')
      }
    })

    test('POST /api/blog/comments should require authentication', async ({ request }) => {
      const response = await request.post('/api/blog/comments', {
        data: {
          post_id: 'test-post',
          content: 'Test comment'
        }
      })
      
      // Should return 401 or 403 for unauthenticated requests
      expect([401, 403]).toContain(response.status())
    })
  })

  test.describe('Search Functionality', () => {
    test('should search posts by title and content', async ({ page }) => {
      await page.goto('/blog')
      
      // Wait for search input
      const searchInput = page.locator('[data-testid="blog-search-input"]')
      await searchInput.waitFor({ state: 'visible' })
      
      // Perform search
      await searchInput.fill('test search query')
      await searchInput.press('Enter')
      
      // Wait for search results
      await page.waitForTimeout(1000) // Allow debouncing
      
      // Verify URL updated with search params
      expect(page.url()).toContain('search=test+search+query')
      
      // Check that results are filtered (or no results message appears)
      const hasResults = await page.locator('[data-testid="blog-post-item"]').count() > 0
      const hasNoResults = await page.locator('[data-testid="no-results-message"]').isVisible()
      
      expect(hasResults || hasNoResults).toBeTruthy()
    })

    test('should filter posts by category', async ({ page }) => {
      await page.goto('/blog')
      
      // Check if category filter exists
      const categoryFilter = page.locator('[data-testid="category-filter"]')
      const hasCategoryFilter = await categoryFilter.isVisible().catch(() => false)
      
      if (hasCategoryFilter) {
        // Get first category option
        const firstCategory = categoryFilter.locator('option').nth(1)
        const categoryValue = await firstCategory.getAttribute('value')
        
        if (categoryValue) {
          // Select category
          await categoryFilter.selectOption(categoryValue)
          
          // Wait for filtered results
          await page.waitForTimeout(500)
          
          // Verify URL updated
          expect(page.url()).toContain('category=')
        }
      }
    })

    test('should filter posts by tag', async ({ page }) => {
      await page.goto('/blog')
      
      // Check if tags are displayed
      const tagElements = page.locator('[data-testid="tag-filter-item"]')
      const hasTags = await tagElements.count() > 0
      
      if (hasTags) {
        // Click first tag
        await tagElements.first().click()
        
        // Wait for filtered results
        await page.waitForTimeout(500)
        
        // Verify URL updated
        expect(page.url()).toContain('tag=')
      }
    })
  })

  test.describe('Performance and SEO', () => {
    test('should have proper meta tags for SEO', async ({ page }) => {
      await page.goto('/blog')
      
      // Check basic meta tags
      const title = await page.title()
      expect(title).toContain('Blog')
      
      const description = await page.getAttribute('meta[name="description"]', 'content')
      expect(description).toBeTruthy()
      
      // Check Open Graph tags
      const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content')
      expect(ogTitle).toBeTruthy()
      
      const ogDescription = await page.getAttribute('meta[property="og:description"]', 'content')
      expect(ogDescription).toBeTruthy()
      
      const ogImage = await page.getAttribute('meta[property="og:image"]', 'content')
      expect(ogImage).toBeTruthy()
    })

    test('should have proper structured data for blog posts', async ({ page }) => {
      // Get a published post
      const { data: post } = await supabase
        .from('blog_posts')
        .select('slug')
        .eq('status', 'published')
        .limit(1)
        .single()
      
      if (post) {
        await page.goto(`/blog/${post.slug}`)
        
        // Check for JSON-LD structured data
        const structuredData = await page.locator('script[type="application/ld+json"]').textContent()
        expect(structuredData).toBeTruthy()
        
        const jsonLd = JSON.parse(structuredData!)
        expect(jsonLd['@type']).toContain('Article')
        expect(jsonLd).toHaveProperty('headline')
        expect(jsonLd).toHaveProperty('datePublished')
        expect(jsonLd).toHaveProperty('author')
      }
    })

    test('should lazy load images', async ({ page }) => {
      await page.goto('/blog')
      
      // Check for lazy loading attributes on images
      const images = page.locator('img[data-testid="blog-post-image"]')
      const imageCount = await images.count()
      
      if (imageCount > 0) {
        const firstImage = images.first()
        const loading = await firstImage.getAttribute('loading')
        expect(loading).toBe('lazy')
      }
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/blog')
      
      // Check main blog section
      const mainSection = page.locator('main')
      await expect(mainSection).toHaveAttribute('role', 'main')
      
      // Check navigation
      const nav = page.locator('nav[aria-label="Blog navigation"]')
      await expect(nav).toBeVisible()
      
      // Check article elements
      const articles = page.locator('article')
      const articleCount = await articles.count()
      
      if (articleCount > 0) {
        const firstArticle = articles.first()
        await expect(firstArticle).toHaveAttribute('role', 'article')
      }
    })

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/blog')
      
      // Tab through interactive elements
      await page.keyboard.press('Tab')
      
      // Check if focused element is visible
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
      
      // Continue tabbing and verify focus moves through posts
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
        const currentFocus = page.locator(':focus')
        await expect(currentFocus).toBeVisible()
      }
    })
  })
})