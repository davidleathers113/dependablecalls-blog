#!/bin/bash

# Deployment Rollback Script
# Enables quick rollback to previous version in case of issues

set -euo pipefail

# Configuration
DEPLOYMENT_HISTORY_FILE="${DEPLOYMENT_HISTORY_FILE:-/var/log/deployments.json}"
MAX_ROLLBACK_VERSIONS="${MAX_ROLLBACK_VERSIONS:-5}"

# Required environment variables
: "${NETLIFY_AUTH_TOKEN:?NETLIFY_AUTH_TOKEN is required}"
: "${NETLIFY_SITE_ID:?NETLIFY_SITE_ID is required}"
: "${ENVIRONMENT:?ENVIRONMENT is required (production/staging)}"

# Optional
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
ROLLBACK_TO_VERSION="${1:-}"

# Functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error_exit() {
    echo "ERROR: $1" >&2
    notify_slack "❌ Rollback failed: $1" "danger"
    exit 1
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

get_current_deployment() {
    curl -s -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
        "https://api.netlify.com/api/v1/sites/$NETLIFY_SITE_ID" | \
        jq -r '.published_deploy.id'
}

get_deployment_list() {
    curl -s -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
        "https://api.netlify.com/api/v1/sites/$NETLIFY_SITE_ID/deploys?per_page=$MAX_ROLLBACK_VERSIONS" | \
        jq -r '.[] | select(.state == "ready") | {id: .id, created_at: .created_at, branch: .branch, commit_ref: .commit_ref, title: .title}'
}

perform_rollback() {
    local deploy_id="$1"
    
    log "Initiating rollback to deployment: $deploy_id"
    
    # Restore deployment
    local response=$(curl -s -X POST \
        -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        "https://api.netlify.com/api/v1/sites/$NETLIFY_SITE_ID/deploys/$deploy_id/restore")
    
    local state=$(echo "$response" | jq -r '.state')
    
    if [[ "$state" == "ready" ]]; then
        log "Rollback completed successfully"
        return 0
    else
        error_exit "Rollback failed with state: $state"
    fi
}

create_rollback_record() {
    local from_deploy="$1"
    local to_deploy="$2"
    local reason="${3:-Manual rollback}"
    
    local record=$(jq -n \
        --arg from "$from_deploy" \
        --arg to "$to_deploy" \
        --arg reason "$reason" \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg user "${USER:-unknown}" \
        --arg environment "$ENVIRONMENT" \
        '{
            from_deployment: $from,
            to_deployment: $to,
            reason: $reason,
            timestamp: $timestamp,
            initiated_by: $user,
            environment: $environment
        }')
    
    # Append to deployment history
    if [[ -f "$DEPLOYMENT_HISTORY_FILE" ]]; then
        jq ". += [$record]" "$DEPLOYMENT_HISTORY_FILE" > "${DEPLOYMENT_HISTORY_FILE}.tmp" && \
        mv "${DEPLOYMENT_HISTORY_FILE}.tmp" "$DEPLOYMENT_HISTORY_FILE"
    else
        echo "[$record]" > "$DEPLOYMENT_HISTORY_FILE"
    fi
}

# Main rollback process
log "Starting rollback process for $ENVIRONMENT environment"
notify_slack "🔄 Initiating rollback for $ENVIRONMENT environment" "warning"

# Get current deployment
CURRENT_DEPLOY=$(get_current_deployment)
log "Current deployment: $CURRENT_DEPLOY"

# If specific version not provided, show available options
if [[ -z "$ROLLBACK_TO_VERSION" ]]; then
    log "Available deployments for rollback:"
    echo ""
    
    get_deployment_list | jq -r '. | "\(.id) - \(.created_at) - Branch: \(.branch) - \(.title // "No title")"'
    
    echo ""
    read -p "Enter deployment ID to rollback to: " ROLLBACK_TO_VERSION
    
    if [[ -z "$ROLLBACK_TO_VERSION" ]]; then
        error_exit "No deployment ID provided"
    fi
fi

# Validate deployment exists
if ! get_deployment_list | jq -e ".id == \"$ROLLBACK_TO_VERSION\"" > /dev/null; then
    error_exit "Deployment $ROLLBACK_TO_VERSION not found or not available for rollback"
fi

# Confirm rollback
echo ""
echo "⚠️  WARNING: This will rollback the $ENVIRONMENT environment"
echo "   From: $CURRENT_DEPLOY"
echo "   To:   $ROLLBACK_TO_VERSION"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirmation

if [[ "$confirmation" != "yes" ]]; then
    log "Rollback cancelled by user"
    exit 0
fi

# Read rollback reason
read -p "Reason for rollback (press Enter for default): " ROLLBACK_REASON
ROLLBACK_REASON="${ROLLBACK_REASON:-Manual rollback}"

# Create pre-rollback snapshot
log "Creating pre-rollback health check"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "https://${NETLIFY_SITE_ID}.netlify.app/health" || echo "000")
log "Current health status: $HEALTH_CHECK"

# Perform rollback
if perform_rollback "$ROLLBACK_TO_VERSION"; then
    # Wait for deployment to be ready
    log "Waiting for deployment to be ready..."
    sleep 10
    
    # Verify rollback
    NEW_DEPLOY=$(get_current_deployment)
    
    if [[ "$NEW_DEPLOY" == "$ROLLBACK_TO_VERSION" ]]; then
        log "Rollback verified successfully"
        
        # Record rollback
        create_rollback_record "$CURRENT_DEPLOY" "$ROLLBACK_TO_VERSION" "$ROLLBACK_REASON"
        
        # Post-rollback health check
        sleep 5
        POST_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "https://${NETLIFY_SITE_ID}.netlify.app/health" || echo "000")
        log "Post-rollback health status: $POST_HEALTH"
        
        if [[ "$POST_HEALTH" == "200" ]]; then
            notify_slack "✅ Rollback completed successfully\n📦 From: $CURRENT_DEPLOY\n📦 To: $ROLLBACK_TO_VERSION\n💬 Reason: $ROLLBACK_REASON\n❤️ Health: OK" "good"
        else
            notify_slack "⚠️ Rollback completed but health check failed\n📦 From: $CURRENT_DEPLOY\n📦 To: $ROLLBACK_TO_VERSION\n❌ Health: $POST_HEALTH" "warning"
        fi
        
        log "Rollback completed successfully!"
    else
        error_exit "Rollback verification failed. Expected $ROLLBACK_TO_VERSION but got $NEW_DEPLOY"
    fi
else
    error_exit "Rollback operation failed"
fi

# Generate rollback report
cat > "/tmp/rollback_report_$(date +%Y%m%d_%H%M%S).txt" <<EOF
Rollback Report
===============
Environment: $ENVIRONMENT
Timestamp: $(date)
Initiated by: ${USER:-unknown}

From Deployment: $CURRENT_DEPLOY
To Deployment: $ROLLBACK_TO_VERSION
Reason: $ROLLBACK_REASON

Pre-rollback Health: $HEALTH_CHECK
Post-rollback Health: $POST_HEALTH

Status: SUCCESS
EOF

log "Rollback report generated: /tmp/rollback_report_$(date +%Y%m%d_%H%M%S).txt"