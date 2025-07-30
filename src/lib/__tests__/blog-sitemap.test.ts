import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlogSitemapGenerator, validateSitemapConfig, getRecommendedSitemapConfig } from '../blog-sitemap';
import { BlogService } from '../../services/blog.service';
import type { BlogPost, BlogCategory } from '../../types/blog';

// Mock BlogService
vi.mock('../../services/blog.service');

const mockBlogService = vi.mocked(BlogService);

describe('BlogSitemapGenerator', () => {
  let generator: BlogSitemapGenerator;
  
  beforeEach(() => {
    vi.clearAllMocks();
    generator = new BlogSitemapGenerator();
  });

  describe('Configuration validation', () => {
    it('should validate valid sitemap configuration', () => {
      const config = {
        baseUrl: 'https://example.com',
        maxUrlsPerSitemap: 50000,
        defaultChangeFreq: 'weekly' as const,
        defaultPriority: 0.5
      };
      
      expect(() => validateSitemapConfig(config)).not.toThrow();
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        baseUrl: 'not-a-url',
        maxUrlsPerSitemap: -1
      };
      
      expect(() => validateSitemapConfig(invalidConfig)).toThrow();
    });
  });

  describe('Recommended configurations', () => {
    it('should return appropriate config for different blog sizes', () => {
      const smallConfig = getRecommendedSitemapConfig('small');
      const enterpriseConfig = getRecommendedSitemapConfig('enterprise');
      
      expect(smallConfig.maxUrlsPerSitemap).toBeGreaterThan(enterpriseConfig.maxUrlsPerSitemap!);
      expect(enterpriseConfig.searchEngineSubmission?.enabled).toBe(true);
    });
  });

  describe('Sitemap generation', () => {
    beforeEach(() => {
      // Mock blog posts
      const mockPosts: BlogPost[] = [
        {
          id: '1',
          title: 'Test Post 1',
          slug: 'test-post-1',
          content: 'Test content',
          status: 'published',
          published_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          author_id: 'author-1',
          view_count: 100,
          reading_time: 5,
          featured_image_url: 'https://example.com/image1.jpg',
          excerpt: 'Test excerpt 1'
        },
        {
          id: '2',
          title: 'Test Post 2',
          slug: 'test-post-2',
          content: 'Test content 2',
          status: 'published',
          published_at: '2024-01-02T00:00:00Z',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          author_id: 'author-1',
          view_count: 50,
          reading_time: 3
        }
      ];

      const mockCategories: BlogCategory[] = [
        {
          id: 'cat-1',
          name: 'Technology',
          slug: 'technology',
          description: 'Tech posts',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          display_order: 1
        }
      ];

      // Mock authors (not currently used in sitemap generation but available for future features)
      // const mockAuthors: BlogAuthor[] = [
      //   {
      //     id: 'author-1',
      //     user_id: 'user-1',
      //     display_name: 'John Doe',
      //     slug: 'john-doe',
      //     bio: 'Test author',
      //     created_at: '2024-01-01T00:00:00Z',
      //     updated_at: '2024-01-01T00:00:00Z'
      //   }
      // ];

      // Setup mocks
      mockBlogService.getPosts.mockResolvedValue({
        data: mockPosts,
        meta: {
          page: 1,
          limit: 100,
          total: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        }
      });

      mockBlogService.getCategories.mockResolvedValue(mockCategories);
      mockBlogService.getTags.mockResolvedValue([]);
    });

    it('should generate basic sitemap successfully', async () => {
      const result = await generator.generateBlogSitemap();
      
      expect(result.sitemaps).toHaveLength(1);
      expect(result.sitemaps[0].filename).toBe('blog-sitemap.xml');
      expect(result.sitemaps[0].content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.sitemaps[0].content).toContain('<urlset');
      expect(result.stats.totalUrls).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should include blog post URLs in sitemap', async () => {
      const result = await generator.generateBlogSitemap();
      
      expect(result.sitemaps[0].content).toContain('/blog/post/test-post-1');
      expect(result.sitemaps[0].content).toContain('/blog/post/test-post-2');
    });

    it('should include image information when enabled', async () => {
      const result = await generator.generateBlogSitemap();
      
      expect(result.sitemaps[0].content).toContain('image:image');
      expect(result.sitemaps[0].content).toContain('https://example.com/image1.jpg');
    });

    it('should exclude images when disabled', async () => {
      const generatorNoImages = new BlogSitemapGenerator({ includeImages: false });
      const result = await generatorNoImages.generateBlogSitemap();
      
      expect(result.sitemaps[0].content).not.toContain('image:image');
    });

    it('should handle sitemap splitting for large content sets', async () => {
      const smallLimitGenerator = new BlogSitemapGenerator({ maxUrlsPerSitemap: 1 });
      const result = await smallLimitGenerator.generateBlogSitemap();
      
      expect(result.sitemaps.length).toBeGreaterThan(1);
      expect(result.sitemapIndex).toBeDefined();
      expect(result.sitemapIndex!.content).toContain('<sitemapindex');
    });
  });

  describe('URL validation', () => {
    it('should filter out invalid URLs', async () => {
      // Mock a post with invalid slug
      mockBlogService.getPosts.mockResolvedValue({
        data: [{
          id: '1',
          title: 'Test Post',
          slug: '', // Invalid slug
          content: 'Test content',
          status: 'published',
          published_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          author_id: 'author-1',
          view_count: 0,
          reading_time: 1
        }] as BlogPost[],
        meta: {
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        }
      });

      const result = await generator.generateBlogSitemap();
      
      // Should still generate sitemap with blog index URL
      expect(result.sitemaps).toHaveLength(1);
      expect(result.stats.totalUrls).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    it('should cache sitemap results', async () => {
      await generator.generateBlogSitemap();
      const result2 = await generator.generateBlogSitemap();
      
      expect(result2.stats.cacheHit).toBe(true);
      // After first generation, subsequent calls should hit cache
      expect(mockBlogService.getPosts).toHaveBeenCalledTimes(3); // Initial calls for posts, categories, authors
    });

    it('should clear cache when requested', async () => {
      await generator.generateBlogSitemap();
      const callCountAfterFirst = mockBlogService.getPosts.mock.calls.length;
      
      generator.clearCache();
      await generator.generateBlogSitemap();
      const callCountAfterSecond = mockBlogService.getPosts.mock.calls.length;
      
      // Should have called the service again after cache clear
      expect(callCountAfterSecond).toBeGreaterThan(callCountAfterFirst);
    });
  });

  describe('XML generation', () => {
    it('should generate valid XML structure', async () => {
      const result = await generator.generateBlogSitemap();
      const xml = result.sitemaps[0].content;
      
      expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
      expect(xml).toContain('<urlset');
      expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      expect(xml).toContain('</urlset>');
    });

    it('should properly escape XML characters', async () => {
      // Mock post with special characters in featured image caption
      mockBlogService.getPosts.mockResolvedValue({
        data: [{
          id: '1',
          title: 'Test & "Special" <Characters>',
          slug: 'test-special',
          content: 'Test content',
          status: 'published',
          published_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          author_id: 'author-1',
          view_count: 0,
          reading_time: 1,
          excerpt: 'Test & "special" <excerpt>',
          featured_image_url: 'https://example.com/test.jpg'
        }] as BlogPost[],
        meta: {
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        }
      });

      const result = await generator.generateBlogSitemap();
      const xml = result.sitemaps[0].content;
      
      // XML escaping should be present in image captions and titles
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;');
      expect(xml).toContain('&lt;');
      expect(xml).toContain('&gt;');
    });
  });
});