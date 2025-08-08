-- Migration: 030_search_suggestions_function.sql
-- Description: Create database functions for search suggestions and autocomplete
-- Author: DCE Platform Team  
-- Date: 2025-08-07

-- Drop existing functions if they exist (for idempotency)
DROP FUNCTION IF EXISTS public.get_search_suggestions CASCADE;
DROP FUNCTION IF EXISTS public.global_search CASCADE;
DROP FUNCTION IF EXISTS public.track_search_selection CASCADE;

-- Main search suggestions function
CREATE OR REPLACE FUNCTION public.get_search_suggestions(
    search_query TEXT,
    max_results INTEGER DEFAULT 5,
    user_role VARCHAR DEFAULT NULL,
    include_popular BOOLEAN DEFAULT true
)
RETURNS TABLE (
    suggestion TEXT,
    category VARCHAR,
    relevance_score FLOAT,
    usage_count INTEGER,
    metadata JSONB
) AS $$
DECLARE
    normalized_query TEXT;
BEGIN
    -- Normalize the search query
    normalized_query := normalize_search_query(search_query);
    
    -- Return empty if query is too short
    IF LENGTH(normalized_query) < 2 THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    WITH 
    -- Recent searches by the current user (personalized)
    user_recent AS (
        SELECT DISTINCT
            s.query as suggestion_text,
            s.search_category,
            1.0 as score,
            COUNT(*) as count,
            jsonb_build_object(
                'source', 'recent',
                'last_used', MAX(s.created_at)
            ) as meta
        FROM public.search_analytics s
        WHERE s.user_id = auth.uid()
            AND s.normalized_query LIKE normalized_query || '%'
            AND s.created_at >= NOW() - INTERVAL '30 days'
            AND s.result_count > 0
        GROUP BY s.query, s.search_category
        ORDER BY MAX(s.created_at) DESC
        LIMIT max_results
    ),
    -- Popular searches from all users
    popular AS (
        SELECT 
            p.query as suggestion_text,
            p.search_category,
            0.8 as score,
            p.search_count::INTEGER as count,
            jsonb_build_object(
                'source', 'popular',
                'click_through_rate', p.click_through_rate,
                'avg_results', p.avg_results
            ) as meta
        FROM public.popular_searches p
        WHERE p.query LIKE normalized_query || '%'
            AND include_popular = true
        ORDER BY p.search_count DESC
        LIMIT max_results
    ),
    -- Campaign name suggestions (if user has access)
    campaign_suggestions AS (
        SELECT DISTINCT
            c.name as suggestion_text,
            'campaigns'::VARCHAR as search_category,
            0.7 as score,
            0 as count,
            jsonb_build_object(
                'source', 'campaigns',
                'id', c.id,
                'status', c.status
            ) as meta
        FROM public.campaigns c
        WHERE LOWER(c.name) LIKE normalized_query || '%'
            AND (
                -- Check user access based on role
                (user_role = 'admin') OR
                (user_role = 'network') OR
                (user_role = 'buyer' AND c.buyer_id = auth.uid()) OR
                (user_role = 'supplier' AND EXISTS (
                    SELECT 1 FROM public.campaign_suppliers cs 
                    WHERE cs.campaign_id = c.id AND cs.supplier_id = auth.uid()
                ))
            )
        ORDER BY c.created_at DESC
        LIMIT max_results
    ),
    -- User/company suggestions (if admin or network)
    user_suggestions AS (
        SELECT DISTINCT
            COALESCE(up.display_name, up.company_name, up.first_name || ' ' || up.last_name) as suggestion_text,
            'users'::VARCHAR as search_category,
            0.6 as score,
            0 as count,
            jsonb_build_object(
                'source', 'users',
                'user_id', up.user_id,
                'role', up.role,
                'company', up.company_name
            ) as meta
        FROM public.user_profiles up
        WHERE up.search_visibility = true
            AND (
                LOWER(up.display_name) LIKE normalized_query || '%' OR
                LOWER(up.company_name) LIKE normalized_query || '%' OR
                LOWER(up.first_name || ' ' || up.last_name) LIKE normalized_query || '%'
            )
            AND (
                (user_role IN ('admin', 'network')) OR
                (user_role = 'buyer' AND up.role = 'supplier') OR
                (user_role = 'supplier' AND up.role = 'buyer')
            )
        ORDER BY up.last_active_at DESC NULLS LAST
        LIMIT max_results
    ),
    -- Combine all suggestions
    all_suggestions AS (
        SELECT * FROM user_recent
        UNION ALL
        SELECT * FROM popular
        UNION ALL
        SELECT * FROM campaign_suggestions
        UNION ALL
        SELECT * FROM user_suggestions
    )
    -- Return top suggestions ordered by relevance
    SELECT DISTINCT ON (suggestion_text)
        suggestion_text,
        search_category,
        MAX(score) as relevance_score,
        MAX(count) as usage_count,
        meta
    FROM all_suggestions
    GROUP BY suggestion_text, search_category, meta
    ORDER BY suggestion_text, MAX(score) DESC, MAX(count) DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Global search function that searches across multiple entities
CREATE OR REPLACE FUNCTION public.global_search(
    search_query TEXT,
    search_categories TEXT[] DEFAULT ARRAY['campaigns', 'calls', 'users', 'help'],
    user_role VARCHAR DEFAULT NULL,
    max_results INTEGER DEFAULT 20,
    fuzzy_match BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id TEXT,
    title TEXT,
    description TEXT,
    category VARCHAR,
    url TEXT,
    score FLOAT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    normalized_query TEXT;
    search_pattern TEXT;
BEGIN
    -- Normalize the search query
    normalized_query := normalize_search_query(search_query);
    
    -- Create search pattern (with or without fuzzy matching)
    IF fuzzy_match THEN
        search_pattern := '%' || normalized_query || '%';
    ELSE
        search_pattern := normalized_query || '%';
    END IF;
    
    RETURN QUERY
    WITH
    -- Search campaigns
    campaign_results AS (
        SELECT 
            c.id::TEXT,
            c.name as title,
            c.description,
            'campaigns'::VARCHAR as category,
            '/app/campaigns/' || c.id as url,
            ts_rank(c.search_vector, plainto_tsquery('english', normalized_query)) as score,
            jsonb_build_object(
                'status', c.status,
                'buyer_id', c.buyer_id,
                'target_cpa', c.target_cpa,
                'daily_budget', c.daily_budget
            ) as metadata,
            c.created_at
        FROM public.campaigns c
        WHERE 'campaigns' = ANY(search_categories)
            AND (
                c.search_vector @@ plainto_tsquery('english', normalized_query) OR
                LOWER(c.name) LIKE search_pattern OR
                LOWER(c.description) LIKE search_pattern
            )
            AND (
                (user_role = 'admin') OR
                (user_role = 'network') OR
                (user_role = 'buyer' AND c.buyer_id = auth.uid()) OR
                (user_role = 'supplier' AND EXISTS (
                    SELECT 1 FROM public.campaign_suppliers cs 
                    WHERE cs.campaign_id = c.id AND cs.supplier_id = auth.uid()
                ))
            )
    ),
    -- Search calls (limited access based on role)
    call_results AS (
        SELECT 
            c.id::TEXT,
            'Call from ' || c.phone_from as title,
            'Duration: ' || c.duration || 's, Status: ' || c.status as description,
            'calls'::VARCHAR as category,
            '/app/calls/' || c.id as url,
            CASE 
                WHEN LOWER(c.phone_from) LIKE search_pattern THEN 0.8
                WHEN LOWER(c.phone_to) LIKE search_pattern THEN 0.7
                ELSE 0.5
            END as score,
            jsonb_build_object(
                'campaign_id', c.campaign_id,
                'status', c.status,
                'duration', c.duration,
                'quality_score', c.quality_score
            ) as metadata,
            c.created_at
        FROM public.calls c
        WHERE 'calls' = ANY(search_categories)
            AND (
                LOWER(c.phone_from) LIKE search_pattern OR
                LOWER(c.phone_to) LIKE search_pattern OR
                c.id::TEXT LIKE search_pattern
            )
            AND (
                (user_role = 'admin') OR
                (user_role = 'network') OR
                (user_role = 'buyer' AND EXISTS (
                    SELECT 1 FROM public.campaigns camp
                    WHERE camp.id = c.campaign_id AND camp.buyer_id = auth.uid()
                )) OR
                (user_role = 'supplier' AND c.supplier_id = auth.uid())
            )
        LIMIT max_results / 4 -- Limit calls to prevent overwhelming results
    ),
    -- Search users/profiles
    user_results AS (
        SELECT 
            up.user_id::TEXT as id,
            COALESCE(up.display_name, up.company_name, up.first_name || ' ' || up.last_name) as title,
            COALESCE(up.bio, 'Role: ' || up.role) as description,
            'users'::VARCHAR as category,
            '/app/users/' || up.user_id as url,
            ts_rank(up.search_vector, plainto_tsquery('english', normalized_query)) as score,
            jsonb_build_object(
                'role', up.role,
                'company', up.company_name,
                'active', up.last_active_at
            ) as metadata,
            up.created_at
        FROM public.user_profiles up
        WHERE 'users' = ANY(search_categories)
            AND up.search_visibility = true
            AND (
                up.search_vector @@ plainto_tsquery('english', normalized_query) OR
                LOWER(up.display_name) LIKE search_pattern OR
                LOWER(up.company_name) LIKE search_pattern OR
                LOWER(up.first_name || ' ' || up.last_name) LIKE search_pattern
            )
            AND (
                (user_role IN ('admin', 'network')) OR
                (user_role = 'buyer' AND up.role = 'supplier') OR
                (user_role = 'supplier' AND up.role = 'buyer') OR
                (up.user_id = auth.uid()) -- Users can always find themselves
            )
    ),
    -- Static help/documentation results
    help_results AS (
        SELECT * FROM (
            VALUES
            ('help-1', 'Getting Started Guide', 'Learn how to get started with DCE platform', 'help'::VARCHAR, '/help/getting-started', 0.5::FLOAT, '{}'::JSONB, NOW()),
            ('help-2', 'Campaign Setup', 'How to create and manage campaigns', 'help'::VARCHAR, '/help/campaigns', 0.5::FLOAT, '{}'::JSONB, NOW()),
            ('help-3', 'API Documentation', 'Technical documentation for API integration', 'help'::VARCHAR, '/help/api', 0.5::FLOAT, '{}'::JSONB, NOW()),
            ('help-4', 'Billing & Payments', 'Understanding billing and payment processes', 'help'::VARCHAR, '/help/billing', 0.5::FLOAT, '{}'::JSONB, NOW()),
            ('help-5', 'Contact Support', 'Get help from our support team', 'help'::VARCHAR, '/contact', 0.5::FLOAT, '{}'::JSONB, NOW())
        ) AS t(id, title, description, category, url, score, metadata, created_at)
        WHERE 'help' = ANY(search_categories)
            AND (
                LOWER(title) LIKE search_pattern OR
                LOWER(description) LIKE search_pattern
            )
    ),
    -- Combine all results
    all_results AS (
        SELECT * FROM campaign_results
        UNION ALL
        SELECT * FROM call_results
        UNION ALL
        SELECT * FROM user_results
        UNION ALL
        SELECT * FROM help_results
    )
    -- Return sorted results
    SELECT *
    FROM all_results
    ORDER BY score DESC, created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track when a user selects a search result
CREATE OR REPLACE FUNCTION public.track_search_selection(
    search_id UUID,
    selected_id TEXT,
    selected_position INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.search_analytics
    SET 
        selected_result_id = selected_id,
        selected_result_position = selected_position
    WHERE id = search_id
        AND user_id = auth.uid(); -- Ensure user can only update their own searches
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get trending searches
CREATE OR REPLACE FUNCTION public.get_trending_searches(
    time_window INTERVAL DEFAULT INTERVAL '24 hours',
    limit_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    query TEXT,
    trend_score FLOAT,
    current_count BIGINT,
    previous_count BIGINT,
    growth_rate FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH current_period AS (
        SELECT 
            normalized_query,
            COUNT(*) as count
        FROM public.search_analytics
        WHERE created_at >= NOW() - time_window
            AND normalized_query IS NOT NULL
        GROUP BY normalized_query
    ),
    previous_period AS (
        SELECT 
            normalized_query,
            COUNT(*) as count
        FROM public.search_analytics
        WHERE created_at >= NOW() - (time_window * 2)
            AND created_at < NOW() - time_window
            AND normalized_query IS NOT NULL
        GROUP BY normalized_query
    )
    SELECT 
        c.normalized_query as query,
        (c.count::FLOAT / GREATEST(COALESCE(p.count, 1), 1)) as trend_score,
        c.count as current_count,
        COALESCE(p.count, 0) as previous_count,
        ((c.count - COALESCE(p.count, 0))::FLOAT / GREATEST(COALESCE(p.count, 1), 1)) * 100 as growth_rate
    FROM current_period c
    LEFT JOIN previous_period p ON c.normalized_query = p.normalized_query
    WHERE c.count >= 3 -- Minimum threshold for trending
    ORDER BY trend_score DESC, c.count DESC
    LIMIT limit_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for functions
GRANT EXECUTE ON FUNCTION public.get_search_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION public.global_search TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_search_selection TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trending_searches TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.get_search_suggestions IS 'Returns personalized search suggestions based on user history and popular searches';
COMMENT ON FUNCTION public.global_search IS 'Performs full-text search across campaigns, calls, users, and help documents';
COMMENT ON FUNCTION public.track_search_selection IS 'Records when a user selects a search result for analytics';
COMMENT ON FUNCTION public.get_trending_searches IS 'Returns trending search queries based on growth rate';

-- Create scheduled job to refresh popular searches materialized view
-- This would typically be done via pg_cron or an Edge Function
-- SELECT cron.schedule('refresh-popular-searches', '0 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.popular_searches;');