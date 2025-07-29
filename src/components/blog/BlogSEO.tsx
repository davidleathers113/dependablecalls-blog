import { useEffect } from 'react';

export interface BlogSEOProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogImageAlt?: string;
  twitterImage?: string;
  twitterImageAlt?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
  articleSection?: string;
  readingTime?: number;
  noIndex?: boolean;
  noFollow?: boolean;
}

/**
 * BlogSEO component manages meta tags for blog posts using direct DOM manipulation
 * Since react-helmet-async doesn't support React 19, we use the document.head API
 */
export function BlogSEO({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogImageAlt,
  twitterImage,
  twitterImageAlt,
  publishedTime,
  modifiedTime,
  author,
  tags = [],
  articleSection,
  readingTime,
  noIndex = false,
  noFollow = false
}: BlogSEOProps) {
  useEffect(() => {
    // Store original values to restore on cleanup
    const originalTitle = document.title;
    const existingMetas = new Map<string, string>();
    
    // Helper function to set or update meta tag
    const setMetaTag = (name: string, content: string, property?: boolean) => {
      const attribute = property ? 'property' : 'name';
      const selector = `meta[${attribute}="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      } else {
        // Store original content for cleanup
        if (!existingMetas.has(name)) {
          existingMetas.set(name, meta.content || '');
        }
      }
      
      meta.content = content;
    };

    // Helper function to set or update link tag
    const setLinkTag = (rel: string, href: string) => {
      const selector = `link[rel="${rel}"]`;
      let link = document.querySelector(selector) as HTMLLinkElement;
      
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      
      link.href = href;
    };

    // Set page title
    document.title = `${title} | DCE Blog`;

    // Basic meta tags
    setMetaTag('description', description);
    
    // Robots meta
    const robotsContent = [];
    if (noIndex) robotsContent.push('noindex');
    if (noFollow) robotsContent.push('nofollow');
    if (robotsContent.length === 0) robotsContent.push('index', 'follow');
    setMetaTag('robots', robotsContent.join(', '));

    // Keywords from tags
    if (tags.length > 0) {
      setMetaTag('keywords', tags.join(', '));
    }

    // Author
    if (author) {
      setMetaTag('author', author);
    }

    // Article-specific meta tags
    if (publishedTime) {
      setMetaTag('article:published_time', publishedTime, true);
    }
    
    if (modifiedTime) {
      setMetaTag('article:modified_time', modifiedTime, true);
    }
    
    if (author) {
      setMetaTag('article:author', author, true);
    }
    
    if (articleSection) {
      setMetaTag('article:section', articleSection, true);
    }
    
    // Article tags
    tags.forEach(tag => {
      setMetaTag('article:tag', tag, true);
    });

    // Reading time (custom meta)
    if (readingTime) {
      setMetaTag('reading-time', `${readingTime}`);
    }

    // Open Graph meta tags
    setMetaTag('og:title', title, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:type', 'article', true);
    setMetaTag('og:site_name', 'DCE Blog', true);
    
    if (canonicalUrl) {
      setMetaTag('og:url', canonicalUrl, true);
    }
    
    if (ogImage) {
      setMetaTag('og:image', ogImage, true);
      setMetaTag('og:image:alt', ogImageAlt || title, true);
      setMetaTag('og:image:width', '1200', true);
      setMetaTag('og:image:height', '630', true);
    }

    // Twitter Card meta tags
    setMetaTag('twitter:card', 'summary_large_image', true);
    setMetaTag('twitter:title', title, true);
    setMetaTag('twitter:description', description, true);
    setMetaTag('twitter:site', '@dependablecalls', true);
    
    if (twitterImage || ogImage) {
      setMetaTag('twitter:image', twitterImage || ogImage || '', true);
      setMetaTag('twitter:image:alt', twitterImageAlt || ogImageAlt || title, true);
    }

    // Canonical URL
    if (canonicalUrl) {
      setLinkTag('canonical', canonicalUrl);
    }

    // Cleanup function to restore original values
    return () => {
      document.title = originalTitle;
      
      // Restore or remove meta tags
      existingMetas.forEach((originalContent, metaName) => {
        const selectors = [
          `meta[name="${metaName}"]`,
          `meta[property="${metaName}"]`
        ];
        
        for (const selector of selectors) {
          const meta = document.querySelector(selector) as HTMLMetaElement;
          if (meta) {
            if (originalContent) {
              meta.content = originalContent;
            } else {
              meta.remove();
            }
            break;
          }
        }
      });

      // Remove dynamically added meta tags that didn't exist before
      const dynamicMetas = [
        'og:title', 'og:description', 'og:type', 'og:site_name', 'og:url', 
        'og:image', 'og:image:alt', 'og:image:width', 'og:image:height',
        'twitter:card', 'twitter:title', 'twitter:description', 'twitter:site',
        'twitter:image', 'twitter:image:alt', 'article:published_time',
        'article:modified_time', 'article:author', 'article:section',
        'article:tag', 'reading-time'
      ];

      dynamicMetas.forEach(metaName => {
        if (!existingMetas.has(metaName)) {
          const selectors = [
            `meta[name="${metaName}"]`,
            `meta[property="${metaName}"]`
          ];
          
          for (const selector of selectors) {
            const meta = document.querySelector(selector);
            if (meta) {
              meta.remove();
            }
          }
        }
      });
    };
  }, [
    title, description, canonicalUrl, ogImage, ogImageAlt, twitterImage, 
    twitterImageAlt, publishedTime, modifiedTime, author, tags, 
    articleSection, readingTime, noIndex, noFollow
  ]);

  // This component doesn't render anything
  return null;
}

export default BlogSEO;