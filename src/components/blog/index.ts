/**
 * Blog Components
 * 
 * Comprehensive set of reusable UI components for DCE's blog CMS system.
 * All components follow consistent design patterns, include accessibility features,
 * and integrate with the Zustand blog stores.
 */

// Core blog components
export { BlogComments } from './BlogComments'
export { BlogTags } from './BlogTags'
export { BlogCategories } from './BlogCategories'
export { BlogShare } from './BlogShare'
export { BlogReadingTime } from './BlogReadingTime'
export { BlogAuthorCard } from './BlogAuthorCard'
export { BlogRelatedPosts } from './BlogRelatedPosts'
export { BlogNewsletter } from './BlogNewsletter'
export { BlogPostCard } from './BlogPostCard'
export { BlogSearch } from './BlogSearch'
export { BlogSidebar } from './BlogSidebar'

// Navigation and UI components
export { BlogPagination } from './BlogPagination'
export { BlogLazyImage } from './BlogLazyImage'
export { Breadcrumb } from './Breadcrumb'

// Error handling
export { BlogErrorBoundary } from './BlogErrorBoundary'

// SEO and structured data
export { BlogSEO } from './BlogSEO'
export { 
  BlogStructuredData,
  FAQStructuredData,
  HowToStructuredData,
  ArticleSeriesStructuredData,
} from './BlogStructuredData'

// Performance monitoring
export { 
  BlogPerformance, 
 
} from './BlogPerformance'

// Analytics and tracking
export { BlogAnalyticsDemo, SimpleBlogPost } from './BlogAnalyticsDemo'

// Re-export types for convenience
export type { BlogCommentsProps } from './BlogComments'
export type { BlogTagsProps } from './BlogTags'
export type { BlogCategoriesProps } from './BlogCategories'
export type { BlogShareProps } from './BlogShare'
export type { BlogReadingTimeProps } from './BlogReadingTime'
export type { BlogAuthorCardProps } from './BlogAuthorCard'
export type { BlogRelatedPostsProps } from './BlogRelatedPosts'
export type { BlogNewsletterProps } from './BlogNewsletter'
export type { BlogSEOProps } from './BlogSEO'
export type { BlogStructuredDataProps } from './BlogStructuredData'

// Navigation and UI component types
export type { BlogPaginationProps, PaginationInfo } from './BlogPagination'
export type { 
  BlogLazyImageProps,
  AspectRatio,
  LoadingState,
  ImageSize,
  ImagePerformanceMetrics,
  ErrorConfig,
  LightboxConfig,
  BlurConfig
} from './BlogLazyImage'
export type { BreadcrumbItem } from './Breadcrumb'

// Note: Some component props interfaces are not exported from their source files
// but are available for import if needed:
// - BlogSearchProps (from BlogSearch.tsx)
// - BlogPostCardProps (from BlogPostCard.tsx)  
// - BlogSidebarProps (from BlogSidebar.tsx)

// Performance monitoring types
export type { 
  BlogPerformanceProps,
  BlogPerformanceConfig,
  BlogPerformanceMetrics,
  WebVitalMetric,
  PerformanceReport,
  BlogPerformanceContextValue
} from './BlogPerformance'

/**
 * Component Usage Examples:
 * 
 * ```tsx
 * import { 
 *   BlogComments,
 *   BlogTags,
 *   BlogShare,
 *   BlogAuthorCard,
 *   BlogPagination,
 *   BlogLazyImage,
 *   BlogSEO,
 *   BlogStructuredData,
 *   BlogPerformance,
 *   useBlogPerformance,
 *   useBlogMetrics,
 *   withBlogPerformance,
 *   Breadcrumb
 * } from '@/components/blog'
 * 
 * // Basic blog components
 * <BlogComments postId={post.id} enableRealtime={true} />
 * <BlogTags selectedTags={filters.tags} onTagChange={handleTagFilter} />
 * <BlogShare url={postUrl} title={post.title} />
 * <BlogAuthorCard author={post.author} variant="detailed" />
 * 
 * // Navigation components
 * <BlogPagination 
 *   currentPage={currentPage}
 *   totalPages={totalPages}
 *   onPageChange={handlePageChange}
 *   showQuickJumper={true}
 * />
 * <Breadcrumb items={breadcrumbItems} />
 * 
 * // Media components
 * <BlogLazyImage
 *   src={post.featuredImage}
 *   alt={post.title}
 *   aspectRatio="16:9"
 *   sizes="(min-width: 1024px) 800px, 100vw"
 *   enableLightbox={true}
 * />
 * 
 * // SEO components
 * <BlogSEO 
 *   title={post.title}
 *   description={post.excerpt}
 *   canonicalUrl={postUrl}
 *   openGraph={{ image: post.featuredImage }}
 * />
 * <BlogStructuredData
 *   title={post.title}
 *   author={post.author}
 *   publishedTime={post.publishedAt}
 *   modifiedTime={post.updatedAt}
 * />
 * 
 * // Performance monitoring wrapper
 * <BlogPerformance 
 *   componentName="blog-post"
 *   enableRealTimeUpdates={true}
 *   config={{ enableBudgetAlerting: true }}
 *   onBudgetExceeded={(metric, value, budget) => {
 *     console.warn(`Budget exceeded: ${metric} ${value}ms > ${budget}ms`)
 *   }}
 * >
 *   <BlogPostContent post={post} />
 * </BlogPerformance>
 * 
 * // Using performance hooks
 * function BlogComponent() {
 *   const { trackUserAction, trackApiCall } = useBlogPerformance()
 *   const { measureContentRender, measureImageLoad } = useBlogMetrics()
 *   
 *   const handleShare = () => trackUserAction('share', { platform: 'twitter' })
 *   const loadComments = () => trackApiCall('comments', () => api.getComments(postId))
 * }
 * 
 * // HOC for automatic performance wrapping
 * const EnhancedBlogPost = withBlogPerformance(BlogPostComponent, {
 *   enableWebVitals: true,
 *   enableUserTracking: true
 * })
 * ```
 */