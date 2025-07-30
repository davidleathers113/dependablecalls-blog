# Blog Components Directory

This directory contains React components for integrating blog functionality into the main DCE platform application.

## Directory Purpose
- Integrates blog content into the main app
- Provides blog preview components
- Displays recent posts and updates
- Links to the separate Astro blog

## Component Types
- **BlogPreview.tsx** - Shows recent blog posts
- **BlogCard.tsx** - Individual post preview card
- **BlogFeed.tsx** - Blog post feed/list
- **BlogLink.tsx** - External link to blog
- **BlogWidget.tsx** - Dashboard blog widget

## Integration Pattern
```tsx
// BlogPreview.tsx
interface BlogPost {
  title: string;
  excerpt: string;
  date: string;
  slug: string;
  tags: string[];
}

export function BlogPreview() {
  const { data: posts } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: fetchRecentPosts,
  });
  
  return (
    <div className="blog-preview">
      {posts?.map(post => (
        <BlogCard key={post.slug} post={post} />
      ))}
    </div>
  );
}
```

## Blog API Integration
```typescript
// Fetch posts from blog API or RSS
export async function fetchRecentPosts(): Promise<BlogPost[]> {
  const response = await fetch('https://blog.dependablecalls.com/api/posts');
  return response.json();
}
```

## Component Features
- Recent post display
- Category filtering
- Search integration
- Read time estimates
- Author information
- Tag navigation

## Styling Guidelines
- Match main app design system
- Consistent with platform UI
- Responsive grid layouts
- Hover states for cards
- Loading skeletons

## Cross-Domain Considerations
- CORS configuration
- API endpoint setup
- RSS feed fallback
- Static data backup
- Error handling

## Performance
- Lazy load blog content
- Cache API responses
- Prefetch on hover
- Image optimization
- Minimal bundle impact

## CRITICAL RULES
- NO direct database access
- USE API or RSS for data
- MAINTAIN design consistency
- HANDLE cross-origin issues
- OPTIMIZE for performance