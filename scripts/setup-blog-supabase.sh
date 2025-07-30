#!/bin/bash

# Blog Supabase Setup Script
# This script helps automate the blog system setup after creating a Supabase project

set -e

echo "🚀 DCE Blog Supabase Setup Script"
echo "================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  Please edit .env and add your Supabase credentials:"
    echo "   - VITE_SUPABASE_URL"
    echo "   - VITE_SUPABASE_ANON_KEY"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Source environment variables
export $(grep -v '^#' .env | xargs)

# Check if required variables are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing required environment variables in .env"
    echo "Please ensure all Supabase credentials are set."
    exit 1
fi

echo "✅ Environment variables loaded"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "📦 Installing Supabase CLI..."
    npm install -g supabase
fi

# Extract project ID from URL
PROJECT_ID=$(echo $VITE_SUPABASE_URL | sed -n 's/https:\/\/\([^.]*\).supabase.co/\1/p')

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Could not extract project ID from VITE_SUPABASE_URL"
    echo "Please check your Supabase URL format."
    exit 1
fi

echo "🔗 Linking to Supabase project: $PROJECT_ID"
supabase link --project-ref $PROJECT_ID

echo ""
echo "🗄️  Running database migrations..."
echo "This will apply all blog migrations in order."
echo ""

# Define migrations in order
MIGRATIONS=(
    "018_blog_cms_tables.sql"
    "019_blog_content_sanitization.sql"
    "019_blog_infrastructure_fixes.sql"
    "020_blog_storage_quota_fixes.sql"
    "021_blog_rls_consolidation.sql"
    "022_blog_word_count_tsvector.sql"
    "023_blog_analytics_tables.sql"
    "024_blog_extensions_fix.sql"
    "024_blog_monitoring_infrastructure.sql"
    "025_blog_content_sanitization_trigger.sql"
    "026_blog_audit_retention.sql"
    "027_blog_api_performance_fixes.sql"
)

# Check if migrations exist
MISSING_MIGRATIONS=()
for migration in "${MIGRATIONS[@]}"; do
    if [ ! -f "supabase/migrations/$migration" ]; then
        MISSING_MIGRATIONS+=($migration)
    fi
done

if [ ${#MISSING_MIGRATIONS[@]} -gt 0 ]; then
    echo "⚠️  Missing migrations:"
    for migration in "${MISSING_MIGRATIONS[@]}"; do
        echo "   - $migration"
    done
    echo ""
    echo "Please ensure all migration files are present."
    exit 1
fi

# Run migrations
echo "Applying migrations..."
supabase db push

echo "✅ Migrations applied successfully"
echo ""

# Deploy edge functions
echo "🚀 Deploying edge functions..."
if [ -d "supabase/functions/sanitize-html" ]; then
    supabase functions deploy sanitize-html
    echo "✅ sanitize-html function deployed"
else
    echo "⚠️  sanitize-html function not found, skipping..."
fi

echo ""

# Generate TypeScript types
echo "📝 Generating TypeScript types..."
npm run generate:types
echo "✅ TypeScript types generated"
echo ""

# Create storage bucket using Supabase API
echo "🪣 Creating storage bucket..."
curl -X POST "$VITE_SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "blog-images",
    "name": "blog-images",
    "public": true,
    "file_size_limit": 10485760,
    "allowed_mime_types": ["image/jpeg", "image/png", "image/webp", "image/gif"]
  }' 2>/dev/null || echo "ℹ️  Storage bucket might already exist (this is OK)"

echo ""

# Final steps
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run seed:blog-content' to seed initial blog data"
echo "2. Start the development server with 'npm run dev'"
echo "3. Visit http://localhost:5173/blog to see your blog"
echo ""
echo "Optional:"
echo "- Run 'npm run setup:blog-authors' to create blog authors"
echo "- Configure monitoring (see docs/monitoring-setup.md)"
echo "- Set up production deployment (see docs/BLOG_DEPLOYMENT_GUIDE.md)"