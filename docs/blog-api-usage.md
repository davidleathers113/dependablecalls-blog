# Blog API Documentation

The Blog API provides public read-only access to blog content with built-in rate limiting and Supabase Row Level Security (RLS).

## Base URL

```
https://yourdomain.com/api/blog/
```

## Rate Limiting

- **Anonymous users**: 30 requests per minute per IP address
- **Authenticated users**: Higher limits based on user role (when authentication is implemented)

## Endpoints

### Get All Posts

```http
GET /api/blog/posts
```

Query Parameters:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page, max 50 (default: 10)
- `search` (string): Full-text search query
- `category` (string): Filter by category slug
- `tag` (string): Filter by tag slug
- `author` (string): Filter by author ID
- `startDate` (string): Filter posts after this date (ISO 8601)
- `endDate` (string): Filter posts before this date (ISO 8601)
- `sortBy` (string): Sort field - published_at, created_at, updated_at, title, view_count (default: published_at)
- `sortOrder` (string): Sort order - asc, desc (default: desc)
- `includeAuthor` (boolean): Include author data (default: true)
- `includeCategories` (boolean): Include categories (default: true)
- `includeTags` (boolean): Include tags (default: true)

Example:
```bash
curl "https://yourdomain.com/api/blog/posts?page=1&limit=10&category=technology&sortBy=view_count&sortOrder=desc"
```

Response:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Getting Started with Supabase",
      "slug": "getting-started-with-supabase",
      "excerpt": "Learn how to build...",
      "content": "...",
      "status": "published",
      "published_at": "2024-01-15T10:00:00Z",
      "view_count": 1234,
      "reading_time": 5,
      "author": {
        "id": "...",
        "name": "John Doe",
        "bio": "..."
      },
      "categories": [
        {
          "id": "...",
          "name": "Technology",
          "slug": "technology"
        }
      ],
      "tags": [
        {
          "id": "...",
          "name": "Supabase",
          "slug": "supabase"
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Get Single Post

```http
GET /api/blog/posts/:slug
```

Query Parameters:
- `includeAuthor` (boolean): Include author data (default: true)
- `includeCategories` (boolean): Include categories (default: true)
- `includeTags` (boolean): Include tags (default: true)
- `includeComments` (boolean): Include approved comments (default: false)

Example:
```bash
curl "https://yourdomain.com/api/blog/posts/getting-started-with-supabase?includeComments=true"
```

### Search Posts

```http
GET /api/blog/search?q=your+search+query
```

Query Parameters:
- `q` (string, required): Search query
- `limit` (number): Max results, max 50 (default: 10)

Example:
```bash
curl "https://yourdomain.com/api/blog/search?q=supabase+authentication&limit=5"
```

### Get All Categories

```http
GET /api/blog/categories
```

Example:
```bash
curl "https://yourdomain.com/api/blog/categories"
```

Response:
```json
{
  "categories": [
    {
      "id": "...",
      "name": "Technology",
      "slug": "technology",
      "description": "Tech articles and tutorials",
      "parent_id": null,
      "display_order": 1
    }
  ]
}
```

### Get Category by Slug

```http
GET /api/blog/categories/:slug
```

### Get All Tags

```http
GET /api/blog/tags
```

### Get Popular Tags

```http
GET /api/blog/tags?popular=true&limit=10
```

Response includes post count for each tag:
```json
{
  "tags": [
    {
      "id": "...",
      "name": "Supabase",
      "slug": "supabase",
      "count": 25
    }
  ]
}
```

### Get Tag by Slug

```http
GET /api/blog/tags/:slug
```

### Get Similar Posts

```http
GET /api/blog/similar/:postId
```

Query Parameters:
- `limit` (number): Max results, max 10 (default: 5)

Uses vector similarity search to find related posts.

### Get Blog Statistics

```http
GET /api/blog/statistics
```

Query Parameters:
- `authorId` (string): Filter statistics by author

Response:
```json
{
  "totalPosts": 42,
  "publishedPosts": 38,
  "draftPosts": 4,
  "totalViews": 125000,
  "totalComments": 890,
  "avgReadingTime": 6.5
}
```

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "details": {} // Only in development mode
}
```

Common status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets
- `X-RateLimit-RetryAfter`: Seconds until you can retry (only on 429)

## CORS

The API supports CORS for browser-based applications:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Security

- All requests use Supabase Row Level Security (RLS)
- Only published posts are returned for anonymous users
- Rate limiting prevents abuse
- Input validation and sanitization
- No write operations exposed publicly

## Example Usage

### JavaScript/TypeScript

```typescript
// Fetch recent posts
const response = await fetch('https://yourdomain.com/api/blog/posts?limit=5')
const { data, meta } = await response.json()

// Search posts
const searchResponse = await fetch('https://yourdomain.com/api/blog/search?q=supabase')
const { results } = await searchResponse.json()

// Get single post with comments
const postResponse = await fetch('https://yourdomain.com/api/blog/posts/my-post-slug?includeComments=true')
const post = await postResponse.json()
```

### React Query Example

```typescript
import { useQuery } from '@tanstack/react-query'

function useBlogPosts(page = 1, category?: string) {
  return useQuery({
    queryKey: ['blog-posts', page, category],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(category && { category })
      })
      
      const response = await fetch(`/api/blog/posts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch posts')
      
      return response.json()
    }
  })
}
```