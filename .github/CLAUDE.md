# CI/CD & GitHub Workflows

# Workflow Structure
```
.github/
├── workflows/        # GitHub Actions workflows
├── templates/        # Issue and PR templates
├── CODEOWNERS       # Code review assignments
└── dependabot.yml   # Dependency updates
```

# Core Workflows

## Main Workflow (`ci.yml`)
```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:ci
      - run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Deployment Workflow (`deploy.yml`)
```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      
      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: './dist'
          production-branch: main
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: 'Deploy from GitHub Actions'
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

# Quality Gates
- All tests must pass (unit, integration, E2E)
- Code coverage must be ≥90%
- TypeScript compilation must succeed
- ESLint checks must pass
- No security vulnerabilities allowed

# Environment Variables
Store secrets in GitHub repository settings:
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

# Branch Protection Rules
```yaml
main:
  required_status_checks:
    - ci/test
    - ci/build
    - ci/security-scan
  require_pull_request_reviews: true
  required_reviewers: 2
  dismiss_stale_reviews: true
  require_code_owner_reviews: true
```

# Pull Request Template
```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No secrets in code
```

# Security Scanning
```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

# Performance Monitoring
```yaml
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v10
  with:
    configPath: './lighthouserc.js'
    uploadArtifacts: true
    temporaryPublicStorage: true
```

# Database Migration Workflow
```yaml
name: Database Migration
on:
  push:
    branches: [main]
    paths: ['supabase/migrations/**']

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: Apply migrations
        run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
```

# Code Quality Workflow
```yaml
name: Code Quality
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

# Dependency Updates
```yaml
# dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    reviewers:
      - "tech-team"
```

# CODEOWNERS File
```
# Global owners
* @tech-team

# Frontend specific
/src/components/ @frontend-team
/src/pages/ @frontend-team

# Backend specific
/supabase/ @backend-team
/src/integrations/ @backend-team

# DevOps specific
/.github/ @devops-team
/netlify.toml @devops-team
```

# Release Workflow
```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Create Release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

# Monitoring & Alerting
```yaml
- name: Slack Notification
  uses: 8398a7/action-slack@v3
  if: failure()
  with:
    status: ${{ job.status }}
    channel: '#deployments'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

# DCE-Specific Workflows

## Call Volume Monitoring
```yaml
name: Monitor Call Volume
on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Check Call Volume
        run: |
          # Script to check call volume and alert if anomalies
```

## Fraud Detection Updates
```yaml
name: Update Fraud Models
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  update-models:
    runs-on: ubuntu-latest
    steps:
      - name: Retrain fraud detection model
        run: |
          # Update fraud detection algorithms
```

# Environment Management
- **Development**: Auto-deploy on develop branch
- **Staging**: Auto-deploy on release branches
- **Production**: Manual deployment approval required

# Rollback Strategy
```yaml
- name: Rollback on Failure
  if: failure()
  run: |
    # Rollback to previous stable version
    netlify deploy --dir=dist --prod --alias=rollback
```

# Secrets Management
- Use GitHub Secrets for sensitive data
- Rotate secrets regularly
- Use different secrets per environment
- Never log secret values

# CRITICAL RULES
- NO secrets in workflow files or code
- ALL deployments must pass quality gates
- ALWAYS require code reviews for main branch
- NEVER deploy without testing
- ALWAYS use environment-specific configurations
- MONITOR deployment success/failure
- IMPLEMENT automated rollback on critical failures
- USE semantic versioning for releases
- SCAN for security vulnerabilities automatically