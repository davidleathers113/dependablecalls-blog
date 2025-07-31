# Development Configuration Guide

This guide explains how to set up the DCE platform for development, including when and how to use mock data.

## Quick Start

1. **Copy environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

## Environment Configuration

### Mock Data Mode (Recommended for Development)

When developing without a full Supabase database schema, use mock data mode:

```env
# Enable mock data for DCE platform components
VITE_USE_MOCK_DATA=true
VITE_MOCK_SUPPLIER_ID=supplier-demo-1
VITE_MOCK_BUYER_ID=buyer-demo-1
```

**What this enables:**
- Dashboard components show realistic mock data
- Campaign tables display sample campaigns
- Call tracking shows simulated call records
- No database queries are made to missing platform tables

### Real Database Mode

When you have a complete Supabase database with all DCE platform tables:

```env
# Disable mock data to use real database
VITE_USE_MOCK_DATA=false
```

**Requirements:**
- Complete Supabase database schema with all DCE tables
- Valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Proper database permissions configured

## Development Features

### Automatic Mock Detection

The application automatically detects when to use mock data based on:
- `import.meta.env.DEV` (Vite development mode)
- `VITE_USE_MOCK_DATA` environment variable

### Mock Data Services

Mock data is provided by `src/lib/mock-data-service.ts` which includes:
- **Supplier stats**: Call volumes, conversion rates, quality scores
- **Recent calls**: Sample call records with realistic data
- **Active campaigns**: Demo campaigns with performance metrics

### Console Logging

In development mode, mock services log their usage:
```
🔧 QuickStatsBar using mock data: fetchSupplierStats
🔧 RecentCallsList using mock data: fetchRecentCalls
🔧 ActiveCampaignsTable using mock data: fetchActiveCampaigns
```

## Database Schema Requirements

### Blog Tables (Available)
- `blog_posts` - Blog content
- `blog_categories` - Post categories
- `blog_authors` - Content authors
- `blog_comments` - User comments
- `blog_tags` - Content tags

### DCE Platform Tables (Mocked)
- `users` - Platform users
- `suppliers` - Traffic providers
- `buyers` - Lead purchasers  
- `campaigns` - Marketing campaigns
- `calls` - Call tracking records
- `payments` - Transaction records

## Type System

### Database Types

The application uses a layered type system:
- `database.generated.ts` - Auto-generated from Supabase (blog tables only)
- `database-mock-types.ts` - Mock types for missing platform tables
- `database-extended.ts` - Combines real and mock types

### Mock Type Updates

When adding new platform features, update mock types in:
1. Add interface to `database-mock-types.ts`
2. Export from `database-extended.ts`
3. Update mock service with sample data

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run type checking
npm run build

# Run linting
npm run lint
```

### Build Validation
Before committing, ensure the build passes:
```bash
npm run build
```

## Deployment

### Staging Deployment
```bash
# Deploy to Netlify staging
npm run build
# Deploy dist/ to staging environment
```

### Production Deployment
Ensure `VITE_USE_MOCK_DATA=false` in production environment.

## Troubleshooting

### TypeScript Errors
- **Database type issues**: Check `database-extended.ts` imports
- **Missing tables**: Verify mock types are properly defined
- **Component errors**: Ensure components use extended database types

### Mock Data Issues
- **No data showing**: Check console for mock service logs
- **Wrong data format**: Update mock service return types
- **Real DB errors**: Set `VITE_USE_MOCK_DATA=true` temporarily

### Common Development Setup
```env
# Typical development .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_USE_MOCK_DATA=true
VITE_APP_ENV=development
```

## Architecture Notes

This is a **hybrid approach** that allows development of the DCE platform without requiring a complete database schema. The mock data service provides realistic data for components while the type system ensures TypeScript compatibility.

When the full database schema is available, simply set `VITE_USE_MOCK_DATA=false` and the application will seamlessly switch to real data.