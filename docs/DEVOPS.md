# DevOps & Infrastructure Guide

## Overview

This guide covers the complete DevOps infrastructure for the DCE platform, including CI/CD, monitoring, deployment, and incident response procedures.

## Table of Contents

1. [CI/CD Pipeline](#cicd-pipeline)
2. [Deployment](#deployment)
3. [Monitoring & Alerting](#monitoring--alerting)
4. [Database Operations](#database-operations)
5. [Incident Response](#incident-response)
6. [Performance Optimization](#performance-optimization)
7. [Security](#security)
8. [Disaster Recovery](#disaster-recovery)

## CI/CD Pipeline

### GitHub Actions Workflows

#### PR Validation (`pr-validation.yml`)
- **Triggers**: Pull requests to main/develop
- **Jobs**: Lint, type check, test, build, security scan
- **Required to pass before merge**

#### Deployment Workflows
- **Production** (`deploy-production.yml`): Auto-deploys main branch
- **Staging** (`deploy-staging.yml`): Auto-deploys develop branch
- **Emergency Rollback** (`emergency-rollback.yml`): Manual trigger for quick rollback

#### Automated Tasks
- **Database Backup** (`database-backup.yml`): Daily at 2 AM UTC
- **Security Scanning** (`security-scan.yml`): Daily vulnerability checks
- **Uptime Monitoring** (`uptime-monitoring.yml`): Every 5 minutes

### Pre-commit Hooks

```bash
# Automatically runs on git commit:
- ESLint with auto-fix
- Prettier formatting
- TypeScript type checking

# Skip hooks (emergency only):
git commit --no-verify
```

## Deployment

### Docker Deployment

```bash
# Build production image
docker build -t dce-website:latest .

# Run with Docker Compose
docker-compose up -d

# Development with hot reload
docker-compose up app-dev
```

### Manual Deployment

```bash
# Deploy to production
npm run build
netlify deploy --prod

# Deploy to staging
npm run build
netlify deploy --alias staging
```

### Rollback Procedures

```bash
# Emergency rollback
./scripts/rollback.sh

# Rollback with specific deployment ID
ENVIRONMENT=production ./scripts/rollback.sh <deployment-id>
```

## Monitoring & Alerting

### Application Performance Monitoring (APM)

The platform includes comprehensive APM tracking:

- **Web Vitals**: LCP, FID, CLS, INP
- **Resource Timing**: Track slow-loading resources
- **API Performance**: Automatic tracking of all API calls
- **Component Performance**: Measure render times
- **Memory Usage**: Track JS heap usage

Access metrics:
- Development: Open DevTools console
- Production: Check Sentry Performance dashboard

### Health Checks

Health endpoints:
- `/health` - Overall system health
- `/api/health` - API health check

Health check includes:
- Supabase connectivity
- Stripe.js loading
- Sentry initialization
- API responsiveness

### Log Aggregation

```typescript
// Application logging
import { logger } from '@/lib/logger'

// Log levels
logger.debug('Debug message')
logger.info('Info message')
logger.warn('Warning message')
logger.error('Error message', error)
logger.fatal('Fatal error', error)

// Structured logging
logger.logApiCall(endpoint, method, status, duration)
logger.logUserAction(action, metadata)
logger.logPerformance(metric, value)
logger.logSecurityEvent(event, severity)
```

### Uptime Monitoring

- **Production**: Checked every 5 minutes
- **Staging**: Checked every 15 minutes
- **Alerts**: Slack, PagerDuty, GitHub Issues
- **SLA Target**: 99.9% uptime

### Status Page

Access the status page at `/status` to view:
- Current system health
- Service status
- Response times
- Recent incidents
- Uptime metrics

## Database Operations

### Automated Backups

```bash
# Manual backup
./scripts/backup/supabase-backup.sh

# Restore from backup
./scripts/backup/supabase-restore.sh [backup-name]

# List available backups
aws s3 ls s3://${BACKUP_S3_BUCKET}/database-backups/
```

### Backup Schedule
- **Production**: Daily at 2 AM UTC, 7-day retention
- **Staging**: Daily at 2 AM UTC, 3-day retention
- **Storage**: AWS S3 with lifecycle policies

### Database Migrations

```bash
# Create migration
supabase migration new <migration-name>

# Apply migrations
supabase db push

# Reset database (development only)
supabase db reset
```

## Incident Response

### Severity Levels

1. **P1 (Critical)**: Complete outage, data loss risk
   - Response time: < 15 minutes
   - Escalation: Immediate
   
2. **P2 (High)**: Major functionality broken
   - Response time: < 1 hour
   - Escalation: Within 30 minutes
   
3. **P3 (Medium)**: Minor functionality affected
   - Response time: < 4 hours
   - Escalation: Next business day
   
4. **P4 (Low)**: Cosmetic issues
   - Response time: Next business day
   - Escalation: As needed

### Response Procedures

1. **Identify**: Check monitoring dashboards
2. **Assess**: Determine severity and impact
3. **Communicate**: Update status page and notify team
4. **Mitigate**: Apply temporary fixes if needed
5. **Resolve**: Implement permanent solution
6. **Review**: Post-mortem within 48 hours

### Emergency Contacts

- **On-call Engineer**: Check PagerDuty
- **Escalation**: Team lead → CTO → CEO
- **External**: Supabase support, Stripe support

## Performance Optimization

### Frontend Optimization

- **Code Splitting**: Automatic with Vite
- **Lazy Loading**: Components and routes
- **Image Optimization**: WebP with fallbacks
- **Caching**: Service worker + CDN

### Backend Optimization

- **Database Indexes**: See `migrations/005_indexes.sql`
- **Query Optimization**: Use Supabase query planner
- **Connection Pooling**: Automatic with Supabase
- **Rate Limiting**: Implemented at edge

### Monitoring Performance

```bash
# Check bundle size
npm run build -- --report

# Analyze performance
lighthouse https://dependablecalls.com

# Load testing
k6 run scripts/load-test.js
```

## Security

### Security Scanning

- **Dependencies**: Daily npm audit + Snyk
- **Code**: CodeQL static analysis
- **Secrets**: TruffleHog scanning
- **Infrastructure**: SSL/TLS checks

### Security Headers

Configured in `netlify.toml`:
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security

### Access Control

- **GitHub**: Branch protection + required reviews
- **Netlify**: Environment-specific deploy keys
- **Supabase**: Row-level security policies
- **Monitoring**: Read-only dashboard access

## Disaster Recovery

### Backup Strategy

- **Database**: Daily automated backups to S3
- **Code**: Git repository (GitHub)
- **Configurations**: Stored in repository
- **Secrets**: Backed up in password manager

### Recovery Procedures

1. **Data Loss**: Restore from latest backup
2. **Service Outage**: Failover to backup region
3. **Security Breach**: Rotate all credentials
4. **Complete Failure**: Rebuild from infrastructure code

### RTO/RPO Targets

- **RTO** (Recovery Time Objective): < 4 hours
- **RPO** (Recovery Point Objective): < 24 hours

## Runbooks

### Common Issues

#### High Memory Usage
```bash
# Check memory usage
docker stats

# Restart container
docker-compose restart app

# Clear caches
redis-cli FLUSHALL
```

#### Slow API Response
```bash
# Check database connections
SELECT count(*) FROM pg_stat_activity;

# Check slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

# Restart services
docker-compose restart
```

#### Failed Deployments
```bash
# Check deployment logs
netlify deploy --list

# Rollback to previous
./scripts/rollback.sh

# Clear build cache
netlify build --clear-cache
```

## Monitoring Dashboards

### Sentry
- Errors: https://sentry.io/organizations/[org]/issues/
- Performance: https://sentry.io/organizations/[org]/performance/
- Releases: https://sentry.io/organizations/[org]/releases/

### Netlify
- Deployments: https://app.netlify.com/sites/[site]/deploys
- Analytics: https://app.netlify.com/sites/[site]/analytics
- Functions: https://app.netlify.com/sites/[site]/functions

### Supabase
- Database: https://app.supabase.com/project/[id]/database
- Auth: https://app.supabase.com/project/[id]/auth
- Logs: https://app.supabase.com/project/[id]/logs

## Maintenance Windows

- **Scheduled**: Sundays 2-4 AM UTC
- **Notification**: 48 hours in advance
- **Emergency**: As needed with immediate notification

## Contact Information

- **DevOps Team**: devops@dependablecalls.com
- **Emergency**: +1-XXX-XXX-XXXX
- **Slack**: #devops-alerts
- **PagerDuty**: https://dependablecalls.pagerduty.com