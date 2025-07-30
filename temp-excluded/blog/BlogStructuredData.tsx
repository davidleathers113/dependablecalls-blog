import { useEffect } from 'react';
import { 
  generateBlogPostStructuredData, 
  generateBreadcrumbStructuredData,
  BlogPostSEO,
  BlogSEOConfig,
  DEFAULT_SEO_CONFIG
} from '../../lib/blog-seo';
import { 
  useFAQStructuredData, 
  useHowToStructuredData, 
  useArticleSeriesStructuredData 
} from './BlogStructuredDataHooks';

export interface BlogStructuredDataProps {
  post?: BlogPostSEO;
  breadcrumbs?: Array<{ name: string; url: string }>;
  config?: BlogSEOConfig;
  additionalData?: Record<string, unknown>[];
}

/**
 * BlogStructuredData component injects JSON-LD structured data into the page head
 * This helps search engines understand the content and can enable rich snippets
 */
export function BlogStructuredData({ 
  post, 
  breadcrumbs, 
  config = DEFAULT_SEO_CONFIG,
  additionalData = []
}: BlogStructuredDataProps) {
  useEffect(() => {
    const structuredDataElements: HTMLScriptElement[] = [];

    // Helper function to create and append structured data script
    const addStructuredData = (data: Record<string, unknown>, id: string) => {
      // Remove existing script with same ID if it exists
      const existing = document.getElementById(id);
      if (existing) {
        existing.remove();
      }

      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      script.textContent = JSON.stringify(data, null, 2);
      document.head.appendChild(script);
      
      structuredDataElements.push(script);
    };

    // Add blog post structured data
    if (post) {
      const blogPostData = generateBlogPostStructuredData(post, config);
      addStructuredData(blogPostData, 'blog-post-structured-data');
    }

    // Add breadcrumb structured data
    if (breadcrumbs && breadcrumbs.length > 0) {
      const breadcrumbData = generateBreadcrumbStructuredData(breadcrumbs, config.siteUrl);
      addStructuredData(breadcrumbData, 'breadcrumb-structured-data');
    }

    // Add website/organization structured data (always present)
    const websiteData = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: config.siteName,
      url: config.siteUrl,
      description: config.defaultDescription,
      publisher: {
        '@type': 'Organization',
        name: 'Dependable Calls E-commerce',
        url: 'https://dependablecalls.com',
        logo: {
          '@type': 'ImageObject',
          url: `${config.siteUrl}/images/logo.png`
        },
        sameAs: [
          'https://twitter.com/dependablecalls',
          'https://linkedin.com/company/dependable-calls'
        ]
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${config.siteUrl}/search?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      }
    };
    addStructuredData(websiteData, 'website-structured-data');

    // Add any additional structured data
    additionalData.forEach((data, index) => {
      addStructuredData(data, `additional-structured-data-${index}`);
    });

    // Cleanup function to remove all structured data scripts
    return () => {
      structuredDataElements.forEach(script => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
    };
  }, [post, breadcrumbs, config, additionalData]);

  // This component doesn't render anything
  return null;
}


/**
 * Component for FAQ structured data
 */
export function FAQStructuredData({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
  const faqData = useFAQStructuredData(faqs);
  
  return (
    <BlogStructuredData 
      additionalData={[faqData]}
    />
  );
}

/**
 * Component for How-to structured data
 */
export function HowToStructuredData({
  title,
  description,
  steps,
  totalTime,
  estimatedCost
}: {
  title: string;
  description: string;
  steps: Array<{ name: string; text: string; image?: string }>;
  totalTime?: string;
  estimatedCost?: { currency: string; value: string };
}) {
  const howToData = useHowToStructuredData(title, description, steps, totalTime, estimatedCost);
  
  return (
    <BlogStructuredData 
      additionalData={[howToData]}
    />
  );
}

/**
 * Component for Article series structured data
 */
export function ArticleSeriesStructuredData({
  seriesName,
  articles
}: {
  seriesName: string;
  articles: Array<{ title: string; url: string; position: number }>;
}) {
  const seriesData = useArticleSeriesStructuredData(seriesName, articles);
  
  return (
    <BlogStructuredData 
      additionalData={[seriesData]}
    />
  );
}

export default BlogStructuredData;