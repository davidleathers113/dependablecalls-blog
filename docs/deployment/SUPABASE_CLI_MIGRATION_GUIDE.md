# Supabase CLI Migration Guide - 2024 Best Practices

Based on comprehensive research of Supabase CLI 2024 documentation and troubleshooting.

## Current Status
- Project ID: `orrasduancqrevnqiiok`
- Combined migration file: `supabase/migrations/combined-blog-migrations.sql`
- Blog migrations: 018-027 (12 total migrations)

## Method 1: Modern CLI Authentication (Recommended)

### Step 1: Update and Re-authenticate
```bash
# Update CLI to latest version
npm install -g @supabase/supabase-cli@latest

# Check version (should be 1.46.4+)
supabase --version

# Fresh authentication (2024 automatic method)
supabase logout
supabase login
# This opens browser for automatic authentication - no manual token needed
```

### Step 2: Proper Project Linking
```bash
# Initialize if not already done
supabase init

# Link to your project
supabase link --project-ref orrasduancqrevnqiiok


# Pull existing remote schema to avoid conflicts
supabase db pull
```

### Step 3: Apply Migrations
```bash
# Dry run to see what will be applied
supabase db push --dry-run

# Apply migrations to remote
supabase db push

# Verify migration status
supabase migration list
```

## Method 2: Environment Variable Authentication

If automatic login fails, use environment variable approach:

```bash
# Set your access token (get from https://supabase.com/dashboard/account/tokens)
export SUPABASE_ACCESS_TOKEN="sbp_28ce84db77d39236a5da89575e635de77157b9e2"

# Link and push without interactive login
supabase link --project-ref orrasduancqrevnqiiok
supabase db push
```

## Method 3: Individual Migration Files (If Combined Fails)

If the combined migration is too large, break it down:

```bash
# Create individual migrations from combined file
cd supabase/migrations

# Split combined file into smaller chunks
split -l 50 combined-blog-migrations.sql migration_part_

# Apply individually
supabase db push
```

## Common Issues and Solutions

### 1. "Password authentication failed for user postgres"
- **Cause**: Project recently restored or password issues
- **Solution**: Reset database password in Supabase Dashboard, wait 24-48 hours if recently restored

### 2. "SASL authentication failed"
- **Cause**: IP blocking or connection issues
- **Solution**: Check if IP is blocked in Database settings, try different connection method

### 3. "Invalid access token format"
- **Cause**: Wrong token format or expired token
- **Solution**: Use automatic login or generate new token from dashboard

### 4. CLI version incompatibility
- **Cause**: Using outdated CLI version
- **Solution**: Update to CLI v1.46.4+ or try downgrading to v1.112.0 if latest fails

## Production Deployment Best Practices

### 1. Backup Before Migration
```bash
# Create backup before applying migrations
supabase db dump --data-only > backup-$(date +%Y%m%d).sql
```

### 2. Staging Environment Testing
```bash
# Test in staging first
supabase link --project-ref your-staging-project-id
supabase db push --dry-run
supabase db push
```

### 3. Migration Validation
```bash
# Verify migration status
supabase migration list

# Check for errors
supabase db pull --dry-run
```

## Troubleshooting Connection Issues

### Debug Connection
```bash
# Test connection with verbose output
SUPABASE_DEBUG=true supabase db push --dry-run

# Check project status
supabase projects list
```

### Alternative Connection Methods
- Try IPv4 vs IPv6 connection
- Use direct connection string vs pooled
- Check SSL/TLS requirements

## Fallback: Manual SQL Execution

If CLI continues to fail, use the prepared manual approach:

1. Go to: https://supabase.com/dashboard/project/orrasduancqrevnqiiok/sql/new
2. Copy contents of: `supabase/migrations/combined-blog-migrations.sql`
3. Paste and execute in SQL editor

## Next Steps After Successful Migration

1. **Deploy Edge Function**:
   ```bash
   supabase functions deploy sanitize-html
   ```

2. **Seed Blog Content**:
   ```bash
   npm run seed:blog-content
   ```

3. **Verify Setup**:
   ```bash
   npm run verify:blog
   ```

## CLI Reference Commands

```bash
# Essential commands
supabase login                    # Authenticate
supabase link --project-ref ID    # Link project
supabase db pull                  # Pull remote schema
supabase db push                  # Apply migrations
supabase db push --dry-run        # Preview changes
supabase migration list           # Check status
supabase migration new NAME       # Create new migration
supabase db reset                 # Reset local DB
```

## Environment Configuration

Create `.env` file with required variables:
```bash
SUPABASE_ACCESS_TOKEN=sbp_your_token_here
VITE_SUPABASE_URL=https://orrasduancqrevnqiiok.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

This guide provides multiple pathways to successfully apply your blog migrations using the Supabase CLI with 2024 best practices.