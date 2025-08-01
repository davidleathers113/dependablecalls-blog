# Supabase-Based CMS Implementation Guide for DCE Website Blog

## Executive Summary

This guide provides a comprehensive implementation plan for creating a Supabase-based Content Management System (CMS) for the DCE website blog functionality. Currently, the blog links to an external URL (blog.dependablecalls.com), but this implementation will bring the blog in-house at the `/blog` route.

## Current State Analysis

### Existing Infrastructure
- **Frontend**: Vite + React + TypeScript (v5.8)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **State Management**: Zustand
- **Data Fetching**: React Query (Tanstack Query)
- **Routing**: React Router v6
- **Styling**: Tailwind CSS

### Current Blog Implementation
- External links to `https://blog.dependablecalls.com`
- No internal blog functionality
- Blog links appear in:
  - `PublicLayout.tsx` navigation (desktop and mobile)
  - Footer navigation

### Existing Supabase Configuration
- Supabase client configured at `src/lib/supabase.ts`
- TypeScript database types at `src/types/database.ts`
- Extensive RLS policies and security measures already in place
- Existing patterns for audit logging and data tracking

## Database Schema Design

### Core Tables

#### 1. `blog_posts`
```sql
CREATE TABLE blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL, -- Raw markdown
  content_sanitized TEXT, -- Sanitized HTML (generated via trigger)
  excerpt TEXT, -- Short preview text
  featured_image_url TEXT,
  author_id UUID REFERENCES blog_authors(id) NOT NULL,
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}', -- SEO meta, custom fields
  view_count INTEGER DEFAULT 0,
  reading_time_minutes INTEGER,
  search_vector tsvector,
  embedding vector(1536), -- For semantic search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status_published ON blog_posts(status, published_at DESC);
CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_search ON blog_posts USING gin(search_vector);
CREATE INDEX idx_blog_posts_embedding ON blog_posts USING ivfflat (embedding vector_cosine_ops);

-- Enable pg_trgm for better text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_blog_posts_title_trgm ON blog_posts USING gin(title gin_trgm_ops);
```

#### 2. `blog_categories`
```sql
CREATE TABLE blog_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES blog_categories(id),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_categories_slug ON blog_categories(slug);
CREATE INDEX idx_blog_categories_parent ON blog_categories(parent_id);
```

#### 3. `blog_tags`
```sql
CREATE TABLE blog_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_tags_slug ON blog_tags(slug);
```

#### 4. `blog_post_categories`
```sql
CREATE TABLE blog_post_categories (
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES blog_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);
```

#### 5. `blog_post_tags`
```sql
CREATE TABLE blog_post_tags (
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
```

#### 6. `blog_authors`
```sql
CREATE TABLE blog_authors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  social_links JSONB DEFAULT '{}',
  storage_quota_mb INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_blog_authors_user ON blog_authors(user_id);
```

#### 7. `blog_comments` (Optional - Phase 2)
```sql
CREATE TABLE blog_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  parent_id UUID REFERENCES blog_comments(id),
  content TEXT NOT NULL,
  content_sanitized TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'spam', 'deleted')) DEFAULT 'pending',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_comments_post ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_user ON blog_comments(user_id);
CREATE INDEX idx_blog_comments_parent ON blog_comments(parent_id);
CREATE INDEX idx_blog_comments_status ON blog_comments(status);
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all blog tables
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;

-- Blog Posts Policies
-- Public can read published posts
CREATE POLICY "Published posts are viewable by everyone" 
  ON blog_posts FOR SELECT
  USING (status = 'published' AND published_at <= NOW());

-- Authors can CRUD their own posts (FIXED)
CREATE POLICY "Authors can manage their own posts" 
  ON blog_posts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blog_authors ba 
    WHERE ba.id = blog_posts.author_id 
    AND ba.user_id = auth.uid()
  ));

-- Admins can manage all posts
CREATE POLICY "Admins can manage all posts" 
  ON blog_posts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

-- Categories and Tags are publicly readable
CREATE POLICY "Categories are viewable by everyone" 
  ON blog_categories FOR SELECT
  USING (true);

CREATE POLICY "Tags are viewable by everyone" 
  ON blog_tags FOR SELECT
  USING (true);

-- Only admins can manage categories and tags
CREATE POLICY "Admins can manage categories" 
  ON blog_categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage tags" 
  ON blog_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  ));

-- Post categories and tags policies (NEW)
CREATE POLICY "Post categories viewable with post access"
  ON blog_post_categories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    WHERE bp.id = post_id
    AND (bp.status = 'published' OR EXISTS (
      SELECT 1 FROM blog_authors ba 
      WHERE ba.id = bp.author_id 
      AND ba.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    ))
  ));

CREATE POLICY "Authors can manage their post categories"
  ON blog_post_categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    JOIN blog_authors ba ON ba.id = bp.author_id
    WHERE bp.id = post_id
    AND ba.user_id = auth.uid()
  ));

CREATE POLICY "Post tags viewable with post access"
  ON blog_post_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    WHERE bp.id = post_id
    AND (bp.status = 'published' OR EXISTS (
      SELECT 1 FROM blog_authors ba 
      WHERE ba.id = bp.author_id 
      AND ba.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    ))
  ));

CREATE POLICY "Authors can manage their post tags"
  ON blog_post_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    JOIN blog_authors ba ON ba.id = bp.author_id
    WHERE bp.id = post_id
    AND ba.user_id = auth.uid()
  ));
```

### Automated Triggers

```sql
-- Auto-update timestamps
CREATE EXTENSION IF NOT EXISTS moddatetime;

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER update_blog_categories_updated_at
  BEFORE UPDATE ON blog_categories
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER update_blog_authors_updated_at
  BEFORE UPDATE ON blog_authors
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER update_blog_comments_updated_at
  BEFORE UPDATE ON blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION blog_posts_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.subtitle, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_search_update 
  BEFORE INSERT OR UPDATE OF title, subtitle, content ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_posts_search_trigger();

-- Audit trigger for content changes
CREATE OR REPLACE FUNCTION blog_audit_content_changes() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO audit_logs (
      table_name,
      action,
      user_id,
      record_id,
      old_data,
      new_data,
      created_at
    ) VALUES (
      'blog_posts',
      'content_update',
      auth.uid(),
      NEW.id,
      jsonb_build_object('content', OLD.content),
      jsonb_build_object('content', NEW.content),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_audit_content
  AFTER UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_audit_content_changes();

## Implementation Plan

### Phase 1: Database Setup and Basic CRUD (5-7 dev days)

1. **Create Migration File**
   - Add new migration: `supabase/migrations/018_blog_cms_tables.sql`
   - Include all table definitions, indexes, and RLS policies

2. **Update TypeScript Types**
   - Generate new database types
   - Create blog-specific type definitions in `src/types/blog.ts`

3. **Create Supabase Service Layer**
   - `src/services/blog.service.ts` - Core CRUD operations
   - Implement caching with React Query
   - Handle real-time subscriptions for live updates

### Phase 2: Frontend Components (6-8 dev days)

1. **Public Blog Pages**
   ```
   src/pages/public/blog/
   ├── BlogHomePage.tsx      // Blog listing page
   ├── BlogPostPage.tsx      // Individual post view
   ├── BlogCategoryPage.tsx  // Category listing
   ├── BlogTagPage.tsx       // Tag listing
   └── BlogSearchPage.tsx    // Search results
   ```

2. **Blog Components**
   ```
   src/components/blog/
   ├── BlogPostCard.tsx      // Post preview card
   ├── BlogPostContent.tsx   // Markdown renderer
   ├── BlogSidebar.tsx       // Categories, tags, recent posts
   ├── BlogPagination.tsx    // Pagination component
   └── BlogSearch.tsx        // Search component
   ```

3. **Admin CMS Components**
   ```
   src/components/blog/admin/
   ├── BlogPostEditor.tsx    // Rich text/markdown editor
   ├── BlogPostList.tsx      // Admin post management
   ├── BlogCategoryManager.tsx
   ├── BlogTagManager.tsx
   └── BlogMediaUploader.tsx // Image upload to Supabase Storage
   ```

### Phase 3: CMS Features (8-10 dev days)

1. **Rich Text Editor Integration**
   - Integrate TipTap with Supabase collaboration plugin
   - Image upload to Supabase Storage with AV scanning
   - Real-time preview with sanitization
   - Auto-save drafts to localStorage + Supabase

2. **SEO Optimization**
   - Dynamic meta tags
   - Sitemap generation
   - RSS feed endpoint

3. **Advanced Features**
   - Full-text search using PostgreSQL with pg_trgm
   - Related posts via pgvector semantic similarity
   - Reading time calculation
   - View count tracking with rate limiting

### Phase 4: Admin Dashboard (6-8 dev days)

1. **Blog Analytics**
   - Post performance metrics
   - Popular content tracking
   - Author statistics

2. **Content Management**
   - Bulk operations
   - Scheduled publishing
   - Content versioning

## Key Implementation Details

### 1. Routing Updates

Update `src/App.tsx` to include blog routes:

```tsx
// Public blog routes
<Route path="blog" element={<BlogLayout />}>
  <Route index element={<BlogHomePage />} />
  <Route path="post/:slug" element={<BlogPostPage />} />
  <Route path="category/:slug" element={<BlogCategoryPage />} />
  <Route path="tag/:slug" element={<BlogTagPage />} />
  <Route path="search" element={<BlogSearchPage />} />
</Route>

// Admin blog routes (protected)
<Route path="blog" element={<AdminBlogLayout />}>
  <Route index element={<BlogDashboard />} />
  <Route path="posts" element={<BlogPostList />} />
  <Route path="posts/new" element={<BlogPostEditor />} />
  <Route path="posts/:id/edit" element={<BlogPostEditor />} />
  <Route path="categories" element={<BlogCategoryManager />} />
  <Route path="tags" element={<BlogTagManager />} />
</Route>
```

### 2. Supabase Storage for Images

```sql
-- Create storage bucket with updated configuration
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true);

-- Storage policies with quota enforcement
CREATE POLICY "Authors can upload images within quota"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'blog-images' AND
  EXISTS (
    SELECT 1 FROM blog_authors ba
    WHERE ba.user_id = auth.uid()
    AND (
      SELECT COALESCE(SUM(size), 0) 
      FROM storage.objects 
      WHERE bucket_id = 'blog-images' 
      AND owner = auth.uid()
    ) + size <= ba.storage_quota_mb * 1024 * 1024
  )
);

CREATE POLICY "Authors can manage their own images"
ON storage.objects FOR ALL
USING (
  bucket_id = 'blog-images' AND
  owner = auth.uid()
);

CREATE POLICY "Public can view blog images"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');
```

### 3. Real-time Features

```typescript
// Subscribe to new posts
const subscription = supabase
  .channel('blog_posts_changes')
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'blog_posts',
      filter: 'status=eq.published'
    }, 
    handleNewPost
  )
  .subscribe();
```

### 4. Search Implementation with pgvector

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Function to generate embeddings (called from Edge Function)
CREATE OR REPLACE FUNCTION generate_blog_embedding(post_id UUID) 
RETURNS void AS $$
DECLARE
  post_content TEXT;
  embedding_vector vector(1536);
BEGIN
  SELECT title || ' ' || COALESCE(subtitle, '') || ' ' || content 
  INTO post_content
  FROM blog_posts 
  WHERE id = post_id;

  -- Call Edge Function to generate embedding via OpenAI
  -- This is a placeholder - actual implementation would use pg_net
  -- to call the Edge Function and get the embedding
  
  UPDATE blog_posts 
  SET embedding = embedding_vector 
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- Semantic search function
CREATE OR REPLACE FUNCTION search_similar_posts(
  query_embedding vector(1536),
  match_count INT DEFAULT 5
) RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  excerpt TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.id,
    bp.title,
    bp.slug,
    bp.excerpt,
    1 - (bp.embedding <=> query_embedding) as similarity
  FROM blog_posts bp
  WHERE bp.status = 'published'
  AND bp.embedding IS NOT NULL
  ORDER BY bp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

## Security Considerations

1. **Content Sanitization**
   - Server-side sanitization via Edge Function
   - Client-side DOMPurify for double protection
   - Validate all user inputs with Zod schemas

2. **Access Control**
   - Only admins and designated authors can create/edit posts
   - Draft posts only visible to authors and admins
   - Implement proper CORS policies for image uploads

3. **Rate Limiting**
   - Implement rate limiting for comments (Phase 2)
   - Limit API calls for search functionality
   - Monitor for abuse patterns

## Performance Optimizations

1. **Caching Strategy**
   - Cache published posts with React Query
   - Implement stale-while-revalidate pattern
   - Use Supabase's built-in caching headers

2. **Lazy Loading**
   - Implement infinite scroll for blog listing
   - Lazy load images with intersection observer
   - Code split blog routes

3. **Database Optimizations**
   - Use materialized views for popular posts
   - Implement database-level pagination
   - Optimize queries with proper indexes

## Migration Strategy

1. **Phase 1**: Deploy database schema and basic functionality
2. **Phase 2**: Soft launch with limited content
3. **Phase 3**: Migrate existing content (if any)
4. **Phase 4**: Update all blog links to internal routes
5. **Phase 5**: Redirect old blog.dependablecalls.com URLs

## Monitoring and Analytics

1. **Performance Monitoring**
   - Track page load times
   - Monitor database query performance
   - Set up alerts for errors

2. **Content Analytics**
   - Track post views and engagement
   - Monitor search queries
   - Analyze user behavior

## Future Enhancements

1. **Phase 2 Features**
   - Comment system with moderation
   - Social sharing integration
   - Email subscription for new posts

2. **Phase 3 Features**
   - Multi-language support
   - A/B testing for headlines
   - Content recommendation engine

## Total Timeline Estimate

| Phase | Calendar Days | Dev Days | Key Risks |
|-------|--------------|----------|-----------|
| Database & Backend | 7-10 | 5-7 | Migration complexity, RLS testing |
| Frontend Components | 10-14 | 6-8 | Editor integration, performance |
| CMS Features | 14-18 | 8-10 | Sanitization edge cases, search accuracy |
| Dashboard & Analytics | 10-14 | 6-8 | Materialized view performance |
| **Total** | **41-56 days** | **25-33 days** | **6-8 weeks with buffer** |

## Recommended Next Steps

1. **Fix RLS Policies** - Correct author authentication with lateral joins
2. **Add Update Triggers** - Implement moddatetime for all tables  
3. **Storage Security** - Set up quota enforcement and AV scanning
4. **Choose Editor** - Evaluate TipTap vs alternatives
5. **Migration Script** - Plan HTML→Markdown conversion pipeline
6. **Security Audit** - Review all policies before deployment

## Conclusion

This implementation plan provides a robust, scalable foundation for a Supabase-based CMS that integrates seamlessly with the existing DCE website architecture. The modular approach allows for incremental deployment while maintaining security and performance standards.