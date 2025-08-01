#!/bin/bash

# Comprehensive Container Security Monitor Validation Runner
# 
# This script executes the complete validation test suite to assess
# deployment readiness of the modular Container Security Monitor.

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VALIDATION_DIR="$SCRIPT_DIR"
REPORTS_DIR="$VALIDATION_DIR/reports"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run comprehensive Container Security Monitor validation tests.

OPTIONS:
    -h, --help              Show this help message
    -q, --quick            Run only critical tests (faster execution)
    -f, --full             Run full validation suite including slow tests
    -p, --production       Include production simulation tests (very slow)
    -o, --output DIR       Output directory for reports (default: ./reports)
    --no-parallel          Disable parallel test execution
    --html                 Generate HTML reports in addition to JSON
    --clean                Clean previous reports before running
    --dry-run              Show what would be executed without running tests

EXAMPLES:
    $0 --quick                     # Quick validation (critical tests only)
    $0 --full --html              # Full validation with HTML reports
    $0 --production --output ./prod_reports  # Production validation
    $0 --clean --full             # Clean and run full validation

EOF
}

# Parse command line arguments
QUICK_MODE=false
FULL_MODE=false
PRODUCTION_MODE=false
OUTPUT_DIR="$REPORTS_DIR"
PARALLEL=true
GENERATE_HTML=false
CLEAN_REPORTS=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -q|--quick)
            QUICK_MODE=true
            shift
            ;;
        -f|--full)
            FULL_MODE=true
            shift
            ;;
        -p|--production)
            PRODUCTION_MODE=true
            shift
            ;;
        -o|--output)
            OUTPUT_DIR="$2" 
            shift 2
            ;;
        --no-parallel)
            PARALLEL=false
            shift
            ;;
        --html)
            GENERATE_HTML=true
            shift
            ;;
        --clean)
            CLEAN_REPORTS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Set mode based on flags
if [[ "$PRODUCTION_MODE" == "true" ]]; then
    FULL_MODE=true
fi

# Validation functions
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Python version
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is required but not installed"
        exit 1
    fi
    
    local python_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    local required_version="3.8"
    
    if ! python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)"; then
        log_error "Python 3.8+ required, found: $python_version"
        exit 1
    fi
    
    log_success "Python $python_version detected"
    
    # Check required packages
    local required_packages=("pytest" "pytest-asyncio" "docker" "aiohttp" "pydantic" "psutil")
    local missing_packages=()
    
    for package in "${required_packages[@]}"; do
        if ! python3 -c "import ${package//-/_}" 2>/dev/null; then
            missing_packages+=("$package")
        fi
    done
    
    if [[ ${#missing_packages[@]} -gt 0 ]]; then
        log_error "Missing required packages: ${missing_packages[*]}"
        log_info "Install with: pip install ${missing_packages[*]}"
        exit 1
    fi
    
    log_success "All required packages available"
    
    # Check Docker availability (optional for some tests)
    if command -v docker &> /dev/null; then
        if docker info &> /dev/null; then
            log_success "Docker daemon accessible"
        else
            log_warning "Docker daemon not accessible (some tests may be limited)"
        fi
    else
        log_warning "Docker not installed (some tests may be limited)"
    fi
}

setup_environment() {
    log_info "Setting up test environment..."
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Clean previous reports if requested
    if [[ "$CLEAN_REPORTS" == "true" ]]; then
        log_info "Cleaning previous reports..."
        rm -rf "$OUTPUT_DIR"/*
    fi
    
    # Set PYTHONPATH to include project root
    export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    log_success "Environment setup complete"
}

run_validation_tests() {
    log_info "Starting validation test execution..."
    
    local start_time=$(date +%s)
    local pytest_args=()
    local test_files=()
    
    # Configure pytest arguments
    pytest_args+=("-v" "--tb=short")
    pytest_args+=("--junit-xml=$OUTPUT_DIR/validation_results.xml")
    
    if command -v pytest-json-report &> /dev/null; then
        pytest_args+=("--json-report" "--json-report-file=$OUTPUT_DIR/validation_report.json")
    fi
    
    # Add parallel execution if enabled and available
    if [[ "$PARALLEL" == "true" ]] && command -v pytest-xdist &> /dev/null; then
        pytest_args+=("-n" "auto")
        log_info "Parallel test execution enabled"
    fi
    
    # Add coverage if available
    if command -v pytest-cov &> /dev/null; then
        pytest_args+=("--cov=container_monitor")
        pytest_args+=("--cov-report=term-missing")
        pytest_args+=("--cov-report=html:$OUTPUT_DIR/coverage_html")
        log_info "Code coverage reporting enabled"
    fi
    
    # Select test files based on mode
    if [[ "$QUICK_MODE" == "true" ]]; then
        log_info "Running QUICK validation (critical tests only)..."
        test_files=(
            "tests/validation/test_functional_parity.py"
            "tests/validation/test_side_by_side.py"
        )
        pytest_args+=("-m" "not slow and not production")
        
    elif [[ "$FULL_MODE" == "true" ]]; then
        log_info "Running FULL validation suite..."
        test_files=(
            "tests/validation/test_functional_parity.py"
            "tests/validation/test_performance_benchmarks.py"
            "tests/validation/test_side_by_side.py"
            "tests/validation/test_migration_validation.py"
        )
        
        if [[ "$PRODUCTION_MODE" == "true" ]]; then
            log_info "Including PRODUCTION simulation tests..."
            test_files+=("tests/validation/test_production_simulation.py")
        else
            pytest_args+=("-m" "not production")
        fi
        
    else
        log_info "Running STANDARD validation..."
        test_files=(
            "tests/validation/test_functional_parity.py"
            "tests/validation/test_performance_benchmarks.py"
            "tests/validation/test_side_by_side.py"
        )
        pytest_args+=("-m" "not slow and not production")
    fi
    
    # Show command that would be executed
    local cmd="python3 -m pytest ${pytest_args[*]} ${test_files[*]}"
    log_info "Executing: $cmd"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute validation tests"
        return 0
    fi
    
    # Execute tests
    local exit_code=0
    python3 -m pytest "${pytest_args[@]}" "${test_files[@]}" || exit_code=$?
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Validation tests completed successfully in ${duration}s"
    else
        log_error "Validation tests failed (exit code: $exit_code) after ${duration}s"
    fi
    
    return $exit_code
}

generate_reports() {
    log_info "Generating validation reports..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would generate validation reports"
        return 0
    fi
    
    # Check if validation report JSON exists
    local validation_report="$OUTPUT_DIR/validation_report.json"
    
    if [[ ! -f "$validation_report" ]]; then
        log_warning "Validation report JSON not found, creating summary..."
        
        # Create a basic report structure
        cat > "$validation_report" << EOF
{
    "validation_summary": {
        "overall_status": "UNKNOWN",
        "start_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "end_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "total_duration_seconds": 0,
        "total_tests": 0,
        "tests_passed": 0,
        "tests_failed": 0,
        "success_rate": 0
    },
    "test_results": {},
    "deployment_readiness": {
        "deployment_recommendation": "UNKNOWN",
        "risk_level": "UNKNOWN",
        "readiness_score": 0
    }
}
EOF
    fi
    
    # Generate deployment readiness report
    if [[ -f "$VALIDATION_DIR/generate_deployment_report.py" ]]; then
        log_info "Generating deployment readiness report..."
        
        local deployment_report="$OUTPUT_DIR/deployment_readiness_report.json"
        local cmd="python3 $VALIDATION_DIR/generate_deployment_report.py $validation_report --output $deployment_report"
        
        if [[ "$GENERATE_HTML" == "true" ]]; then
            cmd="$cmd --html"
        fi
        
        if $cmd; then
            log_success "Deployment readiness report generated"
        else
            log_warning "Failed to generate deployment readiness report"
        fi
    else
        log_warning "Deployment report generator not found"
    fi
    
    # Generate summary report
    generate_summary_report "$validation_report"
}

generate_summary_report() {
    local validation_report="$1"
    local summary_file="$OUTPUT_DIR/VALIDATION_SUMMARY.txt"
    
    log_info "Generating validation summary..."
    
    # Extract key information from JSON report
    local overall_status=$(python3 -c "
import json, sys
try:
    with open('$validation_report', 'r') as f:
        data = json.load(f)
    summary = data.get('validation_summary', {})
    print(summary.get('overall_status', 'UNKNOWN'))
except:
    print('UNKNOWN')
")
    
    local readiness_score=$(python3 -c "
import json, sys
try:
    with open('$validation_report', 'r') as f:
        data = json.load(f)
    readiness = data.get('deployment_readiness', {})
    print(readiness.get('readiness_score', 0))
except:
    print(0)
")
    
    # Generate summary text
    cat > "$summary_file" << EOF
================================================================================
CONTAINER SECURITY MONITOR - VALIDATION SUMMARY
================================================================================

Validation Date: $(date)
Validation Mode: $(if [[ "$PRODUCTION_MODE" == "true" ]]; then echo "PRODUCTION"; elif [[ "$FULL_MODE" == "true" ]]; then echo "FULL"; elif [[ "$QUICK_MODE" == "true" ]]; then echo "QUICK"; else echo "STANDARD"; fi)

OVERALL STATUS: $overall_status
READINESS SCORE: ${readiness_score}%

DEPLOYMENT RECOMMENDATION:
$(python3 -c "
import json
try:
    with open('$validation_report', 'r') as f:
        data = json.load(f)
    readiness = data.get('deployment_readiness', {})
    recommendation = readiness.get('deployment_recommendation', 'UNKNOWN')
    summary = readiness.get('summary', 'No summary available')
    print(f'{recommendation}: {summary}')
except:
    print('UNKNOWN: Unable to determine deployment readiness')
")

REPORTS GENERATED:
- Validation Results: $OUTPUT_DIR/validation_results.xml
- JSON Report: $OUTPUT_DIR/validation_report.json
- Deployment Report: $OUTPUT_DIR/deployment_readiness_report.json
$(if [[ "$GENERATE_HTML" == "true" ]]; then echo "- HTML Report: $OUTPUT_DIR/deployment_readiness_report.html"; fi)
$(if command -v pytest-cov &> /dev/null; then echo "- Coverage Report: $OUTPUT_DIR/coverage_html/index.html"; fi)

For detailed analysis, review the JSON and HTML reports.

================================================================================
EOF
    
    log_success "Validation summary generated: $summary_file"
}

# Main execution
main() {
    echo "================================================================================"
    echo "Container Security Monitor - Comprehensive Validation Runner"
    echo "================================================================================"
    echo
    
    # Parse mode for display
    local mode_description="STANDARD"
    if [[ "$PRODUCTION_MODE" == "true" ]]; then
        mode_description="PRODUCTION (includes all tests)"
    elif [[ "$FULL_MODE" == "true" ]]; then
        mode_description="FULL (excludes production simulation)"
    elif [[ "$QUICK_MODE" == "true" ]]; then
        mode_description="QUICK (critical tests only)"
    fi
    
    log_info "Validation Mode: $mode_description"
    log_info "Output Directory: $OUTPUT_DIR"
    log_info "Parallel Execution: $(if [[ "$PARALLEL" == "true" ]]; then echo "ENABLED"; else echo "DISABLED"; fi)"
    log_info "HTML Reports: $(if [[ "$GENERATE_HTML" == "true" ]]; then echo "ENABLED"; else echo "DISABLED"; fi)"
    echo
    
    # Execute validation pipeline
    check_prerequisites
    setup_environment
    
    local overall_exit_code=0
    
    # Run tests
    if ! run_validation_tests; then
        overall_exit_code=1
    fi
    
    # Generate reports regardless of test results
    generate_reports
    
    echo
    echo "================================================================================"
    if [[ $overall_exit_code -eq 0 ]]; then
        log_success "VALIDATION COMPLETED SUCCESSFULLY"
        echo
        log_info "Check the validation summary: $OUTPUT_DIR/VALIDATION_SUMMARY.txt"
        log_info "Review detailed reports in: $OUTPUT_DIR/"
    else
        log_error "VALIDATION COMPLETED WITH FAILURES"
        echo
        log_info "Check test results for details: $OUTPUT_DIR/validation_results.xml"
        log_info "Review error details in: $OUTPUT_DIR/"
    fi
    echo "================================================================================"
    
    exit $overall_exit_code
}

# Execute main function
main "$@"