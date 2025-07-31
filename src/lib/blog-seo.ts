import { z } from 'zod';

// SEO Configuration Types
export interface BlogSEOConfig {
  siteName: string;
  siteUrl: string;
  defaultImage: string;
  twitterHandle: string;
  facebookAppId?: string;
  defaultAuthor: string;
  defaultDescription: string;
}

export interface BlogPostSEO {
  title: string;
  description: string;
  slug: string;
  publishedAt?: Date;
  updatedAt?: Date;
  author?: {
    name: string;
    url?: string;
    image?: string;
  };
  tags?: string[];
  category?: string;
  image?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  readingTime?: number;
  excerpt?: string;
}

// Validation schemas
export const blogPostSEOSchema = z.object({
  title: z.string().min(1).max(60),
  description: z.string().min(50).max(160),
  slug: z.string().min(1),
  publishedAt: z.date().optional(),
  updatedAt: z.date().optional(),
  author: z.object({
    name: z.string().min(1),
    url: z.string().url().optional(),
    image: z.string().url().optional()
  }).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  image: z.object({
    url: z.string().url(),
    alt: z.string().min(1),
    width: z.number().positive().optional(),
    height: z.number().positive().optional()
  }).optional(),
  readingTime: z.number().positive().optional(),
  excerpt: z.string().max(300).optional()
});

// Default SEO configuration for DCE Blog
export const DEFAULT_SEO_CONFIG: BlogSEOConfig = {
  siteName: 'DCE Blog',
  siteUrl: 'https://blog.dependablecalls.com',
  defaultImage: 'https://blog.dependablecalls.com/images/og-default.jpg',
  twitterHandle: '@dependablecalls',
  defaultAuthor: 'DCE Team',
  defaultDescription: 'Industry insights, best practices, and updates from the Dependable Calls E-commerce platform.'
};

/**
 * Generate optimized meta title for blog posts
 */
export function generateMetaTitle(title: string, siteName: string = DEFAULT_SEO_CONFIG.siteName): string {
  if (title.length <= 50) {
    return `${title} | ${siteName}`;
  }
  
  // Truncate title if too long to accommodate site name
  const maxTitleLength = 60 - siteName.length - 3; // Account for " | "
  const truncatedTitle = title.length > maxTitleLength 
    ? `${title.substring(0, maxTitleLength - 3)}...`
    : title;
    
  return `${truncatedTitle} | ${siteName}`;
}

/**
 * Generate meta description with optimal length
 */
export function generateMetaDescription(description: string, excerpt?: string): string {
  const content = description || excerpt || '';
  
  if (content.length <= 160) {
    return content;
  }
  
  // Find the last complete sentence within 160 characters
  const truncated = content.substring(0, 157);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  if (lastSentenceEnd > 100) {
    return content.substring(0, lastSentenceEnd + 1);
  }
  
  // If no good sentence break, truncate with ellipsis
  return `${truncated}...`;
}

/**
 * Generate canonical URL for blog post
 */
export function generateCanonicalUrl(slug: string, baseUrl: string = DEFAULT_SEO_CONFIG.siteUrl): string {
  const cleanSlug = slug.startsWith('/') ? slug.slice(1) : slug;
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBaseUrl}/${cleanSlug}`;
}

/**
 * Generate Open Graph image URL with fallback
 */
export function generateOGImage(
  image?: { url: string; alt: string; width?: number; height?: number },
  fallbackUrl: string = DEFAULT_SEO_CONFIG.defaultImage
): { url: string; alt: string; width: number; height: number } {
  if (image?.url) {
    return {
      url: image.url,
      alt: image.alt,
      width: image.width || 1200,
      height: image.height || 630
    };
  }
  
  return {
    url: fallbackUrl,
    alt: 'DCE Blog - Pay-per-call network insights',
    width: 1200,
    height: 630
  };
}

/**
 * Generate JSON-LD structured data for blog posts
 */
export function generateBlogPostStructuredData(
  post: BlogPostSEO,
  config: BlogSEOConfig = DEFAULT_SEO_CONFIG
): Record<string, unknown> {
  const baseUrl = config.siteUrl;
  const canonicalUrl = generateCanonicalUrl(post.slug, baseUrl);
  const ogImage = generateOGImage(post.image, config.defaultImage);
  
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: generateMetaDescription(post.description, post.excerpt),
    url: canonicalUrl,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString() || post.publishedAt?.toISOString(),
    author: {
      '@type': 'Person',
      name: post.author?.name || config.defaultAuthor,
      ...(post.author?.url && { url: post.author.url }),
      ...(post.author?.image && { image: post.author.image })
    },
    publisher: {
      '@type': 'Organization',
      name: config.siteName,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/images/logo.png`
      }
    },
    image: {
      '@type': 'ImageObject',
      url: ogImage.url,
      width: ogImage.width,
      height: ogImage.height
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl
    }
  };

  // Add optional fields
  if (post.tags && post.tags.length > 0) {
    Object.assign(structuredData, { keywords: post.tags.join(', ') });
  }
  
  if (post.category) {
    Object.assign(structuredData, { articleSection: post.category });
  }
  
  if (post.readingTime) {
    Object.assign(structuredData, { 
      timeRequired: `PT${post.readingTime}M` // ISO 8601 duration format
    });
  }

  return structuredData;
}

/**
 * Generate breadcrumb structured data
 */
export function generateBreadcrumbStructuredData(
  items: Array<{ name: string; url: string }>,
  baseUrl: string = DEFAULT_SEO_CONFIG.siteUrl
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`
    }))
  };
}

/**
 * Calculate estimated reading time based on word count
 */
export function calculateReadingTime(content: string, wordsPerMinute: number = 200): number {
  // Remove HTML tags and count words
  const plainText = content.replace(/<[^>]*>/g, '');
  const wordCount = plainText.trim().split(/\s+/).filter(word => word.length > 0).length;
  
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Generate slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Validate SEO data before use
 */
export function validateBlogPostSEO(data: unknown): BlogPostSEO {
  return blogPostSEOSchema.parse(data);
}

/**
 * Generate Twitter Card meta tags
 */
export function generateTwitterCardMeta(
  post: BlogPostSEO,
  config: BlogSEOConfig = DEFAULT_SEO_CONFIG
): Record<string, string> {
  const ogImage = generateOGImage(post.image, config.defaultImage);
  
  return {
    'twitter:card': 'summary_large_image',
    'twitter:site': config.twitterHandle,
    'twitter:title': generateMetaTitle(post.title),
    'twitter:description': generateMetaDescription(post.description, post.excerpt),
    'twitter:image': ogImage.url,
    'twitter:image:alt': ogImage.alt
  };
}

/**
 * Generate Open Graph meta tags
 */
export function generateOpenGraphMeta(
  post: BlogPostSEO,
  config: BlogSEOConfig = DEFAULT_SEO_CONFIG
): Record<string, string> {
  const canonicalUrl = generateCanonicalUrl(post.slug, config.siteUrl);
  const ogImage = generateOGImage(post.image, config.defaultImage);
  
  const meta: Record<string, string> = {
    'og:type': 'article',
    'og:title': generateMetaTitle(post.title),
    'og:description': generateMetaDescription(post.description, post.excerpt),
    'og:url': canonicalUrl,
    'og:site_name': config.siteName,
    'og:image': ogImage.url,
    'og:image:alt': ogImage.alt,
    'og:image:width': ogImage.width.toString(),
    'og:image:height': ogImage.height.toString()
  };

  if (post.publishedAt) {
    meta['article:published_time'] = post.publishedAt.toISOString();
  }
  
  if (post.updatedAt) {
    meta['article:modified_time'] = post.updatedAt.toISOString();
  }
  
  if (post.author?.name) {
    meta['article:author'] = post.author.name;
  }
  
  if (post.category) {
    meta['article:section'] = post.category;
  }
  
  if (post.tags) {
    // Note: Multiple article:tag properties should be handled by the component
    meta['article:tag'] = post.tags.join(',');
  }

  return meta;
}

export default {
  generateMetaTitle,
  generateMetaDescription,
  generateCanonicalUrl,
  generateOGImage,
  generateBlogPostStructuredData,
  generateBreadcrumbStructuredData,
  calculateReadingTime,
  generateSlug,
  validateBlogPostSEO,
  generateTwitterCardMeta,
  generateOpenGraphMeta,
  DEFAULT_SEO_CONFIG
};