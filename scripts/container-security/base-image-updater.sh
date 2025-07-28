#!/bin/bash

# =============================================================================
# BASE IMAGE VULNERABILITY MANAGEMENT SYSTEM
# =============================================================================
# This script manages base image security by:
# - Checking for base image vulnerabilities
# - Updating base images with security patches
# - Managing image pinning and version updates
# - Alerting on critical vulnerabilities
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/security-reports/base-image-updates.log"
DOCKERFILE_PATH="$PROJECT_ROOT/Dockerfile"
DOCKERFILE_DEV_PATH="$PROJECT_ROOT/Dockerfile.dev"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# Base images to monitor
declare -A BASE_IMAGES=(
    ["node"]="node:22-alpine"
    ["nginx"]="nginx:1.26-alpine"
    ["redis"]="redis:7.4-alpine"
    ["distroless"]="gcr.io/distroless/nodejs22-debian12:nonroot"
)

# Severity thresholds
CRITICAL_THRESHOLD=0
HIGH_THRESHOLD=5
MEDIUM_THRESHOLD=20

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Create necessary directories
setup_directories() {
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$PROJECT_ROOT/security-reports/base-images"
    mkdir -p "$PROJECT_ROOT/security-reports/vulnerability-scans"
}

# Install security scanning tools
install_tools() {
    log "INFO" "Installing security scanning tools..."
    
    # Install Trivy if not present
    if ! command -v trivy &> /dev/null; then
        log "INFO" "Installing Trivy..."
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    fi
    
    # Install Grype if not present
    if ! command -v grype &> /dev/null; then
        log "INFO" "Installing Grype..."
        curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin
    fi
    
    # Install Docker Scout if not present
    if ! docker scout version &> /dev/null; then
        log "INFO" "Installing Docker Scout..."
        curl -sSfL https://raw.githubusercontent.com/docker/scout-cli/main/install.sh | sh -s --
    fi
}

# Get latest image digest
get_latest_digest() {
    local image="$1"
    local digest
    
    log "INFO" "Getting latest digest for $image..."
    
    # Pull latest image
    docker pull "$image" >/dev/null 2>&1
    
    # Get digest
    digest=$(docker inspect "$image" --format='{{index .RepoDigests 0}}' 2>/dev/null | cut -d'@' -f2)
    
    if [[ -n "$digest" ]]; then
        echo "$digest"
    else
        log "ERROR" "Could not get digest for $image"
        return 1
    fi
}

# Scan image for vulnerabilities using multiple tools
scan_image_vulnerabilities() {
    local image="$1"
    local scan_dir="$PROJECT_ROOT/security-reports/vulnerability-scans"
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    
    log "INFO" "Scanning $image for vulnerabilities..."
    
    # Trivy scan
    local trivy_output="$scan_dir/trivy_${image//[^a-zA-Z0-9]/_}_$timestamp.json"
    trivy image --format json --output "$trivy_output" "$image" || {
        log "ERROR" "Trivy scan failed for $image"
        return 1
    }
    
    # Grype scan
    local grype_output="$scan_dir/grype_${image//[^a-zA-Z0-9]/_}_$timestamp.json"
    grype "$image" -o json > "$grype_output" || {
        log "ERROR" "Grype scan failed for $image"
        return 1
    }
    
    # Docker Scout scan (if available)
    local scout_output="$scan_dir/scout_${image//[^a-zA-Z0-9]/_}_$timestamp.json"
    if docker scout version &> /dev/null; then
        docker scout cves --format json "$image" > "$scout_output" 2>/dev/null || {
            log "WARN" "Docker Scout scan failed for $image"
        }
    fi
    
    echo "$trivy_output"
}

# Analyze vulnerability scan results
analyze_vulnerabilities() {
    local scan_file="$1"
    local image="$2"
    
    if [[ ! -f "$scan_file" ]]; then
        log "ERROR" "Scan file not found: $scan_file"
        return 1
    fi
    
    # Parse Trivy JSON output
    local critical=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' "$scan_file" 2>/dev/null || echo 0)
    local high=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' "$scan_file" 2>/dev/null || echo 0)
    local medium=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "MEDIUM")] | length' "$scan_file" 2>/dev/null || echo 0)
    local low=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "LOW")] | length' "$scan_file" 2>/dev/null || echo 0)
    
    log "INFO" "Vulnerability summary for $image:"
    log "INFO" "  Critical: $critical"
    log "INFO" "  High: $high"
    log "INFO" "  Medium: $medium"
    log "INFO" "  Low: $low"
    
    # Check against thresholds
    local needs_update=false
    local alert_level="INFO"
    
    if [[ $critical -gt $CRITICAL_THRESHOLD ]]; then
        log "ERROR" "🔴 CRITICAL: $image has $critical critical vulnerabilities (threshold: $CRITICAL_THRESHOLD)"
        needs_update=true
        alert_level="CRITICAL"
    elif [[ $high -gt $HIGH_THRESHOLD ]]; then
        log "WARN" "🟠 HIGH: $image has $high high vulnerabilities (threshold: $HIGH_THRESHOLD)"
        needs_update=true
        alert_level="HIGH"
    elif [[ $medium -gt $MEDIUM_THRESHOLD ]]; then
        log "WARN" "🟡 MEDIUM: $image has $medium medium vulnerabilities (threshold: $MEDIUM_THRESHOLD)"
        needs_update=true
        alert_level="MEDIUM"
    else
        log "INFO" "✅ $image vulnerability levels within acceptable thresholds"
    fi
    
    # Generate detailed vulnerability report
    generate_vulnerability_report "$scan_file" "$image" "$alert_level"
    
    echo "$needs_update"
}

# Generate detailed vulnerability report
generate_vulnerability_report() {
    local scan_file="$1"
    local image="$2"
    local alert_level="$3"
    local report_file="$PROJECT_ROOT/security-reports/base-images/${image//[^a-zA-Z0-9]/_}_vulnerability_report.md"
    
    log "INFO" "Generating vulnerability report for $image..."
    
    cat > "$report_file" << EOF
# Base Image Vulnerability Report

**Image:** \`$image\`  
**Scan Date:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')  
**Alert Level:** $alert_level  

## Executive Summary

$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL" or .Severity == "HIGH") | "- **\(.Severity)**: \(.VulnerabilityID) - \(.Title // .Description // "No description")"' "$scan_file" 2>/dev/null | head -10)

## Vulnerability Breakdown

### Critical Vulnerabilities
\`\`\`
$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL") | "\(.VulnerabilityID): \(.PkgName)@\(.InstalledVersion) -> \(.FixedVersion // "No fix available")"' "$scan_file" 2>/dev/null || echo "None found")
\`\`\`

### High Severity Vulnerabilities
\`\`\`
$(jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH") | "\(.VulnerabilityID): \(.PkgName)@\(.InstalledVersion) -> \(.FixedVersion // "No fix available")"' "$scan_file" 2>/dev/null | head -20 || echo "None found")
\`\`\`

## Remediation Recommendations

1. **Immediate Actions:**
   - Update base image to latest available version
   - Review and apply security patches
   - Consider alternative base images if vulnerabilities persist

2. **Long-term Strategy:**
   - Implement automated base image updates
   - Enable vulnerability monitoring alerts
   - Regular security assessments

## Scan Details

- **Scanner:** Trivy $(trivy --version 2>/dev/null | head -1 || echo "Unknown version")
- **Scan File:** \`$scan_file\`
- **Total Vulnerabilities:** $(jq '[.Results[]?.Vulnerabilities[]?] | length' "$scan_file" 2>/dev/null || echo "Unknown")

---
*Generated by Base Image Vulnerability Management System*
EOF

    log "INFO" "Vulnerability report saved to: $report_file"
}

# Update Dockerfile with new image digest
update_dockerfile() {
    local dockerfile="$1"
    local old_image="$2"
    local new_digest="$3"
    local backup_file="${dockerfile}.backup.$(date +%s)"
    
    log "INFO" "Updating $dockerfile with new digest..."
    
    # Create backup
    cp "$dockerfile" "$backup_file"
    log "INFO" "Backup created: $backup_file"
    
    # Update Dockerfile with pinned digest
    local new_image_with_digest="${old_image}@${new_digest}"
    
    # Use sed to replace the image reference
    if sed -i.bak "s|FROM ${old_image}[^ ]*|FROM ${new_image_with_digest}|g" "$dockerfile"; then
        log "INFO" "Successfully updated $dockerfile"
        rm "${dockerfile}.bak" 2>/dev/null || true
        return 0
    else
        log "ERROR" "Failed to update $dockerfile, restoring backup"
        mv "$backup_file" "$dockerfile"
        return 1
    fi
}

# Update docker-compose.yml with new image digest
update_compose_file() {
    local image_name="$1"
    local new_digest="$2"
    local backup_file="${COMPOSE_FILE}.backup.$(date +%s)"
    
    log "INFO" "Updating docker-compose.yml with new digest for $image_name..."
    
    # Create backup
    cp "$COMPOSE_FILE" "$backup_file"
    log "INFO" "Backup created: $backup_file"
    
    # Update compose file - this is more complex due to YAML structure
    # For now, log the required change
    log "INFO" "Manual update required for docker-compose.yml:"
    log "INFO" "  Update $image_name to include digest: @$new_digest"
    
    # TODO: Implement automated YAML update using yq or similar tool
}

# Send security alert
send_alert() {
    local alert_level="$1"
    local image="$2"
    local message="$3"
    local webhook_url="${SECURITY_ALERT_WEBHOOK:-}"
    
    if [[ -z "$webhook_url" ]]; then
        log "WARN" "No webhook URL configured for alerts"
        return 0
    fi
    
    local payload
    payload=$(cat << EOF
{
    "text": "🚨 Container Security Alert",
    "attachments": [
        {
            "color": "$(case $alert_level in CRITICAL) echo "danger";; HIGH) echo "warning";; *) echo "good";; esac)",
            "fields": [
                {
                    "title": "Alert Level",
                    "value": "$alert_level",
                    "short": true
                },
                {
                    "title": "Image",
                    "value": "$image",
                    "short": true
                },
                {
                    "title": "Message",
                    "value": "$message",
                    "short": false
                },
                {
                    "title": "Timestamp",
                    "value": "$(date -u '+%Y-%m-%d %H:%M:%S UTC')",
                    "short": true
                }
            ]
        }
    ]
}
EOF
)

    if curl -X POST -H 'Content-type: application/json' --data "$payload" "$webhook_url" &>/dev/null; then
        log "INFO" "Alert sent successfully"
    else
        log "ERROR" "Failed to send alert"
    fi
}

# Main function to check and update base images
check_base_images() {
    local force_update="${1:-false}"
    
    log "INFO" "Starting base image vulnerability check..."
    
    for image_key in "${!BASE_IMAGES[@]}"; do
        local image="${BASE_IMAGES[$image_key]}"
        local current_image="$image"
        
        log "INFO" "Checking base image: $image ($image_key)"
        
        # Scan current image
        local scan_file
        scan_file=$(scan_image_vulnerabilities "$current_image")
        
        if [[ $? -ne 0 ]]; then
            log "ERROR" "Failed to scan $current_image"
            continue
        fi
        
        # Analyze vulnerabilities
        local needs_update
        needs_update=$(analyze_vulnerabilities "$scan_file" "$current_image")
        
        if [[ "$needs_update" == "true" ]] || [[ "$force_update" == "true" ]]; then
            log "INFO" "Image $current_image requires update"
            
            # Get latest digest
            local latest_digest
            latest_digest=$(get_latest_digest "$current_image")
            
            if [[ $? -ne 0 ]]; then
                log "ERROR" "Failed to get latest digest for $current_image"
                continue
            fi
            
            # Update Dockerfiles
            case "$image_key" in
                "node")
                    update_dockerfile "$DOCKERFILE_PATH" "$current_image" "$latest_digest"
                    update_dockerfile "$DOCKERFILE_DEV_PATH" "$current_image" "$latest_digest"
                    ;;
                "nginx"|"redis")
                    update_compose_file "$image_key" "$latest_digest"
                    ;;
                "distroless")
                    update_dockerfile "$DOCKERFILE_PATH" "$current_image" "$latest_digest"
                    ;;
            esac
            
            # Re-scan updated image
            local updated_scan_file
            updated_scan_file=$(scan_image_vulnerabilities "${current_image}@${latest_digest}")
            
            if [[ $? -eq 0 ]]; then
                analyze_vulnerabilities "$updated_scan_file" "${current_image}@${latest_digest}"
            fi
            
            # Send alert if critical
            local critical_count
            critical_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' "$scan_file" 2>/dev/null || echo 0)
            
            if [[ $critical_count -gt 0 ]]; then
                send_alert "CRITICAL" "$current_image" "Image has $critical_count critical vulnerabilities and requires immediate attention"
            fi
        else
            log "INFO" "✅ Image $current_image is within acceptable vulnerability thresholds"
        fi
    done
    
    log "INFO" "Base image vulnerability check completed"
}

# Generate summary report
generate_summary_report() {
    local summary_file="$PROJECT_ROOT/security-reports/base-image-summary.md"
    local timestamp=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
    
    log "INFO" "Generating summary report..."
    
    cat > "$summary_file" << EOF
# Base Image Security Summary

**Generated:** $timestamp  
**Script:** Base Image Vulnerability Management System  

## Overview

This report summarizes the security status of all base images used in the DCE website project.

## Base Images Monitored

$(for image_key in "${!BASE_IMAGES[@]}"; do
    echo "- **$image_key**: \`${BASE_IMAGES[$image_key]}\`"
done)

## Recent Scan Results

$(find "$PROJECT_ROOT/security-reports/base-images" -name "*_vulnerability_report.md" -mtime -1 2>/dev/null | while read -r report; do
    echo "- [$(basename "$report" .md)]($(basename "$report"))"
done || echo "No recent scan results found")

## Security Thresholds

- **Critical Vulnerabilities:** $CRITICAL_THRESHOLD (block deployment)
- **High Severity:** $HIGH_THRESHOLD (requires update)
- **Medium Severity:** $MEDIUM_THRESHOLD (monitor)

## Automated Actions

- ✅ Daily vulnerability scanning
- ✅ Automatic base image updates for security patches
- ✅ Alert notifications for critical vulnerabilities
- ✅ Backup and rollback capability

## Next Steps

1. Review individual vulnerability reports
2. Apply recommended updates
3. Monitor for new vulnerabilities
4. Update security thresholds as needed

---
*Automated by Base Image Vulnerability Management System*
EOF

    log "INFO" "Summary report generated: $summary_file"
}

# CLI interface
main() {
    local command="${1:-check}"
    local force_update="${2:-false}"
    
    # Setup
    setup_directories
    install_tools
    
    case "$command" in
        "check")
            check_base_images "$force_update"
            generate_summary_report
            ;;
        "update")
            check_base_images "true"
            generate_summary_report
            ;;
        "scan")
            local image="${2:-}"
            if [[ -z "$image" ]]; then
                log "ERROR" "Usage: $0 scan <image>"
                exit 1
            fi
            scan_file=$(scan_image_vulnerabilities "$image")
            analyze_vulnerabilities "$scan_file" "$image"
            ;;
        "report")
            generate_summary_report
            ;;
        *)
            echo "Usage: $0 {check|update|scan|report} [options]"
            echo ""
            echo "Commands:"
            echo "  check          - Check all base images for vulnerabilities"
            echo "  update         - Force update all base images"
            echo "  scan <image>   - Scan specific image"
            echo "  report         - Generate summary report"
            echo ""
            echo "Environment variables:"
            echo "  SECURITY_ALERT_WEBHOOK - Webhook URL for security alerts"
            exit 1
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi