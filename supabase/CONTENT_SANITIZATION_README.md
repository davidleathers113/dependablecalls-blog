# Blog Content Sanitization Implementation

## Overview

This implementation provides server-side HTML sanitization for blog posts and comments to prevent XSS (Cross-Site Scripting) attacks. The system uses Supabase Edge Functions with isomorphic-dompurify for robust, DOM-based sanitization.

## Architecture

### Components

1. **Edge Function** (`/supabase/functions/sanitize-html/`)
   - Uses isomorphic-dompurify for server-side HTML sanitization
   - Handles both Markdown and HTML content
   - Validates against known XSS attack patterns
   - Returns sanitized content with metadata

2. **PostgreSQL Functions**
   - `sanitize_html_content()` - Calls Edge Function via pg_net
   - `sanitize_html_fallback()` - Basic entity encoding fallback
   - `sanitize_blog_post_content()` - Trigger function for posts
   - `sanitize_blog_comment_content()` - Trigger function for comments

3. **Database Triggers**
   - BEFORE INSERT on blog_posts
   - BEFORE UPDATE on blog_posts (when content changes)
   - BEFORE INSERT on blog_comments
   - BEFORE UPDATE on blog_comments (when content changes)

4. **Protection Mechanisms**
   - Triggers prevent direct modification of `content_sanitized` columns
   - Sanitization failure prevents record insertion/update
   - Audit logging for monitoring and debugging

## Security Features

### Allowed HTML Tags

- Structural: `p`, `div`, `section`, `article`, `br`, `hr`
- Headings: `h1` through `h6`
- Text formatting: `em`, `strong`, `i`, `b`, `u`, `mark`, `small`
- Links: `a` (with restricted attributes)
- Lists: `ul`, `ol`, `li`, `dl`, `dt`, `dd`
- Media: `img`, `figure`, `figcaption`
- Tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`
- Code: `pre`, `code`, `kbd`, `samp`, `var`
- Quotes: `blockquote`, `q`, `cite`

### Allowed Attributes

- `a`: href, title, target, rel
- `img`: src, alt, title, width, height, loading
- `blockquote`/`q`: cite
- `code`/`pre`: class (for syntax highlighting)
- All elements: class, id

### Blocked Content

- All `<script>` tags
- Event handlers (onclick, onload, etc.)
- JavaScript protocols (javascript:, vbscript:, data:)
- Dangerous tags (iframe, object, embed, form)
- Style tags with JavaScript
- Meta refresh redirects

## Usage

### Automatic Sanitization

Content is automatically sanitized when:

1. Creating new blog posts
2. Updating blog post content
3. Creating new comments
4. Updating comment content

### Manual Sanitization

```sql
-- Sanitize Markdown content
SELECT sanitize_html_content('# Hello\n\n**Bold** text', 'markdown');

-- Sanitize HTML content
SELECT sanitize_html_content('<p>Hello <script>alert("XSS")</script></p>', 'html');

-- Use fallback sanitization
SELECT sanitize_html_fallback('<script>alert("XSS")</script>');
```

### Batch Processing

For existing content:

```sql
-- Run batch sanitization
SELECT batch_sanitize_existing_content();
```

## Monitoring

### Check Sanitization Status

```sql
-- View sanitization metrics
SELECT * FROM blog_sanitization_monitoring;

-- Find unsanitized content
SELECT id, title, substring(content, 1, 50) as content_preview
FROM blog_posts
WHERE content IS NOT NULL AND content_sanitized IS NULL;
```

### Audit Trail

```sql
-- View sanitization failures
SELECT * FROM audit_logs
WHERE action = 'sanitization_fallback'
ORDER BY created_at DESC;
```

## Testing

### Run Test Suite

```bash
psql $DATABASE_URL -f test_content_sanitization.sql
```

### Manual Testing

```sql
-- Test XSS prevention
INSERT INTO blog_posts (
  slug, title, content, author_id, status
) VALUES (
  'test-xss',
  'Test',
  '<script>alert("XSS")</script>Normal content',
  (SELECT id FROM blog_authors LIMIT 1),
  'draft'
);

-- Check result
SELECT content, content_sanitized
FROM blog_posts
WHERE slug = 'test-xss';
```

## Deployment

### 1. Deploy Edge Function

```bash
supabase functions deploy sanitize-html
```

### 2. Run Migration

```bash
psql $DATABASE_URL -f supabase/migrations/019_blog_content_sanitization.sql
```

### 3. Update Seed Data

```bash
psql $DATABASE_URL -f supabase/seed_blog_updated.sql
```

### 4. Verify Deployment

```bash
psql $DATABASE_URL -f test_content_sanitization.sql
```

## Configuration

### Environment Variables

The Edge Function requires:

- `SUPABASE_URL` - Automatically provided
- `SUPABASE_ANON_KEY` - Automatically provided
- `SUPABASE_SERVICE_ROLE_KEY` - For internal calls

### Database Settings

Required for pg_net calls:

```sql
-- Set in postgresql.conf or via SQL
ALTER DATABASE your_db SET app.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE your_db SET app.supabase_service_role_key = 'your-service-role-key';
```

## Error Handling

### Edge Function Failures

- Automatically falls back to basic HTML entity encoding
- Logs failure to audit_logs table
- Content is still saved (with basic sanitization)

### Validation Failures

- If sanitization removes >50% of content, insertion/update is rejected
- Error message indicates potential XSS attempt
- Transaction is rolled back

## Performance Considerations

1. **Edge Function Timeout**: 500ms timeout for sanitization
2. **Batch Processing**: Process existing content in batches of 100
3. **Caching**: Edge Function responses are not cached (security priority)
4. **Async Processing**: Consider queue-based sanitization for high volume

## Security Notes

1. **Never trust client-side sanitization** - Always sanitize server-side
2. **Regular updates** - Keep DOMPurify library updated
3. **Monitor audit logs** - Watch for sanitization failures
4. **Content Security Policy** - Implement CSP headers as additional defense
5. **Regular testing** - Test against new XSS vectors regularly

## Rollback Instructions

If needed, the migration can be rolled back:

```sql
-- See rollback instructions in 019_blog_content_sanitization.sql
```

Note: This only removes the sanitization logic, not the content_sanitized columns which were part of the original blog schema.

## Support

For issues or questions:

1. Check audit_logs for sanitization failures
2. Review Edge Function logs in Supabase dashboard
3. Run test suite to verify functionality
4. Contact security team for XSS concerns
