#!/usr/bin/env bash

# Pre-Production Checklist Script
# Validates all aspects of the DCE website before production deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REQUIRED_ENV_VARS=(
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
    "STRIPE_PUBLIC_KEY"
    "STRIPE_SECRET_KEY"
    "DATABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
)

# Lighthouse thresholds
LIGHTHOUSE_PERFORMANCE_THRESHOLD=90
LIGHTHOUSE_ACCESSIBILITY_THRESHOLD=95
LIGHTHOUSE_BEST_PRACTICES_THRESHOLD=90
LIGHTHOUSE_SEO_THRESHOLD=90

# Track failures
FAILURES=0
WARNINGS=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILURES++))
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
    ((WARNINGS++))
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed"
        return 1
    fi
    return 0
}

# Check required commands
check_dependencies() {
    log_info "Checking dependencies..."
    
    local deps=("node" "npm" "npx" "lighthouse" "jq")
    local missing=0
    
    for dep in "${deps[@]}"; do
        if ! check_command "$dep"; then
            ((missing++))
        fi
    done
    
    if [ $missing -eq 0 ]; then
        log_success "All dependencies installed"
    else
        log_error "Missing $missing dependencies"
        exit 1
    fi
}

# 1. Run all test suites
run_tests() {
    log_info "Running test suites..."
    
    # Unit and integration tests
    if [ -f "vitest.config.ts" ]; then
        log_info "Running unit and integration tests..."
        if npm test -- --run; then
            log_success "Unit and integration tests passed"
        else
            log_error "Unit and integration tests failed"
        fi
    else
        log_warning "Vitest config not found, skipping unit tests"
    fi
    
    # E2E tests
    if [ -f "playwright.config.ts" ]; then
        log_info "Running E2E tests..."
        if npx playwright test; then
            log_success "E2E tests passed"
        else
            log_error "E2E tests failed"
        fi
    else
        log_warning "Playwright config not found, skipping E2E tests"
    fi
    
    # Type checking
    log_info "Running TypeScript type check..."
    if npx tsc --noEmit; then
        log_success "TypeScript type check passed"
    else
        log_error "TypeScript type check failed"
    fi
    
    # Linting
    log_info "Running ESLint..."
    if npm run lint; then
        log_success "ESLint check passed"
    else
        log_error "ESLint check failed"
    fi
}

# 2. Verify build succeeds
verify_build() {
    log_info "Verifying production build..."
    
    # Clean previous build
    rm -rf dist
    
    if npm run build; then
        log_success "Production build succeeded"
        
        # Check build output
        if [ -d "dist" ] && [ -f "dist/index.html" ]; then
            log_success "Build artifacts generated"
            
            # Check bundle size
            local total_size=$(du -sh dist | cut -f1)
            log_info "Total build size: $total_size"
            
            # Check for source maps in production
            if find dist -name "*.map" | grep -q .; then
                log_warning "Source maps found in production build"
            fi
        else
            log_error "Build artifacts missing"
        fi
    else
        log_error "Production build failed"
    fi
}

# 3. Check Lighthouse scores
check_lighthouse() {
    log_info "Running Lighthouse audit..."
    
    # Start preview server
    npm run preview &
    local SERVER_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Run Lighthouse
    local LIGHTHOUSE_REPORT="lighthouse-report.json"
    
    if lighthouse http://localhost:4173 \
        --output=json \
        --output-path="$LIGHTHOUSE_REPORT" \
        --chrome-flags="--headless" \
        --quiet; then
        
        # Parse scores
        local performance=$(jq '.categories.performance.score * 100' "$LIGHTHOUSE_REPORT")
        local accessibility=$(jq '.categories.accessibility.score * 100' "$LIGHTHOUSE_REPORT")
        local best_practices=$(jq '[.categories."best-practices".score // 0][0] * 100' "$LIGHTHOUSE_REPORT")
        local seo=$(jq '.categories.seo.score * 100' "$LIGHTHOUSE_REPORT")
        
        log_info "Lighthouse Scores:"
        log_info "  Performance: ${performance}% (threshold: ${LIGHTHOUSE_PERFORMANCE_THRESHOLD}%)"
        log_info "  Accessibility: ${accessibility}% (threshold: ${LIGHTHOUSE_ACCESSIBILITY_THRESHOLD}%)"
        log_info "  Best Practices: ${best_practices}% (threshold: ${LIGHTHOUSE_BEST_PRACTICES_THRESHOLD}%)"
        log_info "  SEO: ${seo}% (threshold: ${LIGHTHOUSE_SEO_THRESHOLD}%)"
        
        # Check thresholds
        if (( $(echo "$performance >= $LIGHTHOUSE_PERFORMANCE_THRESHOLD" | bc -l) )); then
            log_success "Performance score meets threshold"
        else
            log_error "Performance score below threshold"
        fi
        
        if (( $(echo "$accessibility >= $LIGHTHOUSE_ACCESSIBILITY_THRESHOLD" | bc -l) )); then
            log_success "Accessibility score meets threshold"
        else
            log_error "Accessibility score below threshold"
        fi
        
        if (( $(echo "$best_practices >= $LIGHTHOUSE_BEST_PRACTICES_THRESHOLD" | bc -l) )); then
            log_success "Best practices score meets threshold"
        else
            log_error "Best practices score below threshold"
        fi
        
        if (( $(echo "$seo >= $LIGHTHOUSE_SEO_THRESHOLD" | bc -l) )); then
            log_success "SEO score meets threshold"
        else
            log_error "SEO score below threshold"
        fi
        
        # Clean up
        rm -f "$LIGHTHOUSE_REPORT"
    else
        log_error "Lighthouse audit failed"
    fi
    
    # Stop preview server
    kill $SERVER_PID 2>/dev/null || true
}

# 4. Validate security headers
validate_security_headers() {
    log_info "Validating security headers..."
    
    # Check for netlify.toml security headers
    if [ -f "netlify.toml" ]; then
        log_info "Checking netlify.toml for security headers..."
        
        local required_headers=(
            "X-Frame-Options"
            "X-Content-Type-Options"
            "Referrer-Policy"
            "Permissions-Policy"
            "Content-Security-Policy"
        )
        
        for header in "${required_headers[@]}"; do
            if grep -q "$header" netlify.toml; then
                log_success "$header configured"
            else
                log_error "$header missing in netlify.toml"
            fi
        done
    else
        log_error "netlify.toml not found - security headers not configured"
    fi
    
    # Check for sensitive data in code
    log_info "Checking for hardcoded secrets..."
    
    if grep -r "sk_live_" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" src/ 2>/dev/null; then
        log_error "Found hardcoded Stripe secret key"
    fi
    
    if grep -r "service_role" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" src/ 2>/dev/null; then
        log_error "Found hardcoded service role key"
    fi
    
    if [ $FAILURES -eq 0 ]; then
        log_success "No hardcoded secrets found"
    fi
}

# 5. Check database migrations
check_database_migrations() {
    log_info "Checking database migrations..."
    
    if [ -d "supabase/migrations" ]; then
        local migration_count=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l)
        log_info "Found $migration_count migration files"
        
        # Check for pending migrations
        if command -v supabase &> /dev/null; then
            log_info "Checking migration status with Supabase CLI..."
            
            if supabase db diff --use-migra; then
                log_success "Database schema is up to date"
            else
                log_warning "Database schema differences detected"
            fi
        else
            log_warning "Supabase CLI not installed - cannot verify migration status"
        fi
        
        # Check for migration naming convention
        if ls supabase/migrations/*.sql | grep -v '^[0-9]\{3\}_' 2>/dev/null; then
            log_warning "Some migrations don't follow naming convention (###_description.sql)"
        fi
    else
        log_error "No migrations directory found"
    fi
}

# 6. Verify environment variables
verify_environment_variables() {
    log_info "Verifying environment variables..."
    
    # Check .env.example
    if [ -f ".env.example" ]; then
        log_success ".env.example found"
    else
        log_warning ".env.example missing - difficult to track required variables"
    fi
    
    # Check for required variables in current environment
    local missing_vars=0
    
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "Missing environment variable: $var"
            ((missing_vars++))
        else
            log_success "$var is set"
        fi
    done
    
    if [ $missing_vars -eq 0 ]; then
        log_success "All required environment variables are set"
    fi
    
    # Check for production values
    if [[ "${VITE_SUPABASE_URL:-}" =~ "localhost" ]]; then
        log_warning "VITE_SUPABASE_URL points to localhost"
    fi
}

# Additional checks
run_additional_checks() {
    log_info "Running additional checks..."
    
    # Check for console.log statements
    log_info "Checking for console.log statements..."
    local console_count=$(grep -r "console\.log" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | wc -l)
    if [ $console_count -gt 0 ]; then
        log_warning "Found $console_count console.log statements"
    else
        log_success "No console.log statements found"
    fi
    
    # Check for TODO comments
    log_info "Checking for TODO comments..."
    local todo_count=$(grep -r "TODO" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | wc -l)
    if [ $todo_count -gt 0 ]; then
        log_warning "Found $todo_count TODO comments"
    else
        log_success "No TODO comments found"
    fi
    
    # Check package-lock.json
    if [ -f "package-lock.json" ]; then
        log_success "package-lock.json exists"
    else
        log_error "package-lock.json missing - inconsistent dependencies possible"
    fi
    
    # Check for npm audit issues
    log_info "Running npm audit..."
    if npm audit --production --audit-level=high; then
        log_success "No high severity vulnerabilities found"
    else
        log_error "High severity vulnerabilities detected"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}=== Pre-Production Checklist ===${NC}"
    echo -e "${BLUE}Running comprehensive checks...${NC}\n"
    
    # Run all checks
    check_dependencies
    echo
    
    run_tests
    echo
    
    verify_build
    echo
    
    if command -v lighthouse &> /dev/null; then
        check_lighthouse
        echo
    else
        log_warning "Lighthouse not installed - skipping performance audit"
        echo
    fi
    
    validate_security_headers
    echo
    
    check_database_migrations
    echo
    
    verify_environment_variables
    echo
    
    run_additional_checks
    echo
    
    # Summary
    echo -e "${BLUE}=== Summary ===${NC}"
    
    if [ $FAILURES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}All checks passed! ✨${NC}"
        echo -e "${GREEN}Application is ready for production deployment.${NC}"
        exit 0
    else
        echo -e "${RED}Failures: $FAILURES${NC}"
        echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
        
        if [ $FAILURES -gt 0 ]; then
            echo -e "\n${RED}⚠️  Production deployment NOT recommended!${NC}"
            echo -e "${RED}Please fix all failures before deploying.${NC}"
            exit 1
        else
            echo -e "\n${YELLOW}⚠️  Production deployment possible but not ideal.${NC}"
            echo -e "${YELLOW}Consider addressing warnings for better production readiness.${NC}"
            exit 0
        fi
    fi
}

# Run main function
main "$@"