#!/bin/bash

# Enhanced Supabase Database Backup Script with Security Enhancements
# Implements encrypted backups, key management, integrity verification, and security monitoring

set -euo pipefail

# ============================================================================
# CONFIGURATION AND SECURITY SETTINGS
# ============================================================================

# Backup configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/supabase}"
ENCRYPTED_BACKUP_DIR="${ENCRYPTED_BACKUP_DIR:-/backups/supabase/encrypted}"
KEY_STORAGE_DIR="${KEY_STORAGE_DIR:-/secure/keys}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="dce_backup_${TIMESTAMP}"

# Security configuration
ENCRYPTION_ALGORITHM="AES-256-GCM"
KEY_DERIVATION_FUNCTION="PBKDF2"
KEY_ITERATIONS=100000
COMPRESSION_LEVEL=9
CHECKSUM_ALGORITHM="SHA256"

# Required environment variables
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${AWS_S3_BUCKET:?AWS_S3_BUCKET is required for backup storage}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE is required}"
: "${KEY_ENCRYPTION_KEY:?KEY_ENCRYPTION_KEY is required}"

# Optional security configurations
SECURITY_SCAN_ENABLED="${SECURITY_SCAN_ENABLED:-true}"
INTEGRITY_CHECK_ENABLED="${INTEGRITY_CHECK_ENABLED:-true}"
BACKUP_MONITORING_ENABLED="${BACKUP_MONITORING_ENABLED:-true}"
ZERO_KNOWLEDGE_ENCRYPTION="${ZERO_KNOWLEDGE_ENCRYPTION:-false}"

# Notification endpoints
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
PAGERDUTY_INTEGRATION_KEY="${PAGERDUTY_INTEGRATION_KEY:-}"
SECURITY_TEAM_EMAIL="${SECURITY_TEAM_EMAIL:-}"

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "${BACKUP_DIR}/security.log"
}

log_security_event() {
    local event_type="$1"
    local severity="$2"
    local message="$3"
    local additional_data="${4:-}"
    
    local log_entry=$(cat <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "event_type": "$event_type",
  "severity": "$severity",
  "message": "$message",
  "backup_name": "$BACKUP_NAME",
  "process_id": "$$",
  "additional_data": $additional_data
}
EOF
)
    
    echo "$log_entry" >> "${BACKUP_DIR}/security_events.jsonl"
    
    if [[ "$severity" == "high" || "$severity" == "critical" ]]; then
        notify_security_team "$message" "$severity"
    fi
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

notify_security_team() {
    local message="$1"
    local severity="${2:-medium}"
    
    # Slack notification
    local color="danger"
    [[ "$severity" == "medium" ]] && color="warning"
    [[ "$severity" == "low" ]] && color="good"
    
    notify_slack "🔒 SECURITY ALERT: $message" "$color"
    
    # PagerDuty alert for high/critical severities
    if [[ "$severity" == "high" || "$severity" == "critical" ]] && [[ -n "$PAGERDUTY_INTEGRATION_KEY" ]]; then
        curl -X POST https://events.pagerduty.com/v2/enqueue \
            -H 'Content-Type: application/json' \
            -d "{
                \"routing_key\": \"$PAGERDUTY_INTEGRATION_KEY\",
                \"event_action\": \"trigger\",
                \"payload\": {
                    \"summary\": \"Database backup security alert\",
                    \"severity\": \"$severity\",
                    \"source\": \"backup-security\",
                    \"custom_details\": {
                        \"message\": \"$message\",
                        \"backup_name\": \"$BACKUP_NAME\",
                        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                    }
                }
            }" 2>/dev/null || true
    fi
    
    # Email notification for security team
    if [[ -n "$SECURITY_TEAM_EMAIL" ]]; then
        echo "$message" | mail -s "Backup Security Alert - $severity" "$SECURITY_TEAM_EMAIL" 2>/dev/null || true
    fi
}

generate_secure_key() {
    local key_length="${1:-32}"
    openssl rand -base64 "$key_length" | tr -d "=+/" | cut -c1-"$key_length"
}

encrypt_file() {
    local input_file="$1"
    local output_file="$2"
    local encryption_key="$3"
    
    # Generate a random IV
    local iv=$(openssl rand -hex 16)
    
    # Encrypt the file with authenticated encryption
    openssl enc -aes-256-gcm -salt -in "$input_file" -out "$output_file" \
        -pass pass:"$encryption_key" -iv "$iv" -pbkdf2 -iter "$KEY_ITERATIONS"
    
    if [[ $? -eq 0 ]]; then
        log "File encrypted successfully: $output_file"
        return 0
    else
        log "ERROR: File encryption failed"
        return 1
    fi
}

decrypt_file() {
    local input_file="$1"
    local output_file="$2"
    local encryption_key="$3"
    
    openssl enc -aes-256-gcm -d -salt -in "$input_file" -out "$output_file" \
        -pass pass:"$encryption_key" -pbkdf2 -iter "$KEY_ITERATIONS"
    
    if [[ $? -eq 0 ]]; then
        log "File decrypted successfully: $output_file"
        return 0
    else
        log "ERROR: File decryption failed"
        return 1
    fi
}

calculate_checksum() {
    local file="$1"
    local algorithm="${2:-sha256}"
    
    case "$algorithm" in
        "sha256")
            sha256sum "$file" | cut -d' ' -f1
            ;;
        "sha512")
            sha512sum "$file" | cut -d' ' -f1
            ;;
        "md5")
            md5sum "$file" | cut -d' ' -f1
            ;;
        *)
            log "ERROR: Unsupported checksum algorithm: $algorithm"
            return 1
            ;;
    esac
}

verify_integrity() {
    local file="$1"
    local expected_checksum="$2"
    local algorithm="${3:-sha256}"
    
    local actual_checksum=$(calculate_checksum "$file" "$algorithm")
    
    if [[ "$actual_checksum" == "$expected_checksum" ]]; then
        log "Integrity verification passed for: $file"
        return 0
    else
        log "ERROR: Integrity verification failed for: $file"
        log "Expected: $expected_checksum"
        log "Actual: $actual_checksum"
        log_security_event "integrity_check_failed" "high" "Backup integrity verification failed" \
            "{\"file\": \"$file\", \"expected\": \"$expected_checksum\", \"actual\": \"$actual_checksum\"}"
        return 1
    fi
}

scan_for_sensitive_data() {
    local file="$1"
    
    if [[ "$SECURITY_SCAN_ENABLED" != "true" ]]; then
        return 0
    fi
    
    log "Scanning backup for sensitive data patterns..."
    
    # Define sensitive data patterns
    local patterns=(
        "PRIVATE KEY"
        "BEGIN RSA PRIVATE KEY"
        "BEGIN CERTIFICATE"
        "password\s*[:=]\s*['\"][^'\"]{8,}"
        "api[_-]?key\s*[:=]\s*['\"][^'\"]{16,}"
        "secret\s*[:=]\s*['\"][^'\"]{16,}"
        "token\s*[:=]\s*['\"][^'\"]{20,}"
        "\b[A-Za-z0-9]{64}\b"  # Potential hashes/keys
        "\b[0-9]{16}\b"        # Potential credit card numbers
        "\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b"  # SSN pattern
    )
    
    local found_patterns=()
    
    for pattern in "${patterns[@]}"; do
        if grep -q -P "$pattern" "$file" 2>/dev/null; then
            found_patterns+=("$pattern")
        fi
    done
    
    if [[ ${#found_patterns[@]} -gt 0 ]]; then
        log "WARNING: Sensitive data patterns detected in backup"
        log_security_event "sensitive_data_detected" "medium" "Sensitive data patterns found in backup" \
            "{\"patterns\": [$(printf '\"%s\",' "${found_patterns[@]}" | sed 's/,$//')]}"
        
        # Redact sensitive data if configured
        if [[ "${REDACT_SENSITIVE_DATA:-false}" == "true" ]]; then
            log "Redacting sensitive data from backup..."
            for pattern in "${found_patterns[@]}"; do
                sed -i "s/$pattern/[REDACTED]/g" "$file"
            done
        fi
    else
        log "Security scan completed - no sensitive data patterns detected"
    fi
}

manage_encryption_keys() {
    local action="$1"  # generate, rotate, or retrieve
    local key_name="$2"
    
    mkdir -p "$KEY_STORAGE_DIR"
    chmod 700 "$KEY_STORAGE_DIR"
    
    local key_file="$KEY_STORAGE_DIR/${key_name}.key"
    local key_metadata_file="$KEY_STORAGE_DIR/${key_name}.meta"
    
    case "$action" in
        "generate")
            if [[ -f "$key_file" ]]; then
                log "Encryption key already exists: $key_name"
                return 0
            fi
            
            log "Generating new encryption key: $key_name"
            local new_key=$(generate_secure_key 32)
            
            # Encrypt and store the key
            echo "$new_key" | openssl enc -aes-256-cbc -salt -out "$key_file" \
                -pass pass:"$KEY_ENCRYPTION_KEY" -pbkdf2 -iter "$KEY_ITERATIONS"
            
            # Store metadata
            cat > "$key_metadata_file" <<EOF
{
  "key_name": "$key_name",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "algorithm": "$ENCRYPTION_ALGORITHM",
  "key_derivation": "$KEY_DERIVATION_FUNCTION",
  "iterations": $KEY_ITERATIONS,
  "last_used": null,
  "rotation_due": "$(date -u -d '+90 days' +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
            
            chmod 600 "$key_file" "$key_metadata_file"
            log "Encryption key generated and stored securely"
            ;;
            
        "retrieve")
            if [[ ! -f "$key_file" ]]; then
                log "ERROR: Encryption key not found: $key_name"
                return 1
            fi
            
            # Decrypt and return the key
            openssl enc -aes-256-cbc -d -salt -in "$key_file" \
                -pass pass:"$KEY_ENCRYPTION_KEY" -pbkdf2 -iter "$KEY_ITERATIONS"
            
            # Update last used timestamp
            if [[ -f "$key_metadata_file" ]]; then
                local temp_file=$(mktemp)
                jq ".last_used = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$key_metadata_file" > "$temp_file"
                mv "$temp_file" "$key_metadata_file"
            fi
            ;;
            
        "rotate")
            log "Rotating encryption key: $key_name"
            
            # Backup old key
            if [[ -f "$key_file" ]]; then
                cp "$key_file" "${key_file}.old.$(date +%Y%m%d_%H%M%S)"
                cp "$key_metadata_file" "${key_metadata_file}.old.$(date +%Y%m%d_%H%M%S)"
            fi
            
            # Generate new key
            manage_encryption_keys "generate" "$key_name"
            
            log_security_event "key_rotation" "low" "Encryption key rotated successfully" \
                "{\"key_name\": \"$key_name\"}"
            ;;
            
        *)
            log "ERROR: Unknown key management action: $action"
            return 1
            ;;
    esac
}

monitor_backup_process() {
    local process_pid="$1"
    local process_name="$2"
    
    if [[ "$BACKUP_MONITORING_ENABLED" != "true" ]]; then
        return 0
    fi
    
    log "Starting backup process monitoring for PID: $process_pid"
    
    # Monitor resource usage
    while kill -0 "$process_pid" 2>/dev/null; do
        local cpu_usage=$(ps -p "$process_pid" -o %cpu --no-headers 2>/dev/null | tr -d ' ' || echo "0")
        local mem_usage=$(ps -p "$process_pid" -o %mem --no-headers 2>/dev/null | tr -d ' ' || echo "0")
        local runtime=$(($(date +%s) - $(stat -c %Y /proc/$process_pid 2>/dev/null || echo $(date +%s))))
        
        # Log resource usage every 30 seconds
        if [[ $((runtime % 30)) -eq 0 ]]; then
            log "Process $process_name (PID: $process_pid) - CPU: ${cpu_usage}%, Memory: ${mem_usage}%, Runtime: ${runtime}s"
        fi
        
        # Alert on high resource usage
        if (( $(echo "$cpu_usage > 90" | bc -l) )); then
            log_security_event "high_cpu_usage" "medium" "Backup process using high CPU" \
                "{\"process_name\": \"$process_name\", \"pid\": $process_pid, \"cpu_usage\": \"$cpu_usage\"}"
        fi
        
        if (( $(echo "$mem_usage > 80" | bc -l) )); then
            log_security_event "high_memory_usage" "medium" "Backup process using high memory" \
                "{\"process_name\": \"$process_name\", \"pid\": $process_pid, \"memory_usage\": \"$mem_usage\"}"
        fi
        
        # Alert on long runtime (>2 hours)
        if [[ $runtime -gt 7200 ]]; then
            log_security_event "long_backup_runtime" "medium" "Backup process running for extended time" \
                "{\"process_name\": \"$process_name\", \"pid\": $process_pid, \"runtime_seconds\": $runtime}"
        fi
        
        sleep 5
    done
    
    log "Backup process monitoring completed for PID: $process_pid"
}

# ============================================================================
# MAIN BACKUP PROCESS
# ============================================================================

main() {
    log "Starting enhanced secure database backup: $BACKUP_NAME"
    log_security_event "backup_started" "low" "Enhanced secure backup process initiated" "{}"
    
    # Create necessary directories
    mkdir -p "$BACKUP_DIR" "$ENCRYPTED_BACKUP_DIR" "$KEY_STORAGE_DIR"
    chmod 700 "$BACKUP_DIR" "$ENCRYPTED_BACKUP_DIR" "$KEY_STORAGE_DIR"
    
    # Generate or retrieve encryption key
    local encryption_key
    if ! manage_encryption_keys "generate" "backup_encryption_key"; then
        log "ERROR: Failed to generate encryption key"
        log_security_event "key_generation_failed" "critical" "Failed to generate encryption key" "{}"
        exit 1
    fi
    
    encryption_key=$(manage_encryption_keys "retrieve" "backup_encryption_key")
    if [[ -z "$encryption_key" ]]; then
        log "ERROR: Failed to retrieve encryption key"
        log_security_event "key_retrieval_failed" "critical" "Failed to retrieve encryption key" "{}"
        exit 1
    fi
    
    # Start backup process monitoring in background
    if [[ "$BACKUP_MONITORING_ENABLED" == "true" ]]; then
        monitor_backup_process $$ "backup_main" &
        local monitor_pid=$!
    fi
    
    # Perform database dump
    log "Creating database dump..."
    notify_slack "🔄 Starting secure database backup: $BACKUP_NAME" "warning"
    
    local dump_file="${BACKUP_DIR}/${BACKUP_NAME}.dump"
    local dump_start_time=$(date +%s)
    
    if pg_dump "$SUPABASE_DB_URL" \
        --format=custom \
        --verbose \
        --no-owner \
        --no-privileges \
        --exclude-table-data='storage.objects' \
        --exclude-table-data='auth.refresh_tokens' \
        --exclude-table-data='auth.sessions' \
        -f "$dump_file" 2>&1 | tee -a "${BACKUP_DIR}/backup.log"; then
        
        local dump_end_time=$(date +%s)
        local dump_duration=$((dump_end_time - dump_start_time))
        log "Database dump completed successfully in ${dump_duration} seconds"
        
        # Security scan of the dump
        scan_for_sensitive_data "$dump_file"
        
    else
        log "ERROR: Database dump failed"
        log_security_event "backup_failed" "critical" "Database dump process failed" "{}"
        notify_security_team "Database backup failed during dump phase" "critical"
        exit 1
    fi
    
    # Calculate original checksum
    log "Calculating integrity checksum..."
    local original_checksum=$(calculate_checksum "$dump_file" "$CHECKSUM_ALGORITHM")
    log "Original checksum ($CHECKSUM_ALGORITHM): $original_checksum"
    
    # Compress the dump
    log "Compressing backup..."
    local compressed_file="${dump_file}.gz"
    if gzip -"$COMPRESSION_LEVEL" "$dump_file"; then
        log "Backup compressed successfully"
        
        # Calculate compressed checksum
        local compressed_checksum=$(calculate_checksum "$compressed_file" "$CHECKSUM_ALGORITHM")
        log "Compressed checksum ($CHECKSUM_ALGORITHM): $compressed_checksum"
        
    else
        log "ERROR: Backup compression failed"
        log_security_event "compression_failed" "high" "Backup compression process failed" "{}"
        exit 1
    fi
    
    # Encrypt the compressed backup
    log "Encrypting backup with $ENCRYPTION_ALGORITHM..."
    local encrypted_file="${ENCRYPTED_BACKUP_DIR}/${BACKUP_NAME}.dump.gz.enc"
    
    if encrypt_file "$compressed_file" "$encrypted_file" "$encryption_key"; then
        log "Backup encrypted successfully"
        
        # Calculate encrypted checksum
        local encrypted_checksum=$(calculate_checksum "$encrypted_file" "$CHECKSUM_ALGORITHM")
        log "Encrypted checksum ($CHECKSUM_ALGORITHM): $encrypted_checksum"
        
        # Get encrypted file size
        local encrypted_size=$(du -h "$encrypted_file" | cut -f1)
        
    else
        log "ERROR: Backup encryption failed"
        log_security_event "encryption_failed" "critical" "Backup encryption process failed" "{}"
        notify_security_team "Backup encryption failed" "critical"
        exit 1
    fi
    
    # Create comprehensive backup metadata
    local metadata_file="${ENCRYPTED_BACKUP_DIR}/${BACKUP_NAME}.metadata.json"
    cat > "$metadata_file" <<EOF
{
    "backup_name": "$BACKUP_NAME",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "database_url": "REDACTED",
    "retention_days": $RETENTION_DAYS,
    "encryption": {
        "algorithm": "$ENCRYPTION_ALGORITHM",
        "key_derivation": "$KEY_DERIVATION_FUNCTION",
        "iterations": $KEY_ITERATIONS,
        "zero_knowledge": $ZERO_KNOWLEDGE_ENCRYPTION
    },
    "compression": {
        "algorithm": "gzip",
        "level": $COMPRESSION_LEVEL
    },
    "checksums": {
        "original": "$original_checksum",
        "compressed": "$compressed_checksum", 
        "encrypted": "$encrypted_checksum",
        "algorithm": "$CHECKSUM_ALGORITHM"
    },
    "file_info": {
        "encrypted_size": "$encrypted_size",
        "encrypted_file": "$(basename "$encrypted_file")"
    },
    "security": {
        "sensitive_data_scan": $SECURITY_SCAN_ENABLED,
        "integrity_verification": $INTEGRITY_CHECK_ENABLED,
        "process_monitoring": $BACKUP_MONITORING_ENABLED
    },
    "duration": {
        "dump_seconds": $dump_duration,
        "total_start": "$dump_start_time"
    }
}
EOF
    
    # Upload encrypted backup to S3
    log "Uploading encrypted backup to S3..."
    if aws s3 cp "$encrypted_file" \
        "s3://${AWS_S3_BUCKET}/secure-database-backups/$(basename "$encrypted_file")" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256; then
        
        log "Encrypted backup uploaded to S3 successfully"
        
        # Upload metadata
        aws s3 cp "$metadata_file" \
            "s3://${AWS_S3_BUCKET}/secure-database-backups/$(basename "$metadata_file")" \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256
        
    else
        log "ERROR: Failed to upload encrypted backup to S3"
        log_security_event "upload_failed" "high" "Failed to upload encrypted backup to S3" "{}"
        exit 1
    fi
    
    # Integrity verification of uploaded backup
    if [[ "$INTEGRITY_CHECK_ENABLED" == "true" ]]; then
        log "Verifying backup integrity after upload..."
        
        # Download and verify checksums
        local temp_download="/tmp/verify_$(basename "$encrypted_file")"
        aws s3 cp "s3://${AWS_S3_BUCKET}/secure-database-backups/$(basename "$encrypted_file")" "$temp_download"
        
        if verify_integrity "$temp_download" "$encrypted_checksum" "$CHECKSUM_ALGORITHM"; then
            log "Backup integrity verification passed"
            rm -f "$temp_download"
        else
            log "ERROR: Backup integrity verification failed"
            log_security_event "integrity_verification_failed" "critical" "Uploaded backup failed integrity check" "{}"
            notify_security_team "Backup integrity verification failed" "critical"
            exit 1
        fi
    fi
    
    # Clean up local files securely
    log "Securely cleaning up local files..."
    shred -vfz -n 3 "$compressed_file" 2>/dev/null || rm -f "$compressed_file"
    shred -vfz -n 3 "$encrypted_file" 2>/dev/null || rm -f "$encrypted_file"
    rm -f "$metadata_file"
    
    # Clean up old backups with enhanced security
    log "Cleaning up old backups (retention: ${RETENTION_DAYS} days)"
    aws s3 ls "s3://${AWS_S3_BUCKET}/secure-database-backups/" | \
        grep "\.enc$" | \
        while read -r line; do
            backup_date=$(echo "$line" | awk '{print $1}')
            backup_file=$(echo "$line" | awk '{print $4}')
            
            if [[ $(date -d "$backup_date" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$backup_date" +%s) -lt $(date -d "${RETENTION_DAYS} days ago" +%s) ]]; then
                log "Deleting old backup: $backup_file"
                aws s3 rm "s3://${AWS_S3_BUCKET}/secure-database-backups/$backup_file"
                aws s3 rm "s3://${AWS_S3_BUCKET}/secure-database-backups/${backup_file%.enc}.metadata.json" 2>/dev/null || true
                
                log_security_event "old_backup_deleted" "low" "Old backup deleted according to retention policy" \
                    "{\"file\": \"$backup_file\", \"retention_days\": $RETENTION_DAYS}"
            fi
        done
    
    # Stop backup monitoring
    if [[ "$BACKUP_MONITORING_ENABLED" == "true" && -n "${monitor_pid:-}" ]]; then
        kill "$monitor_pid" 2>/dev/null || true
    fi
    
    # Success notification
    local total_end_time=$(date +%s)
    local total_duration=$((total_end_time - dump_start_time))
    
    notify_slack "✅ Secure database backup completed successfully\n📦 Size: ${encrypted_size}\n🔒 Encrypted with $ENCRYPTION_ALGORITHM\n⏱️ Duration: ${total_duration}s\n📍 Location: s3://${AWS_S3_BUCKET}/secure-database-backups/$(basename "$encrypted_file")" "good"
    
    log "Enhanced secure backup process completed successfully in ${total_duration} seconds"
    log_security_event "backup_completed" "low" "Enhanced secure backup process completed successfully" \
        "{\"duration_seconds\": $total_duration, \"encrypted_size\": \"$encrypted_size\"}"
}

# ============================================================================
# ERROR HANDLING AND CLEANUP
# ============================================================================

cleanup() {
    local exit_code=$?
    
    if [[ $exit_code -ne 0 ]]; then
        log "ERROR: Backup process failed with exit code: $exit_code"
        log_security_event "backup_failed" "critical" "Backup process failed with exit code: $exit_code" \
            "{\"exit_code\": $exit_code}"
        notify_security_team "Backup process failed with exit code: $exit_code" "critical"
    fi
    
    # Clean up any temporary files
    find "${BACKUP_DIR:-/tmp}" -name "$(basename "$BACKUP_NAME").*" -type f -exec shred -vfz -n 3 {} \; 2>/dev/null || true
    find /tmp -name "verify_*" -type f -exec rm -f {} \; 2>/dev/null || true
    
    exit $exit_code
}

trap cleanup EXIT INT TERM

# ============================================================================
# SCRIPT EXECUTION
# ============================================================================

# Verify required tools
for tool in pg_dump aws openssl gzip jq bc shred; do
    if ! command -v "$tool" &> /dev/null; then
        log "ERROR: Required tool not found: $tool"
        exit 1
    fi
done

# Run the main backup process
main "$@"