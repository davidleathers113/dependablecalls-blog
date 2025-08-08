-- Migration: 029_search_analytics_table.sql
-- Description: Create search_analytics table for tracking and optimizing search queries
-- Author: DCE Platform Team
-- Date: 2025-08-07

-- Drop existing objects if they exist (for idempotency)
DROP TABLE IF EXISTS public.search_analytics CASCADE;

-- Create search_analytics table
CREATE TABLE public.search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    normalized_query TEXT, -- Lowercase, trimmed version for aggregation
    result_count INTEGER NOT NULL DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_role VARCHAR(50),
    search_time_ms INTEGER,
    selected_result_id TEXT,
    selected_result_position INTEGER,
    search_filters JSONB DEFAULT '{}'::jsonb,
    search_category VARCHAR(100), -- campaigns, calls, users, global
    search_source VARCHAR(50), -- header, dashboard, quick_search, advanced
    session_id UUID,
    ip_address INET,
    user_agent TEXT,
    viewport_size JSONB, -- {width: 1920, height: 1080}
    device_type VARCHAR(20), -- desktop, tablet, mobile
    browser VARCHAR(50),
    os VARCHAR(50),
    country_code VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    is_successful BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Alias for compatibility
);

-- Create indexes for performance
CREATE INDEX idx_search_analytics_query ON public.search_analytics(query);
CREATE INDEX idx_search_analytics_normalized_query ON public.search_analytics(normalized_query);
CREATE INDEX idx_search_analytics_user_id ON public.search_analytics(user_id);
CREATE INDEX idx_search_analytics_user_role ON public.search_analytics(user_role);
CREATE INDEX idx_search_analytics_created_at ON public.search_analytics(created_at DESC);
CREATE INDEX idx_search_analytics_search_category ON public.search_analytics(search_category);
CREATE INDEX idx_search_analytics_result_count ON public.search_analytics(result_count);
CREATE INDEX idx_search_analytics_session_id ON public.search_analytics(session_id);
CREATE INDEX idx_search_analytics_selected_result ON public.search_analytics(selected_result_id) WHERE selected_result_id IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_search_analytics_user_date ON public.search_analytics(user_id, created_at DESC);
CREATE INDEX idx_search_analytics_category_date ON public.search_analytics(search_category, created_at DESC);
CREATE INDEX idx_search_analytics_query_category ON public.search_analytics(normalized_query, search_category);

-- GIN index for JSONB search filters
CREATE INDEX idx_search_analytics_filters_gin ON public.search_analytics USING gin(search_filters);

-- Partial indexes for performance
CREATE INDEX idx_search_analytics_no_results ON public.search_analytics(query, created_at) WHERE result_count = 0;
CREATE INDEX idx_search_analytics_with_selection ON public.search_analytics(query, selected_result_id) WHERE selected_result_id IS NOT NULL;

-- Function to normalize search queries for aggregation
CREATE OR REPLACE FUNCTION normalize_search_query(query_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Convert to lowercase, trim whitespace, remove extra spaces
    RETURN LOWER(TRIM(regexp_replace(query_text, '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to automatically normalize queries
CREATE OR REPLACE FUNCTION normalize_search_query_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.normalized_query := normalize_search_query(NEW.query);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_search_query_on_insert
    BEFORE INSERT ON public.search_analytics
    FOR EACH ROW EXECUTE FUNCTION normalize_search_query_trigger();

-- Enable Row Level Security
ALTER TABLE public.search_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for search_analytics

-- Policy: Users can view their own search history
CREATE POLICY "Users can view own searches" ON public.search_analytics
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own searches
CREATE POLICY "Users can track own searches" ON public.search_analytics
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Admins can view all search analytics
CREATE POLICY "Admins can view all search analytics" ON public.search_analytics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Network role can view aggregated analytics (no PII)
CREATE POLICY "Network can view anonymized analytics" ON public.search_analytics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'network'
        )
    );

-- Materialized view for popular searches (refreshed hourly)
CREATE MATERIALIZED VIEW public.popular_searches AS
SELECT 
    normalized_query as query,
    search_category,
    COUNT(*) as search_count,
    AVG(result_count)::INTEGER as avg_results,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(selected_result_id) as clicks,
    CASE 
        WHEN COUNT(*) > 0 THEN COUNT(selected_result_id)::FLOAT / COUNT(*)::FLOAT
        ELSE 0 
    END as click_through_rate,
    MAX(created_at) as last_searched,
    DATE_TRUNC('hour', MIN(created_at)) as first_searched
FROM public.search_analytics
WHERE created_at >= NOW() - INTERVAL '30 days'
    AND normalized_query IS NOT NULL
    AND LENGTH(normalized_query) > 2
GROUP BY normalized_query, search_category
HAVING COUNT(*) >= 3 -- Only show searches with at least 3 occurrences
ORDER BY search_count DESC;

-- Create index on materialized view
CREATE INDEX idx_popular_searches_query ON public.popular_searches(query);
CREATE INDEX idx_popular_searches_category ON public.popular_searches(search_category);
CREATE INDEX idx_popular_searches_count ON public.popular_searches(search_count DESC);

-- Function to get search performance metrics
CREATE OR REPLACE FUNCTION get_search_performance_metrics(
    time_range INTERVAL DEFAULT INTERVAL '7 days',
    category VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    total_searches BIGINT,
    unique_users BIGINT,
    avg_search_time_ms NUMERIC,
    avg_results_per_search NUMERIC,
    no_results_rate NUMERIC,
    click_through_rate NUMERIC,
    top_queries JSONB,
    searches_by_category JSONB,
    searches_by_hour JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH metrics AS (
        SELECT
            COUNT(*) as total,
            COUNT(DISTINCT user_id) as users,
            AVG(search_time_ms)::NUMERIC as avg_time,
            AVG(result_count)::NUMERIC as avg_results,
            SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0) as no_results,
            SUM(CASE WHEN selected_result_id IS NOT NULL THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0) as ctr
        FROM public.search_analytics
        WHERE created_at >= NOW() - time_range
            AND (category IS NULL OR search_category = category)
    ),
    top AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'query', normalized_query,
                'count', query_count
            ) ORDER BY query_count DESC
        ) as queries
        FROM (
            SELECT normalized_query, COUNT(*) as query_count
            FROM public.search_analytics
            WHERE created_at >= NOW() - time_range
                AND (category IS NULL OR search_category = category)
                AND normalized_query IS NOT NULL
            GROUP BY normalized_query
            ORDER BY query_count DESC
            LIMIT 10
        ) t
    ),
    categories AS (
        SELECT jsonb_object_agg(
            search_category,
            count
        ) as by_category
        FROM (
            SELECT search_category, COUNT(*) as count
            FROM public.search_analytics
            WHERE created_at >= NOW() - time_range
                AND search_category IS NOT NULL
            GROUP BY search_category
        ) c
    ),
    hourly AS (
        SELECT jsonb_object_agg(
            hour::TEXT,
            count
        ) as by_hour
        FROM (
            SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
            FROM public.search_analytics
            WHERE created_at >= NOW() - time_range
                AND (category IS NULL OR search_category = category)
            GROUP BY hour
            ORDER BY hour
        ) h
    )
    SELECT 
        m.total,
        m.users,
        m.avg_time,
        m.avg_results,
        m.no_results,
        m.ctr,
        t.queries,
        c.by_category,
        h.by_hour
    FROM metrics m, top t, categories c, hourly h;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old analytics data (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_search_analytics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.search_analytics
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    RAISE NOTICE 'Cleaned up % old search analytics records', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (requires pg_cron extension)
-- This would be run by a scheduled job or Edge Function
-- SELECT cron.schedule('cleanup-search-analytics', '0 3 * * *', 'SELECT cleanup_old_search_analytics();');

-- Grant permissions
GRANT SELECT ON public.search_analytics TO authenticated;
GRANT INSERT ON public.search_analytics TO authenticated;
GRANT SELECT ON public.popular_searches TO authenticated;

-- Grant function execution
GRANT EXECUTE ON FUNCTION get_search_performance_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION normalize_search_query TO authenticated;

-- Add helpful comments
COMMENT ON TABLE public.search_analytics IS 'Tracks all search queries for analytics and optimization';
COMMENT ON COLUMN public.search_analytics.normalized_query IS 'Lowercase, trimmed query for aggregation';
COMMENT ON COLUMN public.search_analytics.search_time_ms IS 'Time taken to execute search in milliseconds';
COMMENT ON COLUMN public.search_analytics.selected_result_id IS 'ID of the result user clicked on';
COMMENT ON COLUMN public.search_analytics.search_filters IS 'Applied filters in JSON format';
COMMENT ON COLUMN public.search_analytics.search_category IS 'Type of search: campaigns, calls, users, or global';
COMMENT ON MATERIALIZED VIEW public.popular_searches IS 'Aggregated popular searches, refreshed hourly';
COMMENT ON FUNCTION get_search_performance_metrics IS 'Returns comprehensive search performance metrics';