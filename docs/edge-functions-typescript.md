# Edge Functions TypeScript Integration

This document provides comprehensive guidance for using TypeScript with Netlify Edge Functions in the DCE Blog CMS.

## Overview

The DCE Blog CMS uses Netlify Edge Functions for server-side content processing, primarily for:

- **Content Sanitization**: Removing XSS vulnerabilities using isomorphic-dompurify
- **Content Validation**: Ensuring content meets security and format requirements
- **Webhook Processing**: Handling database triggers via pg_net
- **Cache Synchronization**: Managing content cache updates

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │───▶│  Edge Functions │───▶│   PostgreSQL    │
│                 │    │   (Deno Runtime)│    │   + pg_net      │
│ • Blog Editor   │    │                 │    │                 │
│ • Comment Form  │    │ • sanitize-     │    │ • Triggers      │
│ • Admin Panel   │    │   content       │    │ • Webhooks      │
└─────────────────┘    │ • validate-     │    │ • Real-time     │
                       │   content       │    │                 │
                       │ • process-      │    │                 │
                       │   webhook       │    │                 │
                       │ • sync-cache    │    │                 │
                       └─────────────────┘    └─────────────────┘
```

## Type Definitions

### Core Types

#### EdgeFunctionResponse
```typescript
interface EdgeFunctionResponse<T = unknown> {
  success: boolean
  data?: T
  error?: EdgeFunctionError
  metadata?: ResponseMetadata
}
```

#### EdgeFunctionError
```typescript
interface EdgeFunctionError {
  code: EdgeFunctionErrorCode
  message: string
  details?: unknown
  retryable: boolean
  statusCode: number
}
```

### Content Sanitization

#### SanitizeContentRequest
```typescript
interface SanitizeContentRequest {
  content: string
  options?: SanitizationOptions
  context?: SanitizationContext
}
```

#### SanitizeContentResponse
```typescript
interface SanitizeContentResponse {
  sanitizedContent: string
  metadata: SanitizationMetadata
  warnings?: SanitizationWarning[]
}
```

## Service Usage

### Basic Content Sanitization

```typescript
import { edgeFunctions } from '../services/edge-functions.service'

// Sanitize blog post content
const sanitizePost = async (content: string, userId: string) => {
  const response = await edgeFunctions.sanitizeContent({
    content,
    options: {
      allowedTags: ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      allowedAttributes: {
        'a': ['href', 'title'],
        'img': ['src', 'alt', 'width', 'height']
      },
      allowedProtocols: ['http', 'https'],
      removeEmptyTags: true,
      maxLength: 50000
    },
    context: {
      contentType: 'blog_post',
      userId,
      userRole: 'author'
    }
  })

  if (!response.success) {
    throw new Error(`Sanitization failed: ${response.error?.message}`)
  }

  return response.data
}
```

### Content Validation

```typescript
// Validate comment content
const validateComment = async (content: string) => {
  const response = await edgeFunctions.validateContent(content, 'comment')
  
  if (!response.success) {
    throw new Error(`Validation failed: ${response.error?.message}`)
  }

  if (!response.data?.isValid) {
    const errors = response.data.errors.map(err => err.message).join(', ')
    throw new Error(`Content validation failed: ${errors}`)
  }

  return response.data
}
```

### Batch Processing

```typescript
// Sanitize multiple pieces of content
const sanitizeMultipleContents = async (contents: string[]) => {
  const requests = contents.map(content => ({
    content,
    options: {
      allowedTags: ['p', 'br', 'strong', 'em'],
      removeEmptyTags: true
    },
    context: {
      contentType: 'comment' as const
    }
  }))

  const response = await edgeFunctions.batchSanitizeContent(requests)
  
  if (!response.success) {
    throw new Error(`Batch sanitization failed: ${response.error?.message}`)
  }

  return response.data
}
```

## Error Handling

### Retry Logic

The service automatically retries failed requests based on configuration:

```typescript
const service = new EdgeFunctionsService({
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: [
      EdgeFunctionErrorCode.TIMEOUT,
      EdgeFunctionErrorCode.NETWORK_ERROR,
      EdgeFunctionErrorCode.RATE_LIMITED
    ]
  }
})
```

### Error Types

```typescript
// Handle different error types
const handleSanitizationError = (error: EdgeFunctionError) => {
  switch (error.code) {
    case EdgeFunctionErrorCode.RATE_LIMITED:
      // Wait and retry
      const retryAfter = error.details?.retryAfter || 60
      setTimeout(() => {
        // Retry the request
      }, retryAfter * 1000)
      break
      
    case EdgeFunctionErrorCode.SANITIZATION_FAILED:
      // Content is malformed, reject
      throw new Error('Content contains malicious code')
      
    case EdgeFunctionErrorCode.TIMEOUT:
      // Retry with exponential backoff
      if (error.retryable) {
        // Handled automatically by service
      }
      break
      
    default:
      throw new Error(`Unexpected error: ${error.message}`)
  }
}
```

## PostgreSQL Integration (pg_net)

### Database Triggers

```sql
-- Example trigger for content sanitization
CREATE OR REPLACE FUNCTION sanitize_blog_post()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function via pg_net
  PERFORM net.http_post(
    'https://your-site.netlify.app/.netlify/edge-functions/sanitize-content',
    json_build_object(
      'content', NEW.content,
      'options', json_build_object(
        'allowedTags', ARRAY['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3']
      ),
      'context', json_build_object(
        'contentType', 'blog_post',
        'userId', NEW.author_id
      )
    )::text,
    json_build_object(
      'Content-Type', 'application/json'
    )::jsonb
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sanitize_blog_post_trigger
  AFTER INSERT OR UPDATE ON blog_posts
  FOR EACH ROW
  WHEN (NEW.content IS DISTINCT FROM OLD.content)
  EXECUTE FUNCTION sanitize_blog_post();
```

### Webhook Processing

```typescript
// Handle webhook from pg_net
const processWebhook = async (payload: PgNetWebhookPayload) => {
  const response = await edgeFunctions.processWebhook(payload)
  
  if (!response.success) {
    console.error('Webhook processing failed:', response.error)
    return false
  }
  
  return response.data?.processed || false
}
```

## Testing

### Mock Service

```typescript
import { MockEdgeFunctionsService, MockDataGenerator } from '../types/edge-functions.mocks'

describe('Content Sanitization', () => {
  let mockService: MockEdgeFunctionsService

  beforeEach(() => {
    mockService = new MockEdgeFunctionsService()
  })

  test('should sanitize malicious content', async () => {
    // Configure mock response
    mockService.mockSanitizeSuccess({
      sanitizedContent: '<p>Clean content</p>',
      metadata: {
        originalLength: 100,
        sanitizedLength: 20,
        removedTags: ['script'],
        removedAttributes: ['onclick']
      }
    })

    // Test the sanitization
    const request = MockDataGenerator.sanitizeRequest({
      content: '<p>Hello <script>alert("xss")</script> world</p>'
    })

    const response = await mockService.sanitizeContent(request)
    
    expect(response.success).toBe(true)
    expect(response.data?.sanitizedContent).toBe('<p>Clean content</p>')
    expect(response.data?.metadata.removedTags).toContain('script')
  })

  test('should handle sanitization errors', async () => {
    mockService.mockSanitizeError({
      code: EdgeFunctionErrorCode.SANITIZATION_FAILED,
      message: 'Malformed HTML'
    })

    const request = MockDataGenerator.sanitizeRequest()
    const response = await mockService.sanitizeContent(request)
    
    expect(response.success).toBe(false)
    expect(response.error?.code).toBe(EdgeFunctionErrorCode.SANITIZATION_FAILED)
  })
})
```

### Integration Tests

```typescript
import { edgeFunctions } from '../services/edge-functions.service'

describe('Edge Function Integration', () => {
  test('should sanitize content end-to-end', async () => {
    const content = '<p>Hello <script>alert("test")</script> world</p>'
    
    const response = await edgeFunctions.sanitizeContent({
      content,
      options: {
        allowedTags: ['p'],
        removeEmptyTags: true
      },
      context: {
        contentType: 'blog_post',
        userId: 'test-user'
      }
    })

    expect(response.success).toBe(true)
    expect(response.data?.sanitizedContent).not.toContain('<script>')
    expect(response.data?.warnings).toBeDefined()
  })
})
```

## Best Practices

### 1. Content Sanitization

- **Always sanitize user-generated content** before storing in database
- **Use appropriate sanitization levels** based on user roles and content type
- **Configure allowed tags and attributes** based on your security requirements
- **Handle sanitization warnings** appropriately for your use case

### 2. Error Handling

- **Implement proper retry logic** for transient failures
- **Log errors with context** for debugging and monitoring
- **Provide meaningful error messages** to users
- **Handle rate limiting** gracefully with exponential backoff

### 3. Performance

- **Use batch operations** when processing multiple items
- **Configure appropriate timeouts** based on content size
- **Cache sanitized content** when possible
- **Monitor Edge Function performance** and optimize as needed

### 4. Security

- **Never trust client-side sanitization alone**
- **Validate content structure** in addition to sanitization
- **Use CSP headers** as an additional layer of protection
- **Regularly update sanitization rules** based on new threats

### 5. Testing

- **Mock Edge Functions** in unit tests for fast feedback
- **Test error scenarios** including timeouts and failures
- **Use integration tests** for critical sanitization paths
- **Validate sanitization effectiveness** with security-focused tests

## Configuration

### Environment Variables

```bash
# .env
NETLIFY_SITE_URL=https://your-site.netlify.app
EDGE_FUNCTION_TIMEOUT=30000
EDGE_FUNCTION_MAX_RETRIES=3
SANITIZATION_LEVEL=strict
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "node",
    "strict": true,
    "types": ["@netlify/edge-functions"]
  }
}
```

## Monitoring and Debugging

### Logging

```typescript
// Enable detailed logging
const service = new EdgeFunctionsService({
  headers: {
    'X-Debug-Level': 'verbose'
  }
})
```

### Metrics

Track important metrics:
- **Sanitization success rate**
- **Average processing time**
- **Error rate by type**
- **Content rejection rate**

### Alerts

Set up alerts for:
- **High error rates**
- **Slow response times**
- **Rate limit violations**
- **Content validation failures**

## Troubleshooting

### Common Issues

1. **Timeout Errors**: Increase timeout or reduce content size
2. **Rate Limiting**: Implement exponential backoff
3. **Memory Exceeded**: Split large content into smaller chunks
4. **Invalid Content**: Improve client-side validation

### Debug Commands

```bash
# Test Edge Function locally
npx netlify dev

# Check Edge Function logs
npx netlify functions:logs

# Validate Edge Function deployment
npx netlify deploy --build
```

## Additional Resources

- [Netlify Edge Functions Documentation](https://docs.netlify.com/edge-functions/overview/)
- [Deno Runtime Documentation](https://deno.land/manual)
- [isomorphic-dompurify Documentation](https://github.com/kkomelin/isomorphic-dompurify)
- [pg_net Extension Documentation](https://github.com/supabase/pg_net)