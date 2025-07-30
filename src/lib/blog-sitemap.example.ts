/**
 * Blog Sitemap Integration Examples
 * 
 * This file demonstrates how to integrate the BlogSitemapGenerator
 * with your DCE blog system for various use cases.
 */

import { BlogSitemapGenerator, getRecommendedSitemapConfig, type SitemapConfig } from './blog-sitemap';

// Example 1: Basic sitemap generation
export async function generateBasicBlogSitemap() {
  const generator = new BlogSitemapGenerator();
  const result = await generator.generateBlogSitemap();
  
  console.log(`Generated ${result.stats.totalSitemaps} sitemaps with ${result.stats.totalUrls} URLs`);
  console.log(`Generation took ${result.stats.generationTime}ms`);
  
  return result;
}

// Example 2: Custom configuration for a large blog
export async function generateLargeBlogSitemap() {
  const config = getRecommendedSitemapConfig('large');
  const generator = new BlogSitemapGenerator(config);
  
  const result = await generator.generateBlogSitemap();
  
  // Handle multiple sitemaps
  if (result.sitemapIndex) {
    console.log('Generated sitemap index due to large content volume');
    // Save sitemap index file
    console.log('Sitemap index:', result.sitemapIndex.filename);
  }
  
  // Save individual sitemaps
  for (const sitemap of result.sitemaps) {
    console.log(`Sitemap: ${sitemap.filename} (${sitemap.urlCount} URLs)`);
    // In a real implementation, you would save these to your public directory
    // await fs.writeFile(`public/${sitemap.filename}`, sitemap.content);
  }
  
  return result;
}

// Example 3: Production configuration with search engine submission
export async function generateProductionBlogSitemap() {
  const config: Partial<SitemapConfig> = {
    baseUrl: 'https://blog.dependablecalls.com',
    maxUrlsPerSitemap: 45000,
    includeImages: true,
    includeLastmod: true,
    cacheTtlMinutes: 30, // Shorter cache for production
    searchEngineSubmission: {
      enabled: true,
      endpoints: [
        'https://www.google.com/ping?sitemap={sitemap_url}',
        'https://www.bing.com/ping?sitemap={sitemap_url}'
      ]
    }
  };
  
  const generator = new BlogSitemapGenerator(config);
  const result = await generator.generateBlogSitemap();
  
  // Submit to search engines
  const mainSitemapUrl = result.sitemapIndex 
    ? `${config.baseUrl}/blog-sitemap-index.xml`
    : `${config.baseUrl}/blog-sitemap.xml`;
    
  const submissionResult = await generator.submitToSearchEngines(mainSitemapUrl);
  
  if (submissionResult.success) {
    console.log('Successfully submitted sitemap to all search engines');
  } else {
    console.log('Some search engine submissions failed:');
    submissionResult.results.forEach(result => {
      if (!result.success) {
        console.log(`- ${result.endpoint}: ${result.error}`);
      }
    });
  }
  
  return { sitemap: result, submission: submissionResult };
}

// Example 4: Development/staging environment
export async function generateDevelopmentBlogSitemap() {
  const config: Partial<SitemapConfig> = {
    baseUrl: 'https://staging-blog.dependablecalls.com',
    includeImages: false, // Faster generation for development
    cacheTtlMinutes: 5, // Short cache for rapid development
    searchEngineSubmission: {
      enabled: false // Don't submit staging sitemaps
    }
  };
  
  const generator = new BlogSitemapGenerator(config);
  return generator.generateBlogSitemap();
}

// Example 5: Scheduled sitemap generation (e.g., for cron jobs)
export async function scheduledSitemapGeneration() {
  try {
    console.log('Starting scheduled sitemap generation...');
    
    const config = getRecommendedSitemapConfig('enterprise');
    const generator = new BlogSitemapGenerator(config);
    
    const result = await generator.generateBlogSitemap();
    
    if (result.errors.length > 0) {
      console.error('Sitemap generation completed with errors:');
      result.errors.forEach(error => console.error(`- ${error}`));
    }
    
    console.log(`Sitemap generation completed successfully:`);
    console.log(`- Total URLs: ${result.stats.totalUrls}`);
    console.log(`- Total sitemaps: ${result.stats.totalSitemaps}`);
    console.log(`- Generation time: ${result.stats.generationTime}ms`);
    console.log(`- Cache hit: ${result.stats.cacheHit}`);
    
    // In a real implementation, save files and submit to search engines
    // await saveSitemapFiles(result);
    // await submitToSearchEngines(result);
    
    return result;
  } catch (error) {
    console.error('Scheduled sitemap generation failed:', error);
    throw error;
  }
}

// Example 6: Sitemap validation and health check
export async function validateSitemapHealth() {
  const generator = new BlogSitemapGenerator();
  const result = await generator.generateBlogSitemap();
  
  const healthReport = {
    isHealthy: result.errors.length === 0,
    totalUrls: result.stats.totalUrls,
    totalSitemaps: result.stats.totalSitemaps,
    generationTime: result.stats.generationTime,
    errors: result.errors,
    warnings: [] as string[]
  };
  
  // Check for potential issues
  if (result.stats.totalUrls === 0) {
    healthReport.warnings.push('No URLs found in sitemap');
    healthReport.isHealthy = false;
  }
  
  if (result.stats.generationTime > 30000) { // 30 seconds
    healthReport.warnings.push('Sitemap generation is taking too long');
  }
  
  if (result.stats.totalSitemaps > 10) {
    healthReport.warnings.push('Large number of sitemaps may indicate content organization issues');
  }
  
  return healthReport;
}

// Example 7: Integration with Express.js/Netlify Functions
export async function handleSitemapRequest(request: { path: string }) {
  const generator = new BlogSitemapGenerator();
  
  try {
    const result = await generator.generateBlogSitemap();
    
    // Handle different sitemap requests
    if (request.path === '/blog-sitemap-index.xml' && result.sitemapIndex) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600' // 1 hour cache
        },
        body: result.sitemapIndex.content
      };
    }
    
    // Find specific sitemap file
    const requestedFilename = request.path.replace('/', '');
    const sitemap = result.sitemaps.find(s => s.filename === requestedFilename);
    
    if (sitemap) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600'
        },
        body: sitemap.content
      };
    }
    
    // Default to first sitemap if available
    if (result.sitemaps.length > 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600'
        },
        body: result.sitemaps[0].content
      };
    }
    
    return {
      statusCode: 404,
      body: 'Sitemap not found'
    };
  } catch (error) {
    console.error('Sitemap generation failed:', error);
    return {
      statusCode: 500,
      body: 'Internal server error'
    };
  }
}

// Example 8: Monitoring and metrics
export async function collectSitemapMetrics() {
  const generator = new BlogSitemapGenerator();
  const startTime = Date.now();
  
  try {
    const result = await generator.generateBlogSitemap();
    const endTime = Date.now();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      generation_time_ms: endTime - startTime,
      total_urls: result.stats.totalUrls,
      total_sitemaps: result.stats.totalSitemaps,
      cache_hit: result.stats.cacheHit,
      errors_count: result.errors.length,
      success: result.errors.length === 0
    };
    
    // In a real implementation, you might send these metrics to your monitoring system
    console.log('Sitemap metrics:', metrics);
    
    return metrics;
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      generation_time_ms: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default {
  generateBasicBlogSitemap,
  generateLargeBlogSitemap,
  generateProductionBlogSitemap,
  generateDevelopmentBlogSitemap,
  scheduledSitemapGeneration,
  validateSitemapHealth,
  handleSitemapRequest,
  collectSitemapMetrics
};