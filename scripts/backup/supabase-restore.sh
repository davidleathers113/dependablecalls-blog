#!/bin/bash

# Supabase Database Restore Script
# This script restores a Supabase PostgreSQL database from backup

set -euo pipefail

# Configuration
RESTORE_DIR="${RESTORE_DIR:-/tmp/restore}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Required environment variables
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${AWS_S3_BUCKET:?AWS_S3_BUCKET is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

# Optional: Specific backup to restore (defaults to latest)
BACKUP_NAME="${1:-}"

# Functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error_exit() {
    echo "ERROR: $1" >&2
    exit 1
}

confirm_restore() {
    echo "⚠️  WARNING: This will restore the database from backup."
    echo "   This operation will:"
    echo "   - Stop all active connections"
    echo "   - Drop and recreate the database"
    echo "   - Restore all data from the backup"
    echo ""
    read -p "Are you ABSOLUTELY sure you want to continue? Type 'yes' to confirm: " confirmation
    
    if [[ "$confirmation" != "yes" ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
}

# Create restore directory
mkdir -p "$RESTORE_DIR"

# Confirm restore operation
if [[ -z "${FORCE_RESTORE:-}" ]]; then
    confirm_restore
fi

log "Starting database restore process"

# Find backup to restore
if [[ -z "$BACKUP_NAME" ]]; then
    log "Finding latest backup..."
    BACKUP_NAME=$(aws s3 ls "s3://${AWS_S3_BUCKET}/database-backups/" | \
        grep "dump.gz" | \
        sort -r | \
        head -1 | \
        awk '{print $4}' | \
        sed 's/.dump.gz$//')
    
    if [[ -z "$BACKUP_NAME" ]]; then
        error_exit "No backups found in S3"
    fi
    
    log "Latest backup found: $BACKUP_NAME"
fi

# Download backup
log "Downloading backup: ${BACKUP_NAME}.dump.gz"
if ! aws s3 cp "s3://${AWS_S3_BUCKET}/database-backups/${BACKUP_NAME}.dump.gz" \
    "${RESTORE_DIR}/${BACKUP_NAME}.dump.gz"; then
    error_exit "Failed to download backup from S3"
fi

# Download metadata
log "Downloading backup metadata"
if aws s3 cp "s3://${AWS_S3_BUCKET}/database-backups/${BACKUP_NAME}.metadata.json" \
    "${RESTORE_DIR}/${BACKUP_NAME}.metadata.json" 2>/dev/null; then
    
    # Verify checksum
    if command -v jq &> /dev/null; then
        EXPECTED_CHECKSUM=$(jq -r '.checksum' "${RESTORE_DIR}/${BACKUP_NAME}.metadata.json")
        ACTUAL_CHECKSUM=$(sha256sum "${RESTORE_DIR}/${BACKUP_NAME}.dump.gz" | cut -d' ' -f1)
        
        if [[ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]]; then
            error_exit "Checksum verification failed! Backup may be corrupted."
        fi
        
        log "Checksum verified successfully"
    fi
fi

# Decompress backup
log "Decompressing backup"
if ! gunzip "${RESTORE_DIR}/${BACKUP_NAME}.dump.gz"; then
    error_exit "Failed to decompress backup"
fi

# Create restore log
RESTORE_LOG="${RESTORE_DIR}/restore_${TIMESTAMP}.log"

# Parse database connection details
DB_HOST=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$SUPABASE_DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

# Terminate existing connections
log "Terminating existing database connections"
psql "$SUPABASE_DB_URL" -c "
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '$DB_NAME'
      AND pid <> pg_backend_pid();" || true

# Create pre-restore backup
log "Creating pre-restore safety backup"
PRE_RESTORE_BACKUP="pre_restore_${DB_NAME}_${TIMESTAMP}"
pg_dump "$SUPABASE_DB_URL" \
    --format=custom \
    --no-owner \
    --no-privileges \
    -f "${RESTORE_DIR}/${PRE_RESTORE_BACKUP}.dump" 2>&1 | tee -a "$RESTORE_LOG" || true

# Perform restore
log "Starting database restore"
if pg_restore \
    --verbose \
    --no-owner \
    --no-privileges \
    --no-acl \
    --clean \
    --if-exists \
    -d "$SUPABASE_DB_URL" \
    "${RESTORE_DIR}/${BACKUP_NAME}.dump" 2>&1 | tee -a "$RESTORE_LOG"; then
    
    log "Database restore completed successfully"
    
    # Run post-restore tasks
    log "Running post-restore tasks"
    
    # Update sequences
    psql "$SUPABASE_DB_URL" <<EOF
-- Reset all sequences to max value
DO \$\$
DECLARE
    seq RECORD;
    max_val BIGINT;
    sql_query TEXT;
BEGIN
    FOR seq IN 
        SELECT sequence_schema, sequence_name, 
               REPLACE(REPLACE(sequence_name, '_id_seq', ''), '_seq', '') as table_name
        FROM information_schema.sequences
        WHERE sequence_schema NOT IN ('pg_catalog', 'information_schema')
    LOOP
        sql_query := format('SELECT COALESCE(MAX(id), 0) FROM %I.%I', 
                           seq.sequence_schema, seq.table_name);
        BEGIN
            EXECUTE sql_query INTO max_val;
            EXECUTE format('SELECT setval(''%I.%I'', %s)', 
                          seq.sequence_schema, seq.sequence_name, max_val + 1);
        EXCEPTION WHEN OTHERS THEN
            -- Skip if table doesn't exist or has no id column
            NULL;
        END;
    END LOOP;
END\$\$;

-- Analyze tables for query optimization
ANALYZE;
EOF
    
    # Verify restore
    log "Verifying restore"
    TABLE_COUNT=$(psql "$SUPABASE_DB_URL" -t -c "
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema');")
    
    log "Restore verification: $TABLE_COUNT tables found"
    
    # Clean up
    log "Cleaning up temporary files"
    rm -f "${RESTORE_DIR}/${BACKUP_NAME}.dump"
    rm -f "${RESTORE_DIR}/${BACKUP_NAME}.metadata.json"
    
    # Compress pre-restore backup
    if [[ -f "${RESTORE_DIR}/${PRE_RESTORE_BACKUP}.dump" ]]; then
        gzip -9 "${RESTORE_DIR}/${PRE_RESTORE_BACKUP}.dump"
        log "Pre-restore backup saved: ${RESTORE_DIR}/${PRE_RESTORE_BACKUP}.dump.gz"
    fi
    
    log "Database restore completed successfully!"
    log "Restore log: $RESTORE_LOG"
    
    # Notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"✅ Database restore completed successfully\n📦 Backup: ${BACKUP_NAME}\n📊 Tables: ${TABLE_COUNT}\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
else
    error_exit "Database restore failed! Check log: $RESTORE_LOG"
fi