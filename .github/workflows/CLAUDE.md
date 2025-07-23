# GitHub Actions Workflows

# Workflow Structure
- `.github/workflows/ci.yml` - Continuous Integration
- `.github/workflows/deploy-staging.yml` - Staging deployment
- `.github/workflows/deploy-production.yml` - Production deployment
- `.github/workflows/security-scan.yml` - Security scanning
- `.github/workflows/database-migrations.yml` - Database management

# Continuous Integration
```yaml
# .github/workflows/ci.yml
name: Continuous Integration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '22.15.0'
  PNPM_VERSION: '9.15.0'

jobs:
  lint-and-typecheck:
    name: Lint and Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        run: npm install -g pnpm@${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint

      - name: Run TypeScript check
        run: pnpm type-check

      - name: Check formatting
        run: pnpm format:check

  test:
    name: Run Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: dce_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        run: npm install -g pnpm@${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm test:unit
        env:
          NODE_ENV: test
          DATABASE_TEST_URL: postgresql://postgres:postgres@localhost:5432/dce_test

      - name: Run integration tests
        run: pnpm test:integration
        env:
          NODE_ENV: test

      - name: Upload coverage reports
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        run: npm install -g pnpm@${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build application
        run: pnpm build
        env:
          NODE_ENV: production
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-files
          path: dist/
          retention-days: 7

  e2e-tests:
    name: End-to-End Tests
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        run: npm install -g pnpm@${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-files
          path: dist/

      - name: Start preview server
        run: pnpm preview &
        env:
          CI: true

      - name: Wait for server
        run: npx wait-on http://localhost:4173

      - name: Run Playwright tests
        run: pnpm test:e2e
        env:
          CI: true

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

# Staging Deployment
```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [develop]
  workflow_dispatch:

env:
  NODE_VERSION: '22.15.0'
  PNPM_VERSION: '9.15.0'

jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        run: npm install -g pnpm@${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run database migrations
        run: |
          echo "$SUPABASE_SERVICE_ROLE_KEY" | base64 -d > service-role-key.json
          pnpm supabase db push --db-url $STAGING_DATABASE_URL
        env:
          STAGING_DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Build application
        run: pnpm build
        env:
          NODE_ENV: production
          VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
          VITE_STRIPE_PUBLIC_KEY: ${{ secrets.STAGING_STRIPE_PUBLIC_KEY }}

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v3.0
        with:
          publish-dir: './dist'
          production-branch: develop
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Deploy from GitHub Actions"
          enable-pull-request-comment: false
          enable-commit-comment: true
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.STAGING_NETLIFY_SITE_ID }}

      - name: Run smoke tests
        run: pnpm test:smoke
        env:
          BASE_URL: ${{ steps.deploy.outputs.deploy-url }}

      - name: Notify deployment
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deployment ${{ job.status }}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

# Production Deployment
```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      confirm_production:
        description: 'Type "DEPLOY" to confirm production deployment'
        required: true
        default: ''

env:
  NODE_VERSION: '22.15.0'
  PNPM_VERSION: '9.15.0'

jobs:
  security-check:
    name: Security Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run security audit
        run: |
          npm audit --audit-level=high
          pnpm audit --audit-level=high

      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: security-check
    environment: production
    if: github.event.inputs.confirm_production == 'DEPLOY' || github.ref == 'refs/heads/main'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Verify production confirmation
        if: github.event_name == 'workflow_dispatch'
        run: |
          if [ "${{ github.event.inputs.confirm_production }}" != "DEPLOY" ]; then
            echo "Production deployment not confirmed. Exiting."
            exit 1
          fi

      - name: Install pnpm
        run: npm install -g pnpm@${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run full test suite
        run: pnpm test:all
        env:
          NODE_ENV: test

      - name: Backup production database
        run: |
          pg_dump $PRODUCTION_DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
        env:
          PRODUCTION_DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}

      - name: Run database migrations
        run: |
          pnpm supabase db push --db-url $PRODUCTION_DATABASE_URL
        env:
          PRODUCTION_DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}

      - name: Build application
        run: pnpm build
        env:
          NODE_ENV: production
          VITE_SUPABASE_URL: ${{ secrets.PRODUCTION_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.PRODUCTION_SUPABASE_ANON_KEY }}
          VITE_STRIPE_PUBLIC_KEY: ${{ secrets.PRODUCTION_STRIPE_PUBLIC_KEY }}

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v3.0
        with:
          publish-dir: './dist'
          production-branch: main
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Production deploy from GitHub Actions"
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.PRODUCTION_NETLIFY_SITE_ID }}

      - name: Run production health checks
        run: pnpm test:health
        env:
          BASE_URL: https://dependablecalls.com

      - name: Create GitHub release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.run_number }}
          release_name: Release v${{ github.run_number }}
          body: |
            Production deployment completed successfully.
            
            Changes in this release:
            ${{ github.event.head_commit.message }}
          draft: false
          prerelease: false

      - name: Notify production deployment
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment ${{ job.status }}'
          channel: '#deployments'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

# Security Scanning
```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  dependency-scan:
    name: Dependency Security Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run npm audit
        run: npm audit --audit-level=moderate

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  code-scan:
    name: Code Security Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript, typescript

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3

  secret-scan:
    name: Secret Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run TruffleHog
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
          extra_args: --debug --only-verified

  container-scan:
    name: Container Security Scan
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t dce-app:latest .

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'dce-app:latest'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

# Database Migration Workflow
```yaml
# .github/workflows/database-migrations.yml
name: Database Migrations

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      migration_direction:
        description: 'Migration direction'
        required: true
        default: 'up'
        type: choice
        options:
          - up
          - down
      confirm_production:
        description: 'Type "MIGRATE" to confirm production migration'
        required: false
        default: ''

jobs:
  migrate-database:
    name: Run Database Migration
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Verify production confirmation
        if: github.event.inputs.environment == 'production'
        run: |
          if [ "${{ github.event.inputs.confirm_production }}" != "MIGRATE" ]; then
            echo "Production migration not confirmed. Exiting."
            exit 1
          fi

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.15.0'

      - name: Install pnpm
        run: npm install -g pnpm@9.15.0

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Create database backup
        if: github.event.inputs.environment == 'production'
        run: |
          TIMESTAMP=$(date +%Y%m%d_%H%M%S)
          pg_dump $DATABASE_URL > "backup_${TIMESTAMP}.sql"
          echo "Backup created: backup_${TIMESTAMP}.sql"
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}

      - name: Run migrations (up)
        if: github.event.inputs.migration_direction == 'up'
        run: supabase db push
        env:
          SUPABASE_DB_URL: ${{ github.event.inputs.environment == 'production' && secrets.PRODUCTION_DATABASE_URL || secrets.STAGING_DATABASE_URL }}

      - name: Run migrations (down)
        if: github.event.inputs.migration_direction == 'down'
        run: |
          echo "Rolling back last migration..."
          # Custom rollback logic would go here
          supabase migration repair --status reverted
        env:
          SUPABASE_DB_URL: ${{ github.event.inputs.environment == 'production' && secrets.PRODUCTION_DATABASE_URL || secrets.STAGING_DATABASE_URL }}

      - name: Verify migration
        run: |
          supabase migration list
          pnpm test:migration
        env:
          DATABASE_URL: ${{ github.event.inputs.environment == 'production' && secrets.PRODUCTION_DATABASE_URL || secrets.STAGING_DATABASE_URL }}

      - name: Notify migration result
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Database migration (${{ github.event.inputs.migration_direction }}) on ${{ github.event.inputs.environment }}: ${{ job.status }}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

# Performance Testing
```yaml
# .github/workflows/performance.yml
name: Performance Testing

on:
  schedule:
    - cron: '0 4 * * 1' # Weekly on Monday at 4 AM
  workflow_dispatch:

jobs:
  lighthouse-audit:
    name: Lighthouse Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.15.0'

      - name: Install dependencies
        run: npm install -g @lhci/cli

      - name: Run Lighthouse CI
        run: lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

  load-testing:
    name: Load Testing
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Artillery load test
        run: |
          npm install -g artillery
          artillery run tests/load/api-load-test.yml

      - name: Upload load test results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: load-test-report.json
```

# Workflow Best Practices
- Use environment-specific secrets
- Implement manual approvals for production
- Create comprehensive test coverage
- Monitor deployment health
- Maintain rollback capabilities
- Log all deployment activities

# Security Considerations
- Scan for vulnerabilities before deployment
- Use least-privilege access tokens
- Encrypt sensitive data in transit
- Implement secret scanning
- Regular security audits

# Monitoring and Alerting
- Real-time deployment notifications
- Health check monitoring
- Performance regression alerts
- Security vulnerability notifications
- Database migration status updates

# CRITICAL RULES
- NO regex in workflow files
- NO hardcoded secrets in workflows
- ALWAYS require manual approval for production
- ALWAYS run security scans before deployment
- IMPLEMENT proper error handling
- TEST all workflow changes thoroughly
- ENSURE proper access controls
- MAINTAIN deployment rollback capability
- DOCUMENT all workflow processes
- MONITOR deployment metrics