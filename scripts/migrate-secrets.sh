#!/bin/bash

# DCE Platform - Secret Migration Script
# Migrates secrets from .env files to Netlify environment variables
# Phase 4.9: Secret Management Implementation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE=".env.example"
NETLIFY_SITE_NAME="dce-platform"
BACKUP_DIR="./secret-backups/$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}🔐 DCE Platform Secret Migration Script${NC}"
echo -e "${BLUE}======================================${NC}\n"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check if running from project root
if [ ! -f "package.json" ] || [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Please run this script from the DCE project root directory${NC}"
    exit 1
fi

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo -e "${RED}❌ Netlify CLI is not installed${NC}"
    echo -e "${YELLOW}Install with: npm install -g netlify-cli${NC}"
    exit 1
fi

# Check if logged in to Netlify
if ! netlify status &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Netlify${NC}"
    echo -e "${YELLOW}Login with: netlify login${NC}"
    exit 1
fi

# Check if connected to correct site
CURRENT_SITE=$(netlify status 2>/dev/null | grep "Site name" | awk '{print $3}' || echo "")
if [ "$CURRENT_SITE" != "$NETLIFY_SITE_NAME" ]; then
    echo -e "${YELLOW}⚠️  Current site: $CURRENT_SITE${NC}"
    echo -e "${YELLOW}⚠️  Expected site: $NETLIFY_SITE_NAME${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}\n"

# Create backup directory
echo -e "${YELLOW}📦 Creating backup directory...${NC}"
mkdir -p "$BACKUP_DIR"

# Backup current environment variables
echo -e "${YELLOW}💾 Backing up current Netlify environment variables...${NC}"
netlify env:list --json > "$BACKUP_DIR/netlify-env-backup.json"
echo -e "${GREEN}✅ Backup saved to $BACKUP_DIR/netlify-env-backup.json${NC}\n"

# Parse .env file and extract secrets
echo -e "${YELLOW}🔍 Parsing $ENV_FILE for secrets...${NC}"

# DCE Platform secrets with their contexts and sensitivity levels
declare -A SECRET_CONTEXTS
declare -A SECRET_DESCRIPTIONS

# Database secrets (High sensitivity - Production and Deploy Preview only)
SECRET_CONTEXTS["VITE_SUPABASE_URL"]="production,deploy-preview"
SECRET_DESCRIPTIONS["VITE_SUPABASE_URL"]="Supabase project URL"

SECRET_CONTEXTS["VITE_SUPABASE_ANON_KEY"]="production,deploy-preview"
SECRET_DESCRIPTIONS["VITE_SUPABASE_ANON_KEY"]="Supabase anonymous key"

SECRET_CONTEXTS["SUPABASE_SERVICE_ROLE_KEY"]="production"
SECRET_DESCRIPTIONS["SUPABASE_SERVICE_ROLE_KEY"]="Supabase service role key (CRITICAL)"

# Authentication secrets (Critical - Production only)
SECRET_CONTEXTS["JWT_SECRET"]="production"
SECRET_DESCRIPTIONS["JWT_SECRET"]="JWT signing secret (CRITICAL)"

SECRET_CONTEXTS["CSRF_SECRET"]="production"
SECRET_DESCRIPTIONS["CSRF_SECRET"]="CSRF token secret"

# Payment secrets (Critical - Production only)
SECRET_CONTEXTS["STRIPE_PUBLISHABLE_KEY"]="production,deploy-preview"
SECRET_DESCRIPTIONS["STRIPE_PUBLISHABLE_KEY"]="Stripe publishable key"

SECRET_CONTEXTS["STRIPE_SECRET_KEY"]="production"
SECRET_DESCRIPTIONS["STRIPE_SECRET_KEY"]="Stripe secret key (CRITICAL)"

SECRET_CONTEXTS["STRIPE_WEBHOOK_SECRET"]="production"
SECRET_DESCRIPTIONS["STRIPE_WEBHOOK_SECRET"]="Stripe webhook secret"

# Telephony secrets
SECRET_CONTEXTS["TWILIO_ACCOUNT_SID"]="production,deploy-preview"
SECRET_DESCRIPTIONS["TWILIO_ACCOUNT_SID"]="Twilio account SID"

SECRET_CONTEXTS["TWILIO_AUTH_TOKEN"]="production"
SECRET_DESCRIPTIONS["TWILIO_AUTH_TOKEN"]="Twilio auth token (CRITICAL)"

# External API secrets (Medium sensitivity)
SECRET_CONTEXTS["MAXMIND_LICENSE_KEY"]="production,deploy-preview,branch-deploy"
SECRET_DESCRIPTIONS["MAXMIND_LICENSE_KEY"]="MaxMind GeoIP license key"

SECRET_CONTEXTS["IPINFO_API_TOKEN"]="production,deploy-preview,branch-deploy"
SECRET_DESCRIPTIONS["IPINFO_API_TOKEN"]="IPInfo API token"

SECRET_CONTEXTS["HCAPTCHA_SITE_KEY"]="production,deploy-preview,branch-deploy"
SECRET_DESCRIPTIONS["HCAPTCHA_SITE_KEY"]="hCaptcha site key"

SECRET_CONTEXTS["HCAPTCHA_SECRET_KEY"]="production,deploy-preview"
SECRET_DESCRIPTIONS["HCAPTCHA_SECRET_KEY"]="hCaptcha secret key"

# Monitoring secrets
SECRET_CONTEXTS["VITE_SENTRY_DSN"]="production,deploy-preview,branch-deploy"
SECRET_DESCRIPTIONS["VITE_SENTRY_DSN"]="Sentry DSN for error tracking"

# Redis secrets
SECRET_CONTEXTS["REDIS_HOST"]="production,deploy-preview"
SECRET_DESCRIPTIONS["REDIS_HOST"]="Redis host"

SECRET_CONTEXTS["REDIS_PORT"]="production,deploy-preview"
SECRET_DESCRIPTIONS["REDIS_PORT"]="Redis port"

SECRET_CONTEXTS["REDIS_PASSWORD"]="production"
SECRET_DESCRIPTIONS["REDIS_PASSWORD"]="Redis password (CRITICAL)"

# Security configuration
SECRET_CONTEXTS["MASTER_ENCRYPTION_KEY"]="production"
SECRET_DESCRIPTIONS["MASTER_ENCRYPTION_KEY"]="Master encryption key (CRITICAL)"

SECRET_CONTEXTS["PII_ENCRYPTION_KEY"]="production"
SECRET_DESCRIPTIONS["PII_ENCRYPTION_KEY"]="PII encryption key (CRITICAL)"

# Webhook secrets
SECRET_CONTEXTS["TELEPHONY_WEBHOOK_SECRET"]="production,deploy-preview"
SECRET_DESCRIPTIONS["TELEPHONY_WEBHOOK_SECRET"]="Telephony webhook secret"

# Function to set environment variable for multiple contexts
set_env_var() {
    local key="$1"
    local value="$2"
    local contexts="$3"
    local description="$4"
    
    echo -e "${BLUE}Setting $key...${NC}"
    echo -e "${YELLOW}  Description: $description${NC}"
    
    # Split contexts by comma and set for each
    IFS=',' read -ra CONTEXT_ARRAY <<< "$contexts"
    for context in "${CONTEXT_ARRAY[@]}"; do
        context=$(echo "$context" | xargs) # trim whitespace
        echo -e "${YELLOW}  Context: $context${NC}"
        
        if netlify env:set "$key" "$value" --context "$context" --silent; then
            echo -e "${GREEN}  ✅ Set for $context${NC}"
        else
            echo -e "${RED}  ❌ Failed to set for $context${NC}"
            return 1
        fi
    done
    echo
}

# Function to check if value is a placeholder
is_placeholder() {
    local value="$1"
    
    # Check for common placeholder patterns
    if [[ "$value" =~ ^your_.* ]] || \
       [[ "$value" =~ .*_here$ ]] || \
       [[ "$value" =~ ^<.*>$ ]] || \
       [[ "$value" == "CHANGE_ME" ]] || \
       [[ "$value" == "TODO" ]] || \
       [[ "$value" == "" ]]; then
        return 0
    fi
    
    return 1
}

# Process environment file
SECRETS_SET=0
SECRETS_SKIPPED=0
SECRETS_FAILED=0

echo -e "${YELLOW}🚀 Starting secret migration...${NC}\n"

# Read the .env file and process each line
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Extract key and value
    if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        
        # Remove quotes if present
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        
        # Check if this is a known DCE secret
        if [[ -n "${SECRET_CONTEXTS[$key]}" ]]; then
            # Check if value is a placeholder
            if is_placeholder "$value"; then
                echo -e "${YELLOW}⚠️  Skipping $key (placeholder value)${NC}"
                echo -e "${YELLOW}   Value: $value${NC}"
                echo -e "${YELLOW}   Please set the actual value in Netlify dashboard${NC}\n"
                ((SECRETS_SKIPPED++))
                continue
            fi
            
            # Prompt for confirmation of sensitive secrets
            if [[ "${SECRET_DESCRIPTIONS[$key]}" =~ CRITICAL ]]; then
                echo -e "${RED}🔥 CRITICAL SECRET: $key${NC}"
                echo -e "${YELLOW}   Value: ${value:0:10}...${NC}"
                read -p "   Set this critical secret? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    echo -e "${YELLOW}   Skipped $key${NC}\n"
                    ((SECRETS_SKIPPED++))
                    continue
                fi
            fi
            
            # Set the environment variable
            if set_env_var "$key" "$value" "${SECRET_CONTEXTS[$key]}" "${SECRET_DESCRIPTIONS[$key]}"; then
                ((SECRETS_SET++))
            else
                ((SECRETS_FAILED++))
            fi
        fi
    fi
done < "$ENV_FILE"

# Summary
echo -e "${BLUE}📊 Migration Summary${NC}"
echo -e "${BLUE}==================${NC}"
echo -e "${GREEN}✅ Secrets set: $SECRETS_SET${NC}"
echo -e "${YELLOW}⚠️  Secrets skipped: $SECRETS_SKIPPED${NC}"
echo -e "${RED}❌ Secrets failed: $SECRETS_FAILED${NC}\n"

# Verify migration
echo -e "${YELLOW}🔍 Verifying migration...${NC}"
if netlify env:list --json > "$BACKUP_DIR/netlify-env-after.json"; then
    echo -e "${GREEN}✅ Post-migration environment variables saved${NC}"
else
    echo -e "${RED}❌ Failed to save post-migration state${NC}"
fi

# Check for missing critical secrets
echo -e "${YELLOW}🔍 Checking for missing critical secrets...${NC}"
MISSING_CRITICAL=()

for key in "${!SECRET_CONTEXTS[@]}"; do
    if [[ "${SECRET_DESCRIPTIONS[$key]}" =~ CRITICAL ]]; then
        if ! netlify env:get "$key" --context production &>/dev/null; then
            MISSING_CRITICAL+=("$key")
        fi
    fi
done

if [ ${#MISSING_CRITICAL[@]} -gt 0 ]; then
    echo -e "${RED}⚠️  Missing critical secrets:${NC}"
    for secret in "${MISSING_CRITICAL[@]}"; do
        echo -e "${RED}   - $secret${NC}"
    done
    echo -e "${YELLOW}Please set these manually in the Netlify dashboard${NC}\n"
fi

# Generate post-migration checklist
echo -e "${YELLOW}📝 Generating post-migration checklist...${NC}"
cat > "$BACKUP_DIR/post-migration-checklist.md" << EOF
# DCE Platform Post-Migration Checklist

## Migration Summary
- Secrets set: $SECRETS_SET
- Secrets skipped: $SECRETS_SKIPPED  
- Secrets failed: $SECRETS_FAILED
- Migration date: $(date)

## Next Steps

### 1. Verify Critical Secrets
Manually verify these critical secrets are set correctly:
$(for key in "${!SECRET_CONTEXTS[@]}"; do
    if [[ "${SECRET_DESCRIPTIONS[$key]}" =~ CRITICAL ]]; then
        echo "- [ ] $key"
    fi
done)

### 2. Test Application
- [ ] Deploy to staging environment
- [ ] Verify database connections work
- [ ] Test authentication flows
- [ ] Verify payment processing
- [ ] Check monitoring and logging

### 3. Update Documentation
- [ ] Update deployment documentation
- [ ] Update developer setup guides
- [ ] Document new secret management procedures

### 4. Security Tasks
- [ ] Remove .env files from development environments
- [ ] Update .gitignore to prevent .env commits
- [ ] Set up secret rotation schedules
- [ ] Configure monitoring for secret access

### 5. Team Communication
- [ ] Notify development team of changes
- [ ] Update onboarding documentation
- [ ] Schedule secret management training

## Rollback Plan
If issues arise, environment variables can be restored from:
- Backup file: $BACKUP_DIR/netlify-env-backup.json
- Use: \`netlify env:import netlify-env-backup.json\`

## Emergency Contacts
- DevOps Team: devops@dependablecalls.com
- Security Team: security@dependablecalls.com
EOF

echo -e "${GREEN}✅ Post-migration checklist saved to $BACKUP_DIR/post-migration-checklist.md${NC}\n"

# Final recommendations
echo -e "${BLUE}🎯 Final Recommendations${NC}"
echo -e "${BLUE}=======================${NC}"
echo -e "${GREEN}1. Review the post-migration checklist${NC}"
echo -e "${GREEN}2. Test your application thoroughly${NC}"
echo -e "${GREEN}3. Remove .env files from production systems${NC}"
echo -e "${GREEN}4. Set up automated secret rotation${NC}"
echo -e "${GREEN}5. Configure secret access monitoring${NC}\n"

if [ $SECRETS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Secret migration completed successfully!${NC}"
    echo -e "${GREEN}Your secrets are now securely managed by Netlify.${NC}"
else
    echo -e "${YELLOW}⚠️  Migration completed with some failures.${NC}"
    echo -e "${YELLOW}Please review the failed secrets and set them manually.${NC}"
fi

echo -e "\n${BLUE}Backup directory: $BACKUP_DIR${NC}"
echo -e "${BLUE}Happy coding! 🚀${NC}"