-- =====================================================
-- Blog Extensions Fix Migration
-- =====================================================
-- This migration replaces moddatetime with update_updated_at_column
-- and ensures proper extension setup in the extensions schema
-- =====================================================

-- =====================================================
-- Drop existing moddatetime triggers
-- =====================================================

-- Drop triggers that use moddatetime
DROP TRIGGER IF EXISTS update_blog_authors_updated_at ON blog_authors;
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON blog_posts;
DROP TRIGGER IF EXISTS update_blog_categories_updated_at ON blog_categories;
DROP TRIGGER IF EXISTS update_blog_comments_updated_at ON blog_comments;

-- =====================================================
-- Ensure extensions are properly installed
-- =====================================================

-- Drop moddatetime extension if it exists
DROP EXTENSION IF EXISTS moddatetime CASCADE;

-- Ensure pgvector is installed in extensions schema
DO $$
BEGIN
    -- Check if pgvector extension exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) THEN
        -- Create vector extension in extensions schema
        CREATE EXTENSION vector WITH SCHEMA extensions;
    ELSE
        -- If it exists but not in extensions schema, move it
        IF NOT EXISTS (
            SELECT 1 FROM pg_extension e
            JOIN pg_namespace n ON e.extnamespace = n.oid
            WHERE e.extname = 'vector' AND n.nspname = 'extensions'
        ) THEN
            ALTER EXTENSION vector SET SCHEMA extensions;
        END IF;
    END IF;
END $$;

-- Ensure pg_trgm is installed in extensions schema
DO $$
BEGIN
    -- Check if pg_trgm extension exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
    ) THEN
        -- Create pg_trgm extension in extensions schema
        CREATE EXTENSION pg_trgm WITH SCHEMA extensions;
    ELSE
        -- If it exists but not in extensions schema, move it
        IF NOT EXISTS (
            SELECT 1 FROM pg_extension e
            JOIN pg_namespace n ON e.extnamespace = n.oid
            WHERE e.extname = 'pg_trgm' AND n.nspname = 'extensions'
        ) THEN
            ALTER EXTENSION pg_trgm SET SCHEMA extensions;
        END IF;
    END IF;
END $$;

-- =====================================================
-- Create update triggers using update_updated_at_column
-- =====================================================

-- Note: update_updated_at_column function already exists from migration 001

-- Blog Authors trigger
CREATE TRIGGER update_blog_authors_updated_at
    BEFORE UPDATE ON blog_authors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Blog Posts trigger
CREATE TRIGGER update_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Blog Categories trigger
CREATE TRIGGER update_blog_categories_updated_at
    BEFORE UPDATE ON blog_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Blog Comments trigger
CREATE TRIGGER update_blog_comments_updated_at
    BEFORE UPDATE ON blog_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Fix vector column type to use proper schema reference
-- =====================================================

-- Alter blog_posts embedding column to use extensions.vector
ALTER TABLE blog_posts 
    ALTER COLUMN embedding TYPE extensions.vector(1536) USING embedding::extensions.vector(1536);

-- =====================================================
-- Fix indexes to use proper schema references
-- =====================================================

-- Drop and recreate vector index with proper schema reference
DROP INDEX IF EXISTS idx_blog_posts_embedding;
CREATE INDEX idx_blog_posts_embedding 
    ON blog_posts 
    USING ivfflat (embedding extensions.vector_cosine_ops);

-- Drop and recreate trigram index with proper schema reference
DROP INDEX IF EXISTS idx_blog_posts_title_trgm;
CREATE INDEX idx_blog_posts_title_trgm 
    ON blog_posts 
    USING gin (title extensions.gin_trgm_ops);

-- =====================================================
-- Fix search_similar_posts function to use proper schema
-- =====================================================

DROP FUNCTION IF EXISTS search_similar_posts(extensions.vector, INT, FLOAT);

CREATE OR REPLACE FUNCTION search_similar_posts(
    query_embedding extensions.vector(1536),
    match_count INT DEFAULT 5,
    threshold FLOAT DEFAULT 0.7
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
    AND 1 - (bp.embedding <=> query_embedding) >= threshold
    ORDER BY bp.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Add missing performance indexes
-- =====================================================

-- Index for faster author profile lookups
CREATE INDEX IF NOT EXISTS idx_blog_authors_created_at 
    ON blog_authors(created_at DESC);

-- Index for filtering posts by created date
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at 
    ON blog_posts(created_at DESC);

-- Index for filtering published posts by date
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at 
    ON blog_posts(published_at DESC) 
    WHERE status = 'published';

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_author 
    ON blog_posts(status, author_id);

-- Index for category lookups by name
CREATE INDEX IF NOT EXISTS idx_blog_categories_name 
    ON blog_categories(name);

-- Index for tag lookups by name
CREATE INDEX IF NOT EXISTS idx_blog_tags_name 
    ON blog_tags(name);

-- Index for comment moderation workflows
CREATE INDEX IF NOT EXISTS idx_blog_comments_created_at 
    ON blog_comments(created_at DESC);

-- Index for finding pending comments
CREATE INDEX IF NOT EXISTS idx_blog_comments_status_created 
    ON blog_comments(status, created_at DESC) 
    WHERE status = 'pending';

-- =====================================================
-- Add comments for documentation
-- =====================================================

COMMENT ON TRIGGER update_blog_authors_updated_at ON blog_authors 
    IS 'Automatically updates the updated_at timestamp on row update';

COMMENT ON TRIGGER update_blog_posts_updated_at ON blog_posts 
    IS 'Automatically updates the updated_at timestamp on row update';

COMMENT ON TRIGGER update_blog_categories_updated_at ON blog_categories 
    IS 'Automatically updates the updated_at timestamp on row update';

COMMENT ON TRIGGER update_blog_comments_updated_at ON blog_comments 
    IS 'Automatically updates the updated_at timestamp on row update';

-- =====================================================
-- Verify extensions are accessible
-- =====================================================

-- Create a verification function to ensure extensions work properly
CREATE OR REPLACE FUNCTION verify_blog_extensions()
RETURNS TABLE (
    extension_name TEXT,
    is_installed BOOLEAN,
    schema_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.extname::TEXT,
        true,
        n.nspname::TEXT
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname IN ('vector', 'pg_trgm')
    ORDER BY e.extname;
END;
$$ LANGUAGE plpgsql;

-- Run verification and store results in a notice
DO $$
DECLARE
    ext_record RECORD;
BEGIN
    FOR ext_record IN SELECT * FROM verify_blog_extensions() LOOP
        RAISE NOTICE 'Extension % is installed in schema %', 
            ext_record.extension_name, ext_record.schema_name;
    END LOOP;
END $$;

-- Clean up verification function
DROP FUNCTION verify_blog_extensions();

-- =====================================================
-- Update search path for blog functions if needed
-- =====================================================

-- Ensure blog functions can find extensions
ALTER FUNCTION blog_posts_search_trigger() SET search_path = public, extensions;
ALTER FUNCTION search_similar_posts(extensions.vector, INT, FLOAT) SET search_path = public, extensions;

-- =====================================================
-- Migration complete
-- =====================================================