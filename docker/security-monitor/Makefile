# Container Security Monitor - Development & Security Makefile
# ================================================================

.PHONY: help install test lint format security sbom cve-scan clean all

# Default target
help: ## Show this help message
	@echo "Container Security Monitor v2.0 - Development Commands"
	@echo "======================================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development Environment
install: ## Install all dependencies including dev tools
	@echo "🔧 Installing dependencies..."
	pip install -r requirements-v2.txt
	@echo "✅ Dependencies installed"

install-dev: ## Install development dependencies only
	@echo "🔧 Installing development dependencies..."
	pip install pytest pytest-asyncio pytest-cov pytest-mock faker black ruff mypy bandit safety pip-audit cyclonedx-bom
	@echo "✅ Development dependencies installed"

# Code Quality
lint: ## Run all linting tools
	@echo "🔍 Running linting checks..."
	@echo "• Running ruff..."
	ruff check container_monitor/ src/ --fix
	@echo "• Running mypy..."
	mypy container_monitor/ src/ --ignore-missing-imports
	@echo "• Running black check..."
	black --check container_monitor/ src/ tests/
	@echo "✅ Linting completed"

format: ## Format code with black and ruff
	@echo "🎨 Formatting code..."
	black container_monitor/ src/ tests/
	ruff format container_monitor/ src/ tests/
	@echo "✅ Code formatted"

# Testing
test: ## Run all tests with coverage
	@echo "🧪 Running test suite..."
	pytest tests/ \
		--cov=container_monitor \
		--cov-report=html:htmlcov \
		--cov-report=term-missing \
		--cov-report=xml:coverage.xml \
		--junit-xml=test-results.xml \
		-v
	@echo "✅ Tests completed"

test-unit: ## Run unit tests only
	@echo "🧪 Running unit tests..."
	pytest tests/unit/ -v

test-integration: ## Run integration tests only
	@echo "🧪 Running integration tests..."
	pytest tests/integration/ -v

test-watch: ## Run tests in watch mode
	@echo "👀 Running tests in watch mode..."
	pytest-watch tests/ -- --cov=container_monitor

# Security Scanning
security: cve-scan bandit ## Run comprehensive security scans

cve-scan: ## Run CVE and vulnerability scanning
	@echo "🔒 Running CVE scan..."
	./scripts/cve-scan.sh

bandit: ## Run Bandit security analysis
	@echo "🔒 Running Bandit security analysis..."
	bandit -r container_monitor/ src/ -f json -o security-scans/bandit-latest.json || true
	bandit -r container_monitor/ src/ -f txt

safety: ## Run Safety dependency vulnerability scan
	@echo "🔒 Running Safety scan..."
	safety check --requirements requirements-v2.txt --json --output security-scans/safety-latest.json || true
	safety check --requirements requirements-v2.txt

# SBOM Generation
sbom: ## Generate Software Bill of Materials
	@echo "📋 Generating SBOM..."
	./scripts/generate-sbom.sh

sbom-json: ## Generate SBOM in JSON format
	@echo "📋 Generating SBOM (JSON format)..."
	OUTPUT_FORMAT=json ./scripts/generate-sbom.sh

sbom-xml: ## Generate SBOM in XML format
	@echo "📋 Generating SBOM (XML format)..."
	OUTPUT_FORMAT=xml ./scripts/generate-sbom.sh

# Container Operations
build: ## Build Docker container
	@echo "🐳 Building container..."
	docker build -t security-monitor:latest .
	@echo "✅ Container built"

build-dev: ## Build development container
	@echo "🐳 Building development container..."
	docker build -t security-monitor:dev -f Dockerfile.dev .
	@echo "✅ Development container built"

scan-image: build ## Scan Docker image for vulnerabilities
	@echo "🔍 Scanning container image..."
	@if command -v trivy >/dev/null 2>&1; then \
		trivy image security-monitor:latest; \
	else \
		echo "⚠️  Trivy not installed. Install with: brew install trivy"; \
	fi

run: ## Run the security monitor
	@echo "🚀 Starting security monitor..."
	python -m container_monitor.core.monitor

run-dev: ## Run in development mode with hot reload
	@echo "🚀 Starting security monitor (dev mode)..."
	python -m container_monitor.core.monitor --dev

# Performance & Profiling
profile: ## Run with memory profiling
	@echo "📊 Running with memory profiling..."
	python -m memray run -o security-monitor.bin -m container_monitor.core.monitor
	memray flamegraph security-monitor.bin

benchmark: ## Run performance benchmarks
	@echo "📊 Running performance benchmarks..."
	python tests/benchmarks/run_benchmarks.py

# Cleanup
clean: ## Clean up generated files
	@echo "🧹 Cleaning up..."
	rm -rf __pycache__/
	rm -rf .pytest_cache/
	rm -rf htmlcov/
	rm -rf .coverage
	rm -rf coverage.xml
	rm -rf test-results.xml
	rm -rf security-scans/reports/*
	rm -rf sbom/reports/*
	rm -rf *.bin
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	@echo "✅ Cleanup completed"

clean-all: clean ## Clean everything including dependencies
	@echo "🧹 Deep cleaning..."
	rm -rf venv/
	rm -rf .venv/
	pip freeze | xargs pip uninstall -y || true
	@echo "✅ Deep cleanup completed"

# CI/CD Pipeline Commands
ci-setup: install-dev ## Setup CI environment
	@echo "🔧 Setting up CI environment..."
	pip install --upgrade pip setuptools wheel

ci-test: lint test security ## Run full CI test suite
	@echo "✅ CI pipeline completed successfully"

ci-release: ci-test sbom ## Run release pipeline
	@echo "🚀 Release pipeline completed"

# Development Server
dev-server: ## Start development server with auto-reload
	@echo "🔄 Starting development server..."
	watchfiles "python -m container_monitor.core.monitor" container_monitor/

# Documentation
docs: ## Generate documentation
	@echo "📚 Generating documentation..."
	@if command -v sphinx-build >/dev/null 2>&1; then \
		sphinx-build -b html docs/ docs/_build/html; \
		echo "✅ Documentation generated in docs/_build/html"; \
	else \
		echo "⚠️  Sphinx not installed. Install with: pip install sphinx"; \
	fi

# Monitoring
logs: ## View application logs
	@echo "📋 Viewing logs..."
	tail -f /var/log/security-monitor/monitor.log 2>/dev/null || echo "No log file found"

status: ## Check application status
	@echo "📊 Application status..."
	curl -s http://localhost:8080/health || echo "Service not running"

# All-in-one commands
all: clean install lint test security sbom ## Run complete development pipeline

check: lint test ## Quick development check (lint + test)

release-check: ci-test sbom build scan-image ## Complete release validation