# Blog System Quick Start Guide

Get the DCE blog system running in 5 minutes!

## Prerequisites

- Node.js v22+ installed
- Free Supabase account at [app.supabase.com](https://app.supabase.com)

## Quick Setup (3 Steps)

### 1. Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com) and create a new project
2. Wait for it to provision (~2 minutes)
3. Go to Settings → API and copy your credentials

### 2. Configure & Setup

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your Supabase credentials:
# VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
# VITE_SUPABASE_ANON_KEY=your_anon_key
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Run automated setup (migrations, storage, edge functions)
npm run setup:blog

# Seed initial blog content
npm run seed:blog-content
```

### 3. Start Development

```bash
# Start the dev server
npm run dev

# Visit http://localhost:5173/blog
```

## Verify Setup

Run the verification script to check everything is configured correctly:

```bash
npm run verify:blog
```

## Manual Setup Option

If you prefer manual setup or the automated script fails, see the detailed guide:
[docs/BLOG_SUPABASE_SETUP.md](docs/BLOG_SUPABASE_SETUP.md)

## Common Issues

### "Database operation failed"
Your Supabase credentials are missing or incorrect. Check your .env file.

### Blog pages show homepage
Clear browser cache and restart the dev server.

### Can't upload images
The storage bucket may not be created. Run `npm run setup:blog` again.

## Next Steps

- **Production deployment**: See [docs/BLOG_DEPLOYMENT_GUIDE.md](docs/BLOG_DEPLOYMENT_GUIDE.md)
- **Add authors**: Run `npm run setup:blog-authors`
- **Monitor uptime**: See [docs/monitoring-setup.md](docs/monitoring-setup.md)

## Support

- Check existing issues in the project
- Review logs with `supabase functions logs`
- Verify setup with `npm run verify:blog`