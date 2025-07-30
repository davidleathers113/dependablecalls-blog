# Blog Content Seeding Script

## Overview

The `seed-blog-content.ts` script populates your Supabase database with sample blog content including:
- Blog authors
- Categories
- Tags  
- Blog posts with sanitized content
- Featured images (if provided)

## Prerequisites

1. **Environment Variables**
   ```bash
   VITE_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Database Setup**
   - Ensure all blog migrations have been run
   - The content sanitization trigger should be active
   - The blog-images storage bucket should exist

## Usage

```bash
# Install dependencies
npm install

# Run the seeding script
npm run seed:blog-content
```

## Features

### Automatic Content Sanitization
All blog post content is automatically sanitized by the database trigger, removing:
- Script tags
- Dangerous HTML attributes
- Invalid HTML structures

### Image Handling
- Uploads featured images to the `blog-images` storage bucket
- Creates signed URLs valid for 1 year
- Organizes images by post ID: `posts/{post_id}/featured.jpg`

### Data Sources
1. **Built-in Sample Posts**: 5 high-quality blog posts included in the script
2. **JSON File**: Additional posts from `data/blog-posts.json` (optional)

## Sample Data Structure

### Blog Post JSON Format
```json
{
  "title": "Post Title",
  "subtitle": "Optional subtitle",
  "content": "Markdown content",
  "excerpt": "Short description",
  "author_email": "admin@dependablecalls.com",
  "categories": ["category-slug-1", "category-slug-2"],
  "tags": ["tag-slug-1", "tag-slug-2"],
  "featured_image": "image-filename.jpg",
  "status": "published",
  "published_at": "2024-01-20T10:00:00Z"
}
```

### Adding Custom Content

1. Create `data/blog-posts.json` with your posts
2. Add images to `data/images/` directory
3. Run the seed script

## Included Sample Content

- **Categories**: Industry News, Best Practices, Case Studies, Product Updates, Marketing Tips
- **Tags**: Call Tracking, Lead Generation, Analytics, Fraud Prevention, ROI Optimization, etc.
- **Posts**: 
  - Welcome announcement
  - Fraud prevention strategies
  - Real-time analytics guide
  - Mobile optimization tips
  - API integration tutorial

## Troubleshooting

### Missing Environment Variables
```
Error: Missing required environment variables
```
Ensure both `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.

### Storage Bucket Errors
```
Error: Failed to upload image
```
Verify the `blog-images` bucket exists and has proper permissions.

### Duplicate Content
The script checks for existing content by slug/email to prevent duplicates.

## Notes

- Content is automatically sanitized by database triggers
- Images are stored with signed URLs for security
- The script is idempotent - safe to run multiple times
- Authors must have unique email addresses
- Categories and tags must have unique slugs