import { z } from 'zod';
import { BlogService } from '../services/blog.service';
import type { 
  BlogPost, 
  BlogCategory, 
  BlogAuthor,
  GetBlogPostsParams 
} from '../types/blog';
import { DEFAULT_SEO_CONFIG } from './blog-seo';

/**
 * Blog Sitemap Generation Utilities
 * 
 * Generates SEO-optimized XML sitemaps for blog content including:
 * - Blog posts with priority and change frequency calculation
 * - Category pages with content freshness tracking
 * - Author pages with publication activity
 * - Image sitemaps for featured images
 * - Sitemap index for large content sets (>50k URLs)
 * - Multilingual support (future-ready)
 * - Automatic search engine submission
 */

// Configuration and validation schemas
export const sitemapConfigSchema = z.object({
  baseUrl: z.string().url(),
  maxUrlsPerSitemap: z.number().min(1).max(50000).default(45000),
  defaultChangeFreq: z.enum(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']).default('weekly'),
  defaultPriority: z.number().min(0).max(1).default(0.5),
  includeImages: z.boolean().default(true),
  includeLastmod: z.boolean().default(true),
  enableCompression: z.boolean().default(true),
  cacheTtlMinutes: z.number().min(1).default(60),
  searchEngineSubmission: z.object({
    enabled: z.boolean().default(false),
    endpoints: z.array(z.string().url()).default([])
  }).default({})
});

export type SitemapConfig = z.infer<typeof sitemapConfigSchema>;

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  images?: SitemapImage[];
  alternates?: SitemapAlternate[];
}

export interface SitemapImage {
  loc: string;
  caption?: string;
  geo_location?: string;
  title?: string;
  license?: string;
}

export interface SitemapAlternate {
  hreflang: string;
  href: string;
}

export interface SitemapIndex {
  sitemaps: Array<{
    loc: string;
    lastmod?: string;
  }>;
}

export interface SitemapGenerationResult {
  sitemaps: Array<{
    filename: string;
    content: string;
    urlCount: number;
    lastmod: string;
  }>;
  sitemapIndex?: {
    filename: string;
    content: string;
    sitemapCount: number;
  };
  stats: {
    totalUrls: number;
    totalSitemaps: number;
    generationTime: number;
    cacheHit: boolean;
  };
  errors: string[];
}

// Default configuration for DCE Blog
export const DEFAULT_SITEMAP_CONFIG: SitemapConfig = sitemapConfigSchema.parse({
  baseUrl: DEFAULT_SEO_CONFIG.siteUrl,
  maxUrlsPerSitemap: 45000,
  defaultChangeFreq: 'weekly',
  defaultPriority: 0.5,
  includeImages: true,
  includeLastmod: true,
  enableCompression: false,
  cacheTtlMinutes: 60,
  searchEngineSubmission: {
    enabled: false,
    endpoints: []
  }
});

/**
 * Blog Sitemap Generator
 * 
 * Generates comprehensive XML sitemaps for blog content with intelligent
 * priority and change frequency calculation based on content metrics.
 */
export class BlogSitemapGenerator {
  private config: SitemapConfig;
  private cache: Map<string, { data: string; timestamp: number; ttl: number }> = new Map();

  constructor(config: Partial<SitemapConfig> = {}) {
    this.config = sitemapConfigSchema.parse({
      ...DEFAULT_SITEMAP_CONFIG,
      ...config
    });
  }

  /**
   * Generate complete blog sitemap with all content types
   */
  async generateBlogSitemap(): Promise<SitemapGenerationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    try {
      // Check cache first
      const cacheKey = 'blog_sitemap_complete';
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return { ...cached, stats: { ...cached.stats, cacheHit: true } };
      }

      // Generate all URL sets
      const [blogUrls, postUrls, categoryUrls, authorUrls, tagUrls] = await Promise.all([
        this.generateBlogIndexUrls(),
        this.generateBlogPostUrls(),
        this.generateCategoryUrls(),
        this.generateAuthorUrls(),
        this.generateTagUrls()
      ]);

      // Combine all URLs
      const allUrls = [
        ...blogUrls,
        ...postUrls,
        ...categoryUrls,
        ...authorUrls,
        ...tagUrls
      ];

      // Validate URLs
      const validatedUrls = this.validateUrls(allUrls, errors);

      // Split into sitemaps if needed
      const sitemaps = this.splitIntoSitemaps(validatedUrls);
      
      // Generate sitemap index if multiple sitemaps
      const sitemapIndex = sitemaps.length > 1 ? this.generateSitemapIndex(sitemaps) : undefined;

      const result: SitemapGenerationResult = {
        sitemaps,
        sitemapIndex,
        stats: {
          totalUrls: validatedUrls.length,
          totalSitemaps: sitemaps.length,
          generationTime: Date.now() - startTime,
          cacheHit: false
        },
        errors
      };

      // Cache the result
      this.setCachedResult(cacheKey, result);

      return result;
    } catch (error) {
      errors.push(`Sitemap generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        sitemaps: [],
        stats: {
          totalUrls: 0,
          totalSitemaps: 0,
          generationTime: Date.now() - startTime,
          cacheHit: false
        },
        errors
      };
    }
  }

  /**
   * Generate URLs for blog index and main blog pages
   */
  private async generateBlogIndexUrls(): Promise<SitemapUrl[]> {
    const urls: SitemapUrl[] = [];

    // Blog index page
    urls.push({
      loc: this.buildUrl('/blog'),
      changefreq: 'daily',
      priority: 0.8,
      lastmod: new Date().toISOString()
    });

    return urls;
  }

  /**
   * Generate URLs for all published blog posts
   */
  private async generateBlogPostUrls(): Promise<SitemapUrl[]> {
    const urls: SitemapUrl[] = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;

    try {
      while (hasMore) {
        const params: GetBlogPostsParams = {
          page,
          limit,
          filters: { status: 'published' },
          sort: { by: 'published_at', order: 'desc' },
          includeAuthor: true,
          includeCategories: true,
          includeTags: false
        };

        const response = await BlogService.getPosts(params);
        
        if (!response.data || response.data.length === 0) {
          hasMore = false;
          break;
        }

        for (const post of response.data) {
          const url = this.generatePostUrl(post);
          if (url) {
            urls.push(url);
          }
        }

        hasMore = response.meta.hasNextPage;
        page++;
      }
    } catch (error) {
      console.error('Error generating blog post URLs:', error);
    }

    return urls;
  }

  /**
   * Generate URL for a single blog post
   */
  private generatePostUrl(post: BlogPost): SitemapUrl | null {
    if (!post.slug) return null;

    const url: SitemapUrl = {
      loc: this.buildUrl(`/blog/post/${post.slug}`),
      lastmod: post.updated_at || post.published_at || post.created_at,
      changefreq: this.calculatePostChangeFreq(post),
      priority: this.calculatePostPriority(post)
    };

    // Add featured image if available and images are enabled
    if (this.config.includeImages && post.featured_image_url) {
      url.images = [{
        loc: post.featured_image_url,
        caption: post.excerpt || post.title,
        title: post.title
      }];
    }

    return url;
  }

  /**
   * Generate URLs for blog categories
   */
  private async generateCategoryUrls(): Promise<SitemapUrl[]> {
    const urls: SitemapUrl[] = [];

    try {
      const categories = await BlogService.getCategories();

      for (const category of categories) {
        if (!category.slug) continue;

        // Get latest post in category to determine lastmod
        const categoryPosts = await BlogService.getPosts({
          page: 1,
          limit: 1,
          filters: { categorySlug: category.slug, status: 'published' },
          sort: { by: 'published_at', order: 'desc' }
        });

        const latestPostDate = categoryPosts.data?.[0]?.published_at;

        urls.push({
          loc: this.buildUrl(`/blog/category/${category.slug}`),
          lastmod: latestPostDate || category.updated_at || category.created_at,
          changefreq: this.calculateCategoryChangeFreq(category, categoryPosts.meta.total),
          priority: this.calculateCategoryPriority(category, categoryPosts.meta.total)
        });
      }
    } catch (error) {
      console.error('Error generating category URLs:', error);
    }

    return urls;
  }

  /**
   * Generate URLs for blog authors
   */
  private async generateAuthorUrls(): Promise<SitemapUrl[]> {
    const urls: SitemapUrl[] = [];

    try {
      // Get all authors who have published posts
      // Note: This would need a method in BlogService to get authors with post counts
      // For now, we'll get authors from recent posts
      const recentPosts = await BlogService.getPosts({
        page: 1,
        limit: 100,
        filters: { status: 'published' },
        includeAuthor: true
      });

      const authorMap = new Map<string, BlogAuthor>();
      const authorLastPost = new Map<string, string>();

      for (const post of recentPosts.data) {
        if (post.author && post.author.slug) {
          authorMap.set(post.author.id, post.author);
          if (!authorLastPost.has(post.author.id) || 
              (post.published_at && post.published_at > (authorLastPost.get(post.author.id) || ''))) {
            authorLastPost.set(post.author.id, post.published_at || '');
          }
        }
      }

      for (const [authorId, author] of authorMap) {
        if (!author.slug) continue;

        urls.push({
          loc: this.buildUrl(`/blog/author/${author.slug}`),
          lastmod: authorLastPost.get(authorId) || author.updated_at || author.created_at,
          changefreq: 'monthly',
          priority: 0.6
        });
      }
    } catch (error) {
      console.error('Error generating author URLs:', error);
    }

    return urls;
  }

  /**
   * Generate URLs for blog tags (if tag pages exist)
   */
  private async generateTagUrls(): Promise<SitemapUrl[]> {
    const urls: SitemapUrl[] = [];

    try {
      const tags = await BlogService.getTags();

      for (const tag of tags) {
        if (!tag.slug) continue;

        // Get latest post with this tag
        const tagPosts = await BlogService.getPosts({
          page: 1,
          limit: 1,
          filters: { tagSlug: tag.slug, status: 'published' },
          sort: { by: 'published_at', order: 'desc' }
        });

        const latestPostDate = tagPosts.data?.[0]?.published_at;

        urls.push({
          loc: this.buildUrl(`/blog/tag/${tag.slug}`),
          lastmod: latestPostDate || tag.updated_at || tag.created_at,
          changefreq: 'monthly',
          priority: 0.4
        });
      }
    } catch {
      // Log error handling could be added here if needed
      // console.error('Error generating tag URLs:', error);
    }

    return urls;
  }

  /**
   * Calculate change frequency for blog posts based on activity
   */
  private calculatePostChangeFreq(post: BlogPost): SitemapUrl['changefreq'] {
    if (!post.published_at) return 'monthly';

    const publishedDate = new Date(post.published_at);
    const now = new Date();
    const daysSincePublished = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));

    // Recent posts might be updated more frequently
    if (daysSincePublished <= 7) return 'daily';
    if (daysSincePublished <= 30) return 'weekly';
    if (daysSincePublished <= 90) return 'monthly';
    
    return 'yearly';
  }

  /**
   * Calculate priority for blog posts based on metrics
   */
  private calculatePostPriority(post: BlogPost): number {
    let priority = 0.6; // Base priority for blog posts

    // Boost for high view count
    if (post.view_count && post.view_count > 1000) priority += 0.1;
    if (post.view_count && post.view_count > 5000) priority += 0.1;

    // Boost for recent posts
    if (post.published_at) {
      const publishedDate = new Date(post.published_at);
      const daysSincePublished = Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSincePublished <= 7) priority += 0.1;
      if (daysSincePublished <= 30) priority += 0.05;
    }

    // Boost for posts with featured images
    if (post.featured_image_url) priority += 0.05;

    // Cap at 1.0
    return Math.min(priority, 1.0);
  }

  /**
   * Calculate change frequency for categories based on activity
   */
  private calculateCategoryChangeFreq(category: BlogCategory, postCount: number): SitemapUrl['changefreq'] {
    if (postCount > 50) return 'daily';
    if (postCount > 20) return 'weekly';
    if (postCount > 5) return 'monthly';
    
    return 'yearly';
  }

  /**
   * Calculate priority for categories based on post count
   */
  private calculateCategoryPriority(category: BlogCategory, postCount: number): number {
    let priority = 0.7; // Base priority for categories

    // Boost for categories with more posts
    if (postCount > 20) priority += 0.1;
    if (postCount > 50) priority += 0.1;

    return Math.min(priority, 1.0);
  }

  /**
   * Validate URLs and filter out invalid ones
   */
  private validateUrls(urls: SitemapUrl[], errors: string[]): SitemapUrl[] {
    return urls.filter(url => {
      try {
        new URL(url.loc);
        return true;
      } catch {
        errors.push(`Invalid URL: ${url.loc}`);
        return false;
      }
    });
  }

  /**
   * Split URLs into multiple sitemaps if needed
   */
  private splitIntoSitemaps(urls: SitemapUrl[]): SitemapGenerationResult['sitemaps'] {
    const sitemaps: SitemapGenerationResult['sitemaps'] = [];
    const maxUrls = this.config.maxUrlsPerSitemap;

    for (let i = 0; i < urls.length; i += maxUrls) {
      const batch = urls.slice(i, i + maxUrls);
      const sitemapNumber = Math.floor(i / maxUrls) + 1;
      const filename = sitemaps.length === 0 ? 'blog-sitemap.xml' : `blog-sitemap-${sitemapNumber}.xml`;
      
      sitemaps.push({
        filename,
        content: this.generateSitemapXML(batch),
        urlCount: batch.length,
        lastmod: new Date().toISOString()
      });
    }

    return sitemaps;
  }

  /**
   * Generate sitemap index XML
   */
  private generateSitemapIndex(sitemaps: SitemapGenerationResult['sitemaps']): SitemapGenerationResult['sitemapIndex'] {
    const sitemapEntries = sitemaps.map(sitemap => 
      `  <sitemap>
    <loc>${this.buildUrl(`/${sitemap.filename}`)}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`
    ).join('\n');

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;

    return {
      filename: 'blog-sitemap-index.xml',
      content,
      sitemapCount: sitemaps.length
    };
  }

  /**
   * Generate XML sitemap content
   */
  private generateSitemapXML(urls: SitemapUrl[]): string {
    const urlEntries = urls.map(url => {
      let entry = `  <url>
    <loc>${this.escapeXml(url.loc)}</loc>`;

      if (this.config.includeLastmod && url.lastmod) {
        entry += `
    <lastmod>${url.lastmod}</lastmod>`;
      }

      if (url.changefreq) {
        entry += `
    <changefreq>${url.changefreq}</changefreq>`;
      }

      if (url.priority !== undefined) {
        entry += `
    <priority>${url.priority.toFixed(1)}</priority>`;
      }

      // Add image entries
      if (this.config.includeImages && url.images && url.images.length > 0) {
        const imageEntries = url.images.map(image => {
          let imageEntry = `
    <image:image>
      <image:loc>${this.escapeXml(image.loc)}</image:loc>`;

          if (image.caption) {
            imageEntry += `
      <image:caption>${this.escapeXml(image.caption)}</image:caption>`;
          }

          if (image.title) {
            imageEntry += `
      <image:title>${this.escapeXml(image.title)}</image:title>`;
          }

          imageEntry += `
    </image:image>`;

          return imageEntry;
        }).join('');

        entry += imageEntries;
      }

      // Add alternate language entries (future multilingual support)
      if (url.alternates && url.alternates.length > 0) {
        const alternateEntries = url.alternates.map(alt => 
          `
    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${this.escapeXml(alt.href)}"/>`
        ).join('');
        
        entry += alternateEntries;
      }

      entry += `
  </url>`;

      return entry;
    }).join('\n');

    let namespaces = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
    
    if (this.config.includeImages) {
      namespaces += ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';
    }

    // Add namespace for multilingual support
    namespaces += ' xmlns:xhtml="http://www.w3.org/1999/xhtml"';

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${namespaces}>
${urlEntries}
</urlset>`;
  }

  /**
   * Build full URL from path
   */
  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const cleanBaseUrl = this.config.baseUrl.endsWith('/') 
      ? this.config.baseUrl.slice(0, -1) 
      : this.config.baseUrl;
    
    return `${cleanBaseUrl}${cleanPath}`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get cached result if still valid
   */
  private getCachedResult(key: string): SitemapGenerationResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() > cached.timestamp + cached.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    try {
      return JSON.parse(cached.data) as SitemapGenerationResult;
    } catch {
      this.cache.delete(key);
      return null;
    }
  }

  /**
   * Cache result for future use
   */
  private setCachedResult(key: string, result: SitemapGenerationResult): void {
    const ttl = this.config.cacheTtlMinutes * 60 * 1000;
    this.cache.set(key, {
      data: JSON.stringify(result),
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Clear all cached results
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Submit sitemap to search engines
   */
  async submitToSearchEngines(sitemapUrl: string): Promise<{ success: boolean; results: Array<{ endpoint: string; success: boolean; error?: string }> }> {
    if (!this.config.searchEngineSubmission.enabled || !this.config.searchEngineSubmission.endpoints.length) {
      return { success: false, results: [] };
    }

    const results = await Promise.all(
      this.config.searchEngineSubmission.endpoints.map(async (endpoint) => {
        try {
          const submitUrl = endpoint.replace('{sitemap_url}', encodeURIComponent(sitemapUrl));
          const response = await fetch(submitUrl, { method: 'GET' });
          
          return {
            endpoint,
            success: response.ok,
            error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
          };
        } catch (error) {
          return {
            endpoint,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    const allSuccessful = results.every(r => r.success);
    
    return { success: allSuccessful, results };
  }
}

/**
 * Convenience function to generate blog sitemap with default configuration
 */
export async function generateBlogSitemap(config?: Partial<SitemapConfig>): Promise<SitemapGenerationResult> {
  const generator = new BlogSitemapGenerator(config);
  return generator.generateBlogSitemap();
}

/**
 * Validate sitemap configuration
 */
export function validateSitemapConfig(config: unknown): SitemapConfig {
  return sitemapConfigSchema.parse(config);
}

/**
 * Get recommended sitemap configuration for different blog sizes
 */
export function getRecommendedSitemapConfig(blogSize: 'small' | 'medium' | 'large' | 'enterprise'): Partial<SitemapConfig> {
  const configs = {
    small: {
      maxUrlsPerSitemap: 50000,
      cacheTtlMinutes: 120,
      defaultChangeFreq: 'weekly' as const
    },
    medium: {
      maxUrlsPerSitemap: 40000,
      cacheTtlMinutes: 60,
      defaultChangeFreq: 'daily' as const
    },
    large: {
      maxUrlsPerSitemap: 30000,
      cacheTtlMinutes: 30,
      defaultChangeFreq: 'daily' as const
    },
    enterprise: {
      maxUrlsPerSitemap: 25000,
      cacheTtlMinutes: 15,
      defaultChangeFreq: 'hourly' as const,
      searchEngineSubmission: {
        enabled: true,
        endpoints: [
          'https://www.google.com/ping?sitemap={sitemap_url}',
          'https://www.bing.com/ping?sitemap={sitemap_url}'
        ]
      }
    }
  };

  return configs[blogSize];
}

export default BlogSitemapGenerator;