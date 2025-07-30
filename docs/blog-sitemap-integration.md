# Blog Sitemap Generation Integration Guide

This guide explains how to integrate and use the blog sitemap generation utilities in the DCE website project.

## Overview

The `BlogSitemapGenerator` creates SEO-optimized XML sitemaps for blog content, including:

- Blog posts with intelligent priority and change frequency calculation
- Category pages with content freshness tracking
- Author pages with publication activity
- Image sitemaps for featured images
- Sitemap index for large content sets (>50k URLs)
- Multilingual support (future-ready)
- Automatic search engine submission capabilities

## Quick Start

```typescript
import { BlogSitemapGenerator } from '../lib/blog-sitemap';

// Basic usage
const generator = new BlogSitemapGenerator();
const result = await generator.generateBlogSitemap();

console.log(`Generated ${result.stats.totalUrls} URLs in ${result.stats.totalSitemaps} sitemaps`);
```

## Configuration

### Default Configuration

The generator uses sensible defaults for the DCE blog:

```typescript
import { DEFAULT_SITEMAP_CONFIG } from '../lib/blog-sitemap';

console.log(DEFAULT_SITEMAP_CONFIG);
// {
//   baseUrl: 'https://blog.dependablecalls.com',
//   maxUrlsPerSitemap: 45000,
//   defaultChangeFreq: 'weekly',
//   defaultPriority: 0.5,
//   includeImages: true,
//   includeLastmod: true,
//   enableCompression: false,
//   cacheTtlMinutes: 60
// }
```

### Custom Configuration

```typescript
import { BlogSitemapGenerator, type SitemapConfig } from '../lib/blog-sitemap';

const customConfig: Partial<SitemapConfig> = {
  baseUrl: 'https://your-domain.com',
  maxUrlsPerSitemap: 30000,
  includeImages: false,
  cacheTtlMinutes: 30,
  searchEngineSubmission: {
    enabled: true,
    endpoints: [
      'https://www.google.com/ping?sitemap={sitemap_url}',
      'https://www.bing.com/ping?sitemap={sitemap_url}'
    ]
  }
};

const generator = new BlogSitemapGenerator(customConfig);
```

### Recommended Configurations

Use pre-configured settings based on your blog size:

```typescript
import { getRecommendedSitemapConfig } from '../lib/blog-sitemap';

// For small blogs (<1000 posts)
const smallConfig = getRecommendedSitemapConfig('small');

// For large blogs (>10000 posts)
const largeConfig = getRecommendedSitemapConfig('large');

// For enterprise blogs with advanced features
const enterpriseConfig = getRecommendedSitemapConfig('enterprise');
```

## Integration Examples

### 1. Netlify Function Integration

Create `/netlify/functions/blog-sitemap.ts`:

```typescript
import { BlogSitemapGenerator } from '../../src/lib/blog-sitemap';

export const handler = async (event: any) => {
  const generator = new BlogSitemapGenerator();
  
  try {
    const result = await generator.generateBlogSitemap();
    const requestedFile = event.path.replace('/api/', '');
    
    // Return sitemap index or specific sitemap
    const sitemap = result.sitemapIndex && requestedFile === 'blog-sitemap-index.xml'
      ? result.sitemapIndex
      : result.sitemaps.find(s => s.filename === requestedFile) || result.sitemaps[0];
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600'
      },
      body: sitemap.content
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Sitemap generation failed' })
    };
  }
};
```

### 2. Scheduled Generation (GitHub Actions)

Create `.github/workflows/sitemap-generation.yml`:

```yaml
name: Generate Blog Sitemaps
on:
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours
  workflow_dispatch: # Manual trigger

jobs:
  generate-sitemap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run generate:sitemap
      - name: Deploy to Netlify
        run: |
          # Deploy generated sitemaps to your static site
```

### 3. Build Integration

Add to your `package.json`:

```json
{
  "scripts": {
    "generate:sitemap": "tsx scripts/generate-sitemap.ts",
    "build": "vite build && npm run generate:sitemap"
  }
}
```

Create `scripts/generate-sitemap.ts`:

```typescript
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { BlogSitemapGenerator } from '../src/lib/blog-sitemap';

async function generateSitemaps() {
  const generator = new BlogSitemapGenerator();
  const result = await generator.generateBlogSitemap();
  
  const outputDir = join(process.cwd(), 'dist');
  await mkdir(outputDir, { recursive: true });
  
  // Save sitemap index if exists
  if (result.sitemapIndex) {
    await writeFile(
      join(outputDir, result.sitemapIndex.filename),
      result.sitemapIndex.content
    );
  }
  
  // Save individual sitemaps
  for (const sitemap of result.sitemaps) {
    await writeFile(
      join(outputDir, sitemap.filename),
      sitemap.content
    );
  }
  
  console.log(`Generated ${result.stats.totalSitemaps} sitemaps with ${result.stats.totalUrls} URLs`);
}

generateSitemaps().catch(console.error);
```

## Features

### Intelligent Priority Calculation

The generator automatically calculates URL priorities based on:

- View count (higher views = higher priority)
- Recency (newer posts get priority boost)
- Featured images (small priority boost)
- Content type (posts > categories > authors > tags)

### Change Frequency Optimization

Change frequencies are calculated based on:

- **Posts**: Age-based (daily for new, weekly for recent, monthly for older)
- **Categories**: Activity-based (daily for active categories)
- **Authors**: Monthly updates
- **Tags**: Monthly updates

### Image Sitemap Support

When `includeImages: true`, the generator includes:

- Featured image URLs
- Image captions from post excerpts
- Image titles from post titles
- Proper image sitemap XML structure

### Large Site Support

For blogs with >50,000 URLs:

- Automatic sitemap splitting
- Sitemap index generation
- Optimized memory usage
- Batch processing

### Caching

Built-in caching system:

- Configurable TTL (default: 60 minutes)
- Memory-based storage
- Cache invalidation methods
- Performance optimization

## API Reference

### BlogSitemapGenerator

#### Constructor

```typescript
new BlogSitemapGenerator(config?: Partial<SitemapConfig>)
```

#### Methods

```typescript
// Generate complete blog sitemap
generateBlogSitemap(): Promise<SitemapGenerationResult>

// Clear cached results
clearCache(): void

// Submit sitemap to search engines
submitToSearchEngines(sitemapUrl: string): Promise<SubmissionResult>
```

### Types

```typescript
interface SitemapGenerationResult {
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
```

## Best Practices

### 1. Performance

- Use caching for production deployments
- Configure appropriate cache TTL based on content update frequency
- Consider using CDN for sitemap delivery

### 2. SEO

- Submit sitemaps to Google Search Console and Bing Webmaster Tools
- Update sitemaps when publishing new content
- Monitor sitemap errors in webmaster tools

### 3. Monitoring

- Track sitemap generation performance
- Monitor for errors and failed generations
- Set up alerts for sitemap submission failures

### 4. Content Strategy

- Ensure all published content has proper slugs
- Use descriptive featured images with alt text
- Keep URL structure consistent

## Troubleshooting

### Common Issues

1. **Empty sitemaps**: Check if blog posts are published and have valid slugs
2. **Invalid URLs**: Verify base URL configuration and slug generation
3. **Large generation times**: Consider reducing `maxUrlsPerSitemap` or enabling caching
4. **Memory issues**: Use streaming for very large blogs (custom implementation needed)

### Debugging

Enable detailed logging:

```typescript
const generator = new BlogSitemapGenerator({
  // Add custom error handling
});

const result = await generator.generateBlogSitemap();
console.log('Errors:', result.errors);
console.log('Stats:', result.stats);
```

## Testing

Run the included tests:

```bash
npm test src/lib/__tests__/blog-sitemap.test.ts
```

Create custom tests for your integration:

```typescript
import { BlogSitemapGenerator } from '../lib/blog-sitemap';

describe('Custom sitemap integration', () => {
  it('should generate sitemap with custom configuration', async () => {
    const generator = new BlogSitemapGenerator({
      baseUrl: 'https://test.example.com'
    });
    
    const result = await generator.generateBlogSitemap();
    expect(result.sitemaps[0].content).toContain('test.example.com');
  });
});
```

## Support

For issues or questions about the blog sitemap generator:

1. Check the test files for usage examples
2. Review the example implementations
3. Validate your configuration against the schema
4. Monitor console output for error messages

The sitemap generator integrates seamlessly with the existing DCE blog infrastructure and follows SEO best practices for maximum search engine compatibility.