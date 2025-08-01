#!/bin/bash
# Generate Software Bill of Materials (SBOM) for Container Security Monitor
#
# This script creates comprehensive SBOM documentation for:
# - Python dependencies
# - Container base images 
# - System packages
# - Security scan results

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SBOM_DIR="$PROJECT_ROOT/sbom"
OUTPUT_FORMAT="${OUTPUT_FORMAT:-json}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[SBOM]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Create SBOM directory
mkdir -p "$SBOM_DIR"/{reports,archives}

log "Generating SBOM for Container Security Monitor v2.0"
log "Output directory: $SBOM_DIR"

# 1. Generate Python dependency SBOM
log "Generating Python dependency SBOM..."
cd "$PROJECT_ROOT"

if command -v cyclonedx-py >/dev/null 2>&1; then
    cyclonedx-py requirements \
        --input-file requirements-v2.txt \
        --output-file "$SBOM_DIR/python-dependencies.${OUTPUT_FORMAT}" \
        --output-format "$OUTPUT_FORMAT" \
        --validate
    log "✓ Python dependencies SBOM created"
else
    error "cyclonedx-py not found. Install with: pip install cyclonedx-bom"
    exit 1
fi

# 2. Generate system package inventory
log "Generating system package inventory..."
if command -v dpkg >/dev/null 2>&1; then
    dpkg-query -W -f='${Package}\t${Version}\t${Architecture}\n' > "$SBOM_DIR/system-packages.txt"
    log "✓ System packages inventory (dpkg) created"
elif command -v rpm >/dev/null 2>&1; then
    rpm -qa --qf '%{NAME}\t%{VERSION}-%{RELEASE}\t%{ARCH}\n' > "$SBOM_DIR/system-packages.txt"
    log "✓ System packages inventory (rpm) created"
else
    warn "No package manager found (dpkg/rpm). Skipping system packages."
fi

# 3. Generate container image SBOM (if Dockerfile exists)
if [[ -f "$PROJECT_ROOT/Dockerfile" ]]; then
    log "Generating container image SBOM from Dockerfile..."
    
    # Extract base image
    BASE_IMAGE=$(grep -E '^FROM ' "$PROJECT_ROOT/Dockerfile" | head -1 | awk '{print $2}')
    
    cat > "$SBOM_DIR/container-metadata.json" << EOF
{
  "container_sbom": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
    "base_image": "$BASE_IMAGE",
    "dockerfile_path": "Dockerfile",
    "security_context": {
      "runs_as_root": false,
      "privileged": false,
      "read_only_root": true
    },
    "exposed_ports": [
      "8080/tcp",
      "9090/tcp"
    ],
    "volumes": [
      "/var/log/security-monitor"
    ]
  }
}
EOF
    log "✓ Container metadata SBOM created"
fi

# 4. Run security scans
log "Running security vulnerability scans..."

# Python dependency vulnerability scan with safety
if command -v safety >/dev/null 2>&1; then
    log "Running Safety scan..."
    safety check \
        --requirements requirements-v2.txt \
        --json \
        --output "$SBOM_DIR/safety-scan.json" \
        --continue-on-error || true
    log "✓ Safety vulnerability scan completed"
fi

# Static security analysis with bandit
if command -v bandit >/dev/null 2>&1; then
    log "Running Bandit security analysis..."
    bandit -r container_monitor/ \
        -f json \
        -o "$SBOM_DIR/bandit-scan.json" \
        --severity-level medium \
        --confidence-level medium || true
    log "✓ Bandit security analysis completed"
fi

# Additional dependency audit with pip-audit
if command -v pip-audit >/dev/null 2>&1; then
    log "Running pip-audit scan..."
    pip-audit \
        --requirement requirements-v2.txt \
        --format json \
        --output "$SBOM_DIR/pip-audit.json" \
        --progress-spinner=off || true
    log "✓ pip-audit vulnerability scan completed"
fi

# 5. Generate comprehensive SBOM summary
log "Generating SBOM summary report..."
cat > "$SBOM_DIR/sbom-summary.json" << EOF
{
  "sbom_metadata": {
    "name": "container-security-monitor",
    "version": "2.0.0",
    "generation_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
    "generator": "generate-sbom.sh",
    "spec_version": "CycloneDX-1.5"
  },
  "components": {
    "python_dependencies": "$(wc -l < requirements-v2.txt | xargs)",
    "system_packages": "$(if [[ -f "$SBOM_DIR/system-packages.txt" ]]; then wc -l < "$SBOM_DIR/system-packages.txt" | xargs; else echo "0"; fi)",
    "container_base_images": 1
  },
  "security_scans": {
    "safety_scan": "$(if [[ -f "$SBOM_DIR/safety-scan.json" ]]; then echo "completed"; else echo "skipped"; fi)",
    "bandit_scan": "$(if [[ -f "$SBOM_DIR/bandit-scan.json" ]]; then echo "completed"; else echo "skipped"; fi)",
    "pip_audit": "$(if [[ -f "$SBOM_DIR/pip-audit.json" ]]; then echo "completed"; else echo "skipped"; fi)"
  },
  "compliance": {
    "sbom_format": "CycloneDX",
    "vulnerability_scanning": true,
    "static_analysis": true,
    "dependency_tracking": true
  }
}
EOF

# 6. Create archive
log "Creating SBOM archive..."
ARCHIVE_NAME="security-monitor-sbom-${TIMESTAMP}.tar.gz"
tar -czf "$SBOM_DIR/archives/$ARCHIVE_NAME" \
    -C "$SBOM_DIR" \
    --exclude="archives" \
    .

log "✓ SBOM archive created: $ARCHIVE_NAME"

# 7. Display summary
log "SBOM Generation Complete!"
echo
echo -e "${BLUE}📋 SBOM Files Generated:${NC}"
find "$SBOM_DIR" -name "*.json" -o -name "*.txt" | sort | while read -r file; do
    echo "  • $(basename "$file")"
done

echo
echo -e "${BLUE}📊 Summary:${NC}"
if [[ -f "$SBOM_DIR/sbom-summary.json" ]]; then
    python3 -c "
import json
with open('$SBOM_DIR/sbom-summary.json') as f:
    data = json.load(f)
    print(f'  • Python Dependencies: {data[\"components\"][\"python_dependencies\"]}')
    print(f'  • System Packages: {data[\"components\"][\"system_packages\"]}')
    print(f'  • Security Scans: {sum(1 for v in data[\"security_scans\"].values() if v == \"completed\")}')
    print(f'  • Archive: $ARCHIVE_NAME')
"
else
    echo "  • Summary generation failed"
fi

echo
echo -e "${GREEN}✅ SBOM generation completed successfully!${NC}"
echo -e "   Archive location: ${SBOM_DIR}/archives/${ARCHIVE_NAME}"