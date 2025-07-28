-- Database Monitoring Support Functions
-- Provides functions for connection monitoring, query analysis, and system health

-- ============================================================================
-- 1. CONNECTION MONITORING FUNCTIONS
-- ============================================================================

-- Function to get current database connections
CREATE OR REPLACE FUNCTION get_database_connections()
RETURNS TABLE (
  pid INTEGER,
  client_addr INET,
  client_hostname TEXT,
  client_port INTEGER,
  datname VARCHAR(100),
  usename VARCHAR(100),
  application_name TEXT,
  backend_start TIMESTAMPTZ,
  query_start TIMESTAMPTZ,
  state_change TIMESTAMPTZ,
  state VARCHAR(50),
  query TEXT,
  wait_event_type VARCHAR(50),
  wait_event VARCHAR(100),
  ssl BOOLEAN,
  ssl_version TEXT,
  ssl_cipher TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    psa.pid,
    psa.client_addr,
    psa.client_hostname,
    psa.client_port,
    psa.datname,
    psa.usename,
    psa.application_name,
    psa.backend_start,
    psa.query_start,
    psa.state_change,
    psa.state,
    CASE 
      WHEN psa.state = 'active' THEN psa.query
      ELSE NULL
    END as query,
    psa.wait_event_type,
    psa.wait_event,
    CASE 
      WHEN ssl.ssl IS NOT NULL THEN true
      ELSE false
    END as ssl,
    ssl.version as ssl_version,
    ssl.cipher as ssl_cipher
  FROM pg_stat_activity psa
  LEFT JOIN pg_stat_ssl ssl ON psa.pid = ssl.pid
  WHERE psa.datname IS NOT NULL
    AND psa.pid != pg_backend_pid(); -- Exclude current connection
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get connection pool statistics
CREATE OR REPLACE FUNCTION get_connection_pool_stats()
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'total_connections', (SELECT count(*) FROM pg_stat_activity WHERE datname IS NOT NULL),
    'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
    'idle_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle'),
    'idle_in_transaction', (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction'),
    'max_connections', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'),
    'superuser_reserved_connections', (SELECT setting::int FROM pg_settings WHERE name = 'superuser_reserved_connections'),
    'connections_by_database', (
      SELECT json_object_agg(datname, connection_count)
      FROM (
        SELECT datname, count(*) as connection_count
        FROM pg_stat_activity 
        WHERE datname IS NOT NULL 
        GROUP BY datname
      ) db_stats
    ),
    'connections_by_state', (
      SELECT json_object_agg(state, connection_count)
      FROM (
        SELECT state, count(*) as connection_count
        FROM pg_stat_activity 
        WHERE datname IS NOT NULL 
        GROUP BY state
      ) state_stats
    ),
    'long_running_connections', (
      SELECT count(*)
      FROM pg_stat_activity
      WHERE state = 'active' 
        AND query_start < NOW() - INTERVAL '5 minutes'
    )
  ) INTO stats;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get long-running queries
CREATE OR REPLACE FUNCTION get_long_running_queries()
RETURNS TABLE (
  pid INTEGER,
  usename VARCHAR(100),
  datname VARCHAR(100),
  client_addr INET,
  query_start TIMESTAMPTZ,
  duration INTERVAL,
  state VARCHAR(50),
  query TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    psa.pid,
    psa.usename,
    psa.datname,
    psa.client_addr,
    psa.query_start,
    NOW() - psa.query_start as duration,
    psa.state,
    psa.query
  FROM pg_stat_activity psa
  WHERE psa.state = 'active'
    AND psa.query_start < NOW() - INTERVAL '5 minutes'
    AND psa.datname IS NOT NULL
    AND psa.pid != pg_backend_pid()
  ORDER BY duration DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. QUERY ANALYSIS FUNCTIONS
-- ============================================================================

-- Function to get recent queries (requires pg_stat_statements extension)
CREATE OR REPLACE FUNCTION get_recent_queries(time_window_minutes INTEGER DEFAULT 5)
RETURNS TABLE (
  query_text TEXT,
  user_id UUID,
  calls BIGINT,
  total_time FLOAT,
  mean_time FLOAT,
  rows BIGINT,
  first_seen TIMESTAMPTZ
) AS $$
BEGIN
  -- Check if pg_stat_statements is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
    RAISE NOTICE 'pg_stat_statements extension not available, returning empty result';
    RETURN;
  END IF;
  
  RETURN QUERY
  EXECUTE format('
    WITH recent_queries AS (
      SELECT 
        pss.query,
        pss.calls,
        pss.total_exec_time as total_time,
        pss.mean_exec_time as mean_time,
        pss.rows,
        COALESCE(pss.first_seen, NOW() - INTERVAL ''%s minutes'') as first_seen,
        NULL::UUID as user_id
      FROM pg_stat_statements pss
      WHERE pss.first_seen >= NOW() - INTERVAL ''%s minutes''
        OR pss.first_seen IS NULL
      ORDER BY pss.total_exec_time DESC
      LIMIT 100
    )
    SELECT 
      rq.query as query_text,
      rq.user_id,
      rq.calls,
      rq.total_time,
      rq.mean_time,
      rq.rows,
      rq.first_seen
    FROM recent_queries rq',
    time_window_minutes, time_window_minutes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced query security analysis function
CREATE OR REPLACE FUNCTION analyze_query_security(
  query_text TEXT,
  user_uuid UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  risk_score INTEGER := 0;
  security_flags JSONB := '{}';
  normalized_query TEXT;
  suspicious_patterns TEXT[] := ARRAY[
    'union.*select', 'drop\s+table', 'truncate\s+table', 'delete.*from.*where\s+1\s*=\s*1',
    'exec\s*\(', 'sp_executesql', 'xp_cmdshell', 'pg_sleep', 'waitfor\s+delay',
    'load_file', 'into\s+outfile', 'dumpfile', 'information_schema\..*',
    'pg_user', 'pg_shadow', 'current_user\s*\(\s*\)', 'version\s*\(\s*\)',
    'pg_read_file', 'copy.*from.*program', 'lo_import', 'lo_export',
    'create\s+function.*language.*plpythonu', 'create\s+function.*language.*plperlu',
    '\$\$.*system\s*\(', '\$\$.*os\.', 'create\s+or\s+replace\s+function.*untrusted'
  ];
  advanced_patterns TEXT[] := ARRAY[
    -- Time-based SQL injection
    'sleep\s*\(\s*\d+\s*\)', 'pg_sleep\s*\(\s*\d+\s*\)', 'benchmark\s*\(',
    -- Boolean-based blind injection
    'and\s+1\s*=\s*1', 'or\s+1\s*=\s*1', 'and\s+''1''\s*=\s*''1''',
    -- UNION-based injection
    'union\s+select.*null', 'union\s+all\s+select',
    -- Error-based injection
    'extractvalue\s*\(', 'updatexml\s*\(', 'floor\s*\(\s*rand\s*\(\s*0\s*\)\s*\*\s*2\s*\)',
    -- System function access
    'current_database\s*\(\s*\)', 'current_schema\s*\(\s*\)',
    -- File system access
    'pg_ls_dir\s*\(', 'pg_read_binary_file\s*\(', 'pg_stat_file\s*\(',
    -- Network access
    'dblink\s*\(', 'dblink_connect\s*\(',
    -- Administrative functions
    'pg_reload_conf\s*\(\s*\)', 'pg_rotate_logfile\s*\(\s*\)',
    -- Large object functions
    'lo_creat\s*\(', 'lo_unlink\s*\(',
    -- Extension loading
    'create\s+extension', 'drop\s+extension'
  ];
  pattern TEXT;
  query_lower TEXT;
  word_count INTEGER;
  table_count INTEGER;
  comment_count INTEGER;
BEGIN
  query_lower := lower(query_text);
  normalized_query := regexp_replace(query_lower, '\s+', ' ', 'g');
  normalized_query := trim(normalized_query);
  
  -- Count various query characteristics
  word_count := array_length(string_to_array(normalized_query, ' '), 1);
  table_count := (SELECT count(*) FROM regexp_split_to_table(query_lower, '\s+') AS word 
                  WHERE word ~ '^[a-zA-Z_][a-zA-Z0-9_]*$' AND length(word) > 2);
  comment_count := (length(query_text) - length(replace(query_text, '--', ''))) / 2 +
                   (length(query_text) - length(replace(query_text, '/*', ''))) / 2;
  
  -- Basic suspicious patterns check
  FOREACH pattern IN ARRAY suspicious_patterns
  LOOP
    IF query_lower ~ pattern THEN
      risk_score := risk_score + 25;
      security_flags := security_flags || jsonb_build_object('basic_sql_injection_risk', true);
      security_flags := security_flags || jsonb_build_object('matched_pattern', pattern);
    END IF;
  END LOOP;
  
  -- Advanced patterns check
  FOREACH pattern IN ARRAY advanced_patterns
  LOOP
    IF query_lower ~ pattern THEN
      risk_score := risk_score + 15;
      security_flags := security_flags || jsonb_build_object('advanced_injection_pattern', true);
      security_flags := security_flags || jsonb_build_object('advanced_pattern', pattern);
    END IF;
  END LOOP;
  
  -- Check for excessive wildcards or overly broad selects
  IF (LENGTH(query_lower) - LENGTH(REPLACE(query_lower, '*', ''))) > 5 THEN
    risk_score := risk_score + 10;
    security_flags := security_flags || jsonb_build_object('excessive_wildcards', true);
  END IF;
  
  -- Check for missing WHERE clauses in DELETE/UPDATE
  IF query_lower ~ 'delete\s+from\s+\w+' AND query_lower !~ '\s+where\s+' THEN
    risk_score := risk_score + 35;
    security_flags := security_flags || jsonb_build_object('unsafe_delete', true);
  END IF;
  
  IF query_lower ~ 'update\s+\w+\s+set\s+' AND query_lower !~ '\s+where\s+' THEN
    risk_score := risk_score + 35;
    security_flags := security_flags || jsonb_build_object('unsafe_update', true);
  END IF;
  
  -- Check for potential data exfiltration patterns
  IF query_lower ~ 'select.*from.*information_schema' THEN
    risk_score := risk_score + 20;
    security_flags := security_flags || jsonb_build_object('schema_enumeration', true);
  END IF;
  
  -- Check for overly complex queries (potential obfuscation)
  IF word_count > 200 THEN
    risk_score := risk_score + 15;
    security_flags := security_flags || jsonb_build_object('overly_complex_query', true);
  END IF;
  
  -- Check for excessive comments (potential evasion technique)
  IF comment_count > 5 THEN
    risk_score := risk_score + 10;
    security_flags := security_flags || jsonb_build_object('excessive_comments', true);
  END IF;
  
  -- Check for encoded content
  IF query_lower ~ 'chr\s*\(\s*\d+\s*\)' OR query_lower ~ 'ascii\s*\(' OR query_lower ~ 'hex\s*\(' THEN
    risk_score := risk_score + 20;
    security_flags := security_flags || jsonb_build_object('encoded_content', true);
  END IF;
  
  -- Check for stacked queries (multiple statements)
  IF (LENGTH(query_text) - LENGTH(REPLACE(query_text, ';', ''))) > 1 THEN
    risk_score := risk_score + 15;
    security_flags := security_flags || jsonb_build_object('stacked_queries', true);
  END IF;
  
  -- Check for privilege escalation attempts
  IF query_lower ~ 'alter\s+user.*superuser' OR query_lower ~ 'grant.*superuser' THEN
    risk_score := risk_score + 40;
    security_flags := security_flags || jsonb_build_object('privilege_escalation', true);
  END IF;
  
  -- Check for function creation with dangerous languages
  IF query_lower ~ 'create.*function.*language.*(plpython|plperl|plsh|pltcl)' THEN
    risk_score := risk_score + 30;
    security_flags := security_flags || jsonb_build_object('dangerous_function_creation', true);
  END IF;
  
  -- Time-based analysis - queries executed at unusual times
  IF EXTRACT(hour FROM NOW()) NOT BETWEEN 8 AND 18 THEN
    risk_score := risk_score + 5;
    security_flags := security_flags || jsonb_build_object('off_hours_execution', true);
  END IF;
  
  -- User-based risk factors
  IF user_uuid IS NOT NULL THEN
    -- Check if user has had recent security incidents
    IF EXISTS (
      SELECT 1 FROM security_audit_log 
      WHERE user_id = user_uuid 
        AND risk_level IN ('high', 'critical')
        AND created_at > NOW() - INTERVAL '24 hours'
    ) THEN
      risk_score := risk_score + 15;
      security_flags := security_flags || jsonb_build_object('user_recent_incidents', true);
    END IF;
  END IF;
  
  -- Cap risk score at 100
  risk_score := LEAST(risk_score, 100);
  
  -- Add risk assessment metadata
  security_flags := security_flags || jsonb_build_object(
    'query_length', LENGTH(query_text),
    'word_count', word_count,
    'table_count', table_count,
    'comment_count', comment_count,
    'analysis_timestamp', NOW()
  );
  
  RETURN jsonb_build_object(
    'risk_score', risk_score,
    'security_flags', security_flags,
    'normalized_query', normalized_query,
    'risk_level', CASE 
      WHEN risk_score >= 80 THEN 'critical'
      WHEN risk_score >= 60 THEN 'high'
      WHEN risk_score >= 40 THEN 'medium'
      ELSE 'low'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. SYSTEM HEALTH FUNCTIONS
-- ============================================================================

-- Function to get system health statistics
CREATE OR REPLACE FUNCTION get_system_health_stats()
RETURNS JSON AS $$
DECLARE
  health_stats JSON;
BEGIN
  SELECT json_build_object(
    'database_size', pg_size_pretty(pg_database_size(current_database())),
    'database_size_bytes', pg_database_size(current_database()),
    'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
    'total_connections', (SELECT count(*) FROM pg_stat_activity WHERE datname IS NOT NULL),
    'cache_hit_ratio', (
      SELECT round(
        (sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0)) * 100, 2
      )
      FROM pg_statio_user_tables
    ),
    'index_usage_ratio', (
      SELECT round(
        (sum(idx_blks_hit) / nullif(sum(idx_blks_hit) + sum(idx_blks_read), 0)) * 100, 2
      )
      FROM pg_statio_user_indexes
    ),
    'deadlock_count', (SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()),
    'temp_files', (SELECT temp_files FROM pg_stat_database WHERE datname = current_database()),
    'temp_bytes', pg_size_pretty((SELECT temp_bytes FROM pg_stat_database WHERE datname = current_database())),
    'transactions_per_second', (
      SELECT round(
        (xact_commit + xact_rollback) / 
        GREATEST(1, EXTRACT(epoch FROM (now() - stats_reset))), 2
      )
      FROM pg_stat_database 
      WHERE datname = current_database()
    ),
    'commit_ratio', (
      SELECT round(
        (xact_commit::float / GREATEST(1, xact_commit + xact_rollback)) * 100, 2
      )
      FROM pg_stat_database 
      WHERE datname = current_database()
    ),
    'slowest_queries', (
      SELECT json_agg(
        json_build_object(
          'query', left(query, 100) || '...',
          'calls', calls,
          'total_time', round(total_exec_time::numeric, 2),
          'mean_time', round(mean_exec_time::numeric, 2)
        )
      )
      FROM (
        SELECT query, calls, total_exec_time, mean_exec_time
        FROM pg_stat_statements
        WHERE calls > 1
        ORDER BY total_exec_time DESC
        LIMIT 5
      ) slow_queries
    ),
    'table_bloat', (
      SELECT json_agg(
        json_build_object(
          'table_name', schemaname || '.' || tablename,
          'size', pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)),
          'dead_tuples', n_dead_tup,
          'live_tuples', n_tup_ins - n_tup_del
        )
      )
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 1000
      ORDER BY n_dead_tup DESC
      LIMIT 5
    ),
    'replication_lag', (
      CASE 
        WHEN EXISTS (SELECT 1 FROM pg_stat_replication) THEN
          (SELECT json_agg(
            json_build_object(
              'client_addr', client_addr,
              'state', state,
              'sync_state', sync_state,
              'lag_bytes', pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn)
            )
          ) FROM pg_stat_replication)
        ELSE NULL
      END
    )
  ) INTO health_stats;
  
  RETURN health_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. SECURITY MONITORING FUNCTIONS
-- ============================================================================

-- Function to detect suspicious login patterns
CREATE OR REPLACE FUNCTION detect_suspicious_logins()
RETURNS TABLE (
  user_id UUID,
  suspicious_pattern VARCHAR(50),
  event_count BIGINT,
  time_window INTERVAL,
  details JSONB
) AS $$
BEGIN
  RETURN QUERY
  -- Multiple failed logins from same IP
  WITH failed_logins AS (
    SELECT 
      sal.user_id,
      sal.event_data->>'ip_address' as ip_address,
      count(*) as failure_count
    FROM security_audit_log sal
    WHERE sal.event_type = 'auth_failure'
      AND sal.created_at > NOW() - INTERVAL '1 hour'
    GROUP BY sal.user_id, sal.event_data->>'ip_address'
    HAVING count(*) >= 5
  ),
  -- Rapid succession logins from different IPs
  rapid_logins AS (
    SELECT 
      sal.user_id,
      count(DISTINCT sal.event_data->>'ip_address') as ip_count,
      count(*) as login_count
    FROM security_audit_log sal
    WHERE sal.event_type IN ('auth_success', 'auth_failure')
      AND sal.created_at > NOW() - INTERVAL '15 minutes'
    GROUP BY sal.user_id
    HAVING count(DISTINCT sal.event_data->>'ip_address') >= 3
  )
  SELECT 
    fl.user_id,
    'multiple_failed_logins'::VARCHAR(50),
    fl.failure_count,
    INTERVAL '1 hour',
    jsonb_build_object('ip_address', fl.ip_address, 'failure_count', fl.failure_count)
  FROM failed_logins fl
  
  UNION ALL
  
  SELECT 
    rl.user_id,
    'rapid_multi_ip_logins'::VARCHAR(50),
    rl.login_count,
    INTERVAL '15 minutes',
    jsonb_build_object('ip_count', rl.ip_count, 'login_count', rl.login_count)
  FROM rapid_logins rl;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to analyze data access patterns
CREATE OR REPLACE FUNCTION analyze_data_access_patterns()
RETURNS TABLE (
  user_id UUID,
  access_pattern VARCHAR(50),
  risk_score INTEGER,
  details JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH access_stats AS (
    SELECT 
      daa.user_id,
      daa.table_name,
      daa.operation,
      count(*) as access_count,
      array_agg(DISTINCT daa.classification_level) as access_levels,
      min(daa.created_at) as first_access,
      max(daa.created_at) as last_access
    FROM data_access_audit daa
    WHERE daa.created_at > NOW() - INTERVAL '24 hours'
    GROUP BY daa.user_id, daa.table_name, daa.operation
  ),
  suspicious_access AS (
    SELECT 
      a.user_id,
      CASE 
        WHEN a.access_count > 1000 THEN 'excessive_data_access'
        WHEN 'restricted' = ANY(a.access_levels) THEN 'restricted_data_access'
        WHEN a.operation = 'SELECT' AND a.access_count > 500 THEN 'potential_data_exfiltration'
        ELSE 'unusual_access_pattern'
      END as pattern,
      CASE 
        WHEN a.access_count > 1000 OR 'restricted' = ANY(a.access_levels) THEN 80
        WHEN a.access_count > 500 THEN 60
        ELSE 40
      END as risk_score,
      jsonb_build_object(
        'table_name', a.table_name,
        'operation', a.operation,
        'access_count', a.access_count,
        'access_levels', a.access_levels,
        'time_span', a.last_access - a.first_access
      ) as details
    FROM access_stats a
    WHERE a.access_count > 100 
       OR 'restricted' = ANY(a.access_levels)
       OR 'confidential' = ANY(a.access_levels)
  )
  SELECT 
    sa.user_id,
    sa.pattern,
    sa.risk_score,
    sa.details
  FROM suspicious_access sa;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. AUTOMATED SECURITY RESPONSE FUNCTIONS
-- ============================================================================

-- Function to automatically block suspicious queries
CREATE OR REPLACE FUNCTION auto_block_suspicious_query(
  query_hash VARCHAR(64),
  risk_score INTEGER,
  user_uuid UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  should_block BOOLEAN := false;
BEGIN
  -- Block queries with very high risk scores
  IF risk_score >= 90 THEN
    should_block := true;
  END IF;
  
  -- Block queries from users with recent security incidents
  IF user_uuid IS NOT NULL AND risk_score >= 70 THEN
    IF EXISTS (
      SELECT 1 FROM security_incidents si
      WHERE si.evidence->>'user_id' = user_uuid::text
        AND si.severity IN ('high', 'critical')
        AND si.created_at > NOW() - INTERVAL '1 hour'
    ) THEN
      should_block := true;
    END IF;
  END IF;
  
  -- Log the decision
  INSERT INTO security_audit_log (
    event_type, event_data, risk_level
  ) VALUES (
    'query_block_decision',
    jsonb_build_object(
      'query_hash', query_hash,
      'risk_score', risk_score,
      'user_id', user_uuid,
      'blocked', should_block
    ),
    CASE WHEN should_block THEN 'high' ELSE 'medium' END
  );
  
  RETURN should_block;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to escalate security incidents
CREATE OR REPLACE FUNCTION escalate_security_incident(incident_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
  incident RECORD;
  escalation_rules JSONB;
BEGIN
  -- Get incident details
  SELECT * INTO incident FROM security_incidents WHERE id = incident_id;
  
  IF incident IS NULL THEN
    RETURN false;
  END IF;
  
  -- Define escalation rules
  escalation_rules := '{
    "critical": {"escalate_after_minutes": 5, "notify_levels": ["admin", "security_team", "on_call"]},
    "high": {"escalate_after_minutes": 15, "notify_levels": ["admin", "security_team"]},
    "medium": {"escalate_after_minutes": 60, "notify_levels": ["admin"]},
    "low": {"escalate_after_minutes": 240, "notify_levels": ["admin"]}
  }'::jsonb;
  
  -- Check if incident should be escalated based on time and severity
  IF incident.created_at + (escalation_rules->incident.severity->>'escalate_after_minutes')::interval * INTERVAL '1 minute' < NOW() 
     AND incident.status != 'resolved' THEN
    
    -- Update incident status to escalated
    UPDATE security_incidents 
    SET status = 'escalated', updated_at = NOW()
    WHERE id = incident_id;
    
    -- Log escalation
    INSERT INTO security_audit_log (
      event_type, event_data, risk_level
    ) VALUES (
      'incident_escalated',
      jsonb_build_object(
        'incident_id', incident_id,
        'original_severity', incident.severity,
        'escalation_reason', 'time_threshold_exceeded'
      ),
      'high'
    );
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users for monitoring functions
GRANT EXECUTE ON FUNCTION get_database_connections() TO authenticated;
GRANT EXECUTE ON FUNCTION get_connection_pool_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_long_running_queries() TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_queries(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_query_security(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_health_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION detect_suspicious_logins() TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_data_access_patterns() TO authenticated;

-- Restrict administrative functions to users with system monitoring permissions
GRANT EXECUTE ON FUNCTION auto_block_suspicious_query(VARCHAR, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION escalate_security_incident(UUID) TO authenticated;

-- Create indexes for better performance
-- Note: CONCURRENTLY removed for migration - can be added later in production
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type_created_at 
ON security_audit_log(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_data_access_audit_user_created_at 
ON data_access_audit(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_security_incidents_severity_status 
ON security_incidents(severity, status);

-- Comments for documentation
COMMENT ON FUNCTION get_database_connections() IS 'Retrieve current database connection information from pg_stat_activity';
COMMENT ON FUNCTION get_connection_pool_stats() IS 'Get comprehensive connection pool statistics and utilization metrics';
COMMENT ON FUNCTION get_long_running_queries() IS 'Identify queries running longer than 5 minutes';
COMMENT ON FUNCTION get_recent_queries(INTEGER) IS 'Get recent queries from pg_stat_statements within specified time window';
COMMENT ON FUNCTION analyze_query_security(TEXT, UUID) IS 'Enhanced security analysis of SQL queries with risk scoring';
COMMENT ON FUNCTION get_system_health_stats() IS 'Comprehensive database health and performance metrics';
COMMENT ON FUNCTION detect_suspicious_logins() IS 'Detect suspicious authentication patterns and behaviors';
COMMENT ON FUNCTION analyze_data_access_patterns() IS 'Analyze data access patterns for potential security threats';
COMMENT ON FUNCTION auto_block_suspicious_query(VARCHAR, INTEGER, UUID) IS 'Automatically determine if a query should be blocked based on risk score';
COMMENT ON FUNCTION escalate_security_incident(UUID) IS 'Escalate security incidents based on predefined rules and timeframes';