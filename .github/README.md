# GitHub Actions CI/CD Pipeline

This directory contains the CI/CD pipeline configuration for the DCE platform.

## Workflows

### PR Validation (`pr-validation.yml`)

- Runs on every pull request
- Executes: linting, type checking, tests, build, and security scans
- Must pass before merging

### Production Deployment (`deploy-production.yml`)

- Triggered on push to `main` branch
- Deploys to production environment
- Includes health checks and Sentry release tracking

### Staging Deployment (`deploy-staging.yml`)

- Triggered on push to `develop` branch
- Deploys to staging environment
- Runs smoke tests after deployment

### Security Scanning (`security-scan.yml`)

- Runs on push, PR, and daily schedule
- Includes:
  - Dependency vulnerability scanning (npm audit, Snyk)
  - Static Application Security Testing (CodeQL)
  - Secret detection (TruffleHog)
  - License compliance checks

## Required Secrets

Configure these in GitHub repository settings:

### Netlify

- `NETLIFY_AUTH_TOKEN`: Netlify authentication token
- `NETLIFY_SITE_ID`: Production site ID
- `NETLIFY_STAGING_SITE_ID`: Staging site ID

### Supabase

- `VITE_SUPABASE_URL`: Production Supabase URL
- `VITE_SUPABASE_ANON_KEY`: Production anonymous key
- `VITE_STAGING_SUPABASE_URL`: Staging Supabase URL
- `VITE_STAGING_SUPABASE_ANON_KEY`: Staging anonymous key

### Stripe

- `VITE_STRIPE_PUBLISHABLE_KEY`: Production publishable key
- `VITE_STAGING_STRIPE_PUBLISHABLE_KEY`: Staging publishable key

### Monitoring

- `VITE_SENTRY_DSN`: Production Sentry DSN
- `VITE_STAGING_SENTRY_DSN`: Staging Sentry DSN
- `SENTRY_AUTH_TOKEN`: Sentry authentication token
- `SENTRY_ORG`: Sentry organization slug
- `SENTRY_PROJECT`: Sentry project slug

### Security

- `SNYK_TOKEN`: Snyk authentication token
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Local Development

### Pre-commit Hooks

The project uses husky and lint-staged for pre-commit validation:

- ESLint fixes and formatting
- Prettier formatting
- TypeScript type checking

To skip pre-commit hooks (not recommended):

```bash
git commit --no-verify
```

### Running Workflows Locally

Test workflows locally using [act](https://github.com/nektos/act):

```bash
act pull_request  # Test PR validation
act push         # Test deployment workflows
```
