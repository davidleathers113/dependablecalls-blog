#!/bin/bash

# Supabase Database Backup Script
# This script creates automated backups of the Supabase PostgreSQL database

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/supabase}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="dce_backup_${TIMESTAMP}"

# Required environment variables
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${AWS_S3_BUCKET:?AWS_S3_BUCKET is required for backup storage}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

# Optional notifications
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
PAGERDUTY_INTEGRATION_KEY="${PAGERDUTY_INTEGRATION_KEY:-}"

# Functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

notify_slack() {
    local message="$1"
    local color="${2:-good}"
    
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
}

notify_error() {
    local error_message="$1"
    
    # Slack notification
    notify_slack "⚠️ Database backup failed: $error_message" "danger"
    
    # PagerDuty alert
    if [[ -n "$PAGERDUTY_INTEGRATION_KEY" ]]; then
        curl -X POST https://events.pagerduty.com/v2/enqueue \
            -H 'Content-Type: application/json' \
            -d "{
                \"routing_key\": \"$PAGERDUTY_INTEGRATION_KEY\",
                \"event_action\": \"trigger\",
                \"payload\": {
                    \"summary\": \"Database backup failed\",
                    \"severity\": \"error\",
                    \"source\": \"supabase-backup\",
                    \"custom_details\": {
                        \"error\": \"$error_message\",
                        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                    }
                }
            }" 2>/dev/null || true
    fi
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Start backup process
log "Starting database backup: $BACKUP_NAME"
notify_slack "🔄 Starting database backup: $BACKUP_NAME" "warning"

# Perform database dump
if pg_dump "$SUPABASE_DB_URL" \
    --format=custom \
    --verbose \
    --no-owner \
    --no-privileges \
    --exclude-table-data='storage.objects' \
    --exclude-table-data='auth.refresh_tokens' \
    --exclude-table-data='auth.sessions' \
    -f "${BACKUP_DIR}/${BACKUP_NAME}.dump" 2>&1 | tee -a "${BACKUP_DIR}/backup.log"; then
    
    log "Database dump completed successfully"
    
    # Compress backup
    if gzip -9 "${BACKUP_DIR}/${BACKUP_NAME}.dump"; then
        log "Backup compressed successfully"
        
        # Calculate backup size
        BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.dump.gz" | cut -f1)
        
        # Upload to S3
        if aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.dump.gz" \
            "s3://${AWS_S3_BUCKET}/database-backups/${BACKUP_NAME}.dump.gz" \
            --storage-class STANDARD_IA; then
            
            log "Backup uploaded to S3 successfully"
            
            # Create backup metadata
            cat > "${BACKUP_DIR}/${BACKUP_NAME}.metadata.json" <<EOF
{
    "backup_name": "${BACKUP_NAME}",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "size": "${BACKUP_SIZE}",
    "database_url": "REDACTED",
    "retention_days": ${RETENTION_DAYS},
    "checksum": "$(sha256sum "${BACKUP_DIR}/${BACKUP_NAME}.dump.gz" | cut -d' ' -f1)"
}
EOF
            
            # Upload metadata
            aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.metadata.json" \
                "s3://${AWS_S3_BUCKET}/database-backups/${BACKUP_NAME}.metadata.json"
            
            # Clean up local files
            rm -f "${BACKUP_DIR}/${BACKUP_NAME}.dump.gz"
            rm -f "${BACKUP_DIR}/${BACKUP_NAME}.metadata.json"
            
            # Success notification
            notify_slack "✅ Database backup completed successfully\n📦 Size: ${BACKUP_SIZE}\n📍 Location: s3://${AWS_S3_BUCKET}/database-backups/${BACKUP_NAME}.dump.gz" "good"
            
            # Clean up old backups
            log "Cleaning up old backups (retention: ${RETENTION_DAYS} days)"
            aws s3 ls "s3://${AWS_S3_BUCKET}/database-backups/" | \
                grep "dump.gz" | \
                while read -r line; do
                    backup_date=$(echo "$line" | awk '{print $1}')
                    backup_file=$(echo "$line" | awk '{print $4}')
                    
                    if [[ $(date -d "$backup_date" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$backup_date" +%s) -lt $(date -d "${RETENTION_DAYS} days ago" +%s) ]]; then
                        log "Deleting old backup: $backup_file"
                        aws s3 rm "s3://${AWS_S3_BUCKET}/database-backups/$backup_file"
                        aws s3 rm "s3://${AWS_S3_BUCKET}/database-backups/${backup_file%.dump.gz}.metadata.json" 2>/dev/null || true
                    fi
                done
            
            log "Backup process completed successfully"
            exit 0
        else
            notify_error "Failed to upload backup to S3"
            exit 1
        fi
    else
        notify_error "Failed to compress backup"
        exit 1
    fi
else
    notify_error "Failed to create database dump"
    exit 1
fi