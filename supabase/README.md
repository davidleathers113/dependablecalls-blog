# DCE Platform Supabase Backend Setup

This directory contains the complete Supabase backend implementation for the Dependable Call Exchange platform.

## 🏗️ Database Architecture

### Core Tables
- **users** - User accounts (extends auth.users)
- **suppliers** - Traffic providers
- **buyers** - Advertisers purchasing leads
- **campaigns** - Supplier traffic campaigns
- **buyer_campaigns** - Buyer purchasing criteria
- **calls** - Core call transaction records
- **tracking_numbers** - Phone numbers for call routing

### Supporting Tables
- **payouts** - Supplier payments
- **invoices** - Buyer billing
- **call_quality_scores** - Quality assessment
- **disputes** - Quality/billing disputes
- **campaign_stats** - Performance analytics
- **audit_logs** - System audit trail

## 🔐 Security Features

### Row Level Security (RLS)
- **Suppliers** can only access their own campaigns and calls
- **Buyers** can only access their campaigns and received calls
- **Admins** have broader access with role-based permissions
- **Audit logging** for all sensitive operations

### Data Protection
- All sensitive data encrypted at rest and in transit
- PII fields use field-level encryption where needed
- Comprehensive audit trail for compliance

## 📁 File Structure

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql      # Core database schema
│   ├── 002_security_policies.sql   # Row Level Security policies
│   ├── 003_functions.sql           # Business logic functions
│   ├── 004_triggers.sql            # Automated processes
│   └── 005_indexes.sql             # Performance indexes
├── functions/                      # Edge functions (to be added)
├── config.toml                     # Supabase configuration
├── seed.sql                        # Development test data
└── README.md                       # This file
```

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- Node.js 18+ 
- Supabase CLI installed (`npm i -g supabase`)

### Local Development Setup

1. **Start Supabase locally:**
   ```bash
   supabase start
   ```

2. **Apply migrations:**
   ```bash
   supabase db reset
   ```

3. **View local dashboard:**
   ```bash
   # API: http://localhost:54321
   # Studio: http://localhost:54323
   # Inbucket (emails): http://localhost:54324
   ```

4. **Generate TypeScript types:**
   ```bash
   supabase gen types typescript --local > ../src/types/database.ts
   ```

### Environment Setup

Copy `.env.local` values to your environment:

```bash
# For local development
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

## 📊 Database Functions

### Balance Calculations
- `calculate_supplier_balance(supplier_id)` - Get supplier available balance
- `calculate_buyer_balance(buyer_id)` - Get buyer remaining credit

### Quality Scoring
- `calculate_quality_score(duration, metadata)` - Score call quality (1-100)
- `detect_fraud_indicators(caller_data)` - Analyze fraud risk

### Campaign Matching  
- `find_matching_buyer_campaigns(campaign_id)` - Real-time call routing
- `calculate_call_billing(campaign_id, buyer_campaign_id)` - Billing amounts

### Analytics
- `process_hourly_stats()` - Aggregate campaign performance
- `get_campaign_performance(campaign_id, date_range)` - Performance summaries

## 🔧 Key Features

### Real-time Capabilities
- Live call updates via Supabase Realtime
- Campaign status changes
- Payment notifications
- System alerts

### Automated Processes
- Quality scoring on call completion
- Fraud detection and flagging
- Balance updates on transactions
- Hourly stats aggregation
- Audit logging for all changes

### Performance Optimizations
- Comprehensive indexing strategy
- Partial indexes for active records only
- JSONB indexes for metadata queries
- Full-text search capabilities

## 🧪 Test Data

The `seed.sql` file includes:
- Admin, supplier, and buyer test accounts
- Sample campaigns (insurance and legal verticals)
- Test calls with quality scores
- Invoice and payout examples
- Campaign performance statistics

### Test User Accounts
- **Admin**: admin@dce-platform.com
- **Supplier**: supplier@test.com (Test Traffic Co)
- **Buyer 1**: buyer@test.com (Insurance Plus LLC)
- **Buyer 2**: buyer2@test.com (Premium Legal Services)

## 🔍 Monitoring & Debugging

### Query Performance
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;
```

### Audit Trail Queries
```sql
-- User activity tracking
SELECT table_name, operation, created_at, new_data
FROM audit_logs
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC;

-- Table change history
SELECT operation, old_data, new_data, created_at
FROM audit_logs
WHERE table_name = 'campaigns' AND record_id = 'campaign-uuid'
ORDER BY created_at DESC;
```

## 🚢 Production Deployment

### Supabase Project Setup
1. Create new Supabase project
2. Configure custom domain (optional)
3. Set up database backups
4. Configure auth providers
5. Set environment variables

### Migration Deployment
```bash
# Link to remote project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Deploy edge functions
supabase functions deploy
```

### Environment Variables
```bash
# Production environment
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 🛡️ Security Checklist

- [ ] RLS enabled on all tables
- [ ] Proper role-based access policies
- [ ] Audit logging configured
- [ ] Rate limiting enabled
- [ ] API keys properly secured
- [ ] Database backups scheduled
- [ ] Monitoring alerts configured

## 🔧 Troubleshooting

### Common Issues

**Migration errors:**
```bash
# Reset local database
supabase db reset

# Check migration status
supabase migration list
```

**RLS policy issues:**
```sql
-- Test policy as specific user
SET ROLE authenticated;
SET request.jwt.claim.sub TO 'user-uuid';
SELECT * FROM campaigns; -- Should respect RLS
```

**Performance issues:**
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM calls 
WHERE campaign_id = 'uuid' 
ORDER BY started_at DESC;
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Real-time Subscriptions](https://supabase.com/docs/guides/realtime)

## 🤝 Contributing

When adding new features:
1. Create a new migration file
2. Update RLS policies if needed
3. Add appropriate indexes
4. Update seed data for testing
5. Add audit logging for sensitive operations
6. Document any new functions or procedures