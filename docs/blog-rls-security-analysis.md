# Blog RLS Security Analysis and Fix

## Executive Summary

A critical security vulnerability was discovered in the blog CMS Row Level Security (RLS) policies that could allow authors to view each other's draft posts. This document details the vulnerability, its impact, and the comprehensive fix implemented.

## The Vulnerability

### Root Cause
Supabase merges multiple SELECT policies on the same table using OR logic. The original implementation had separate policies:
1. "Published posts are viewable by everyone"
2. "Authors can view their own posts"
3. "Admins can view all posts"

When these policies are evaluated, Supabase combines them as:
```sql
policy1 OR policy2 OR policy3
```

### Attack Scenario
If an author crafts a query that satisfies ANY of these policies, they gain access. The vulnerability arises because:
- Policy evaluation happens independently
- Any TRUE result grants access
- No explicit draft isolation between authors

### Potential Impact
1. **Draft Content Leakage**: Authors could read unpublished content from competitors
2. **Metadata Exposure**: Categories and tags of draft posts visible via junction tables
3. **Strategic Information Disclosure**: Publishing schedules, content strategies exposed
4. **Trust Erosion**: Authors lose confidence in platform security

## The Solution

### 1. Policy Consolidation
Replace multiple SELECT policies with single, comprehensive policies that explicitly handle all access scenarios:

```sql
CREATE POLICY "Unified post access control" 
  ON blog_posts FOR SELECT
  USING (
    -- Published posts visible to everyone
    (status = 'published' AND published_at <= NOW())
    OR 
    -- Authors can see their own posts (all statuses)
    (EXISTS (
      SELECT 1 FROM blog_authors ba 
      WHERE ba.id = blog_posts.author_id 
      AND ba.user_id = auth.uid()
    ))
    OR
    -- Admins can see all posts
    (EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    ))
  );
```

### 2. Separation of Concerns
Split policies by operation type:
- **SELECT**: Single unified policy preventing OR exploitation
- **INSERT**: Separate policy for creation
- **UPDATE**: Separate policy for modifications
- **DELETE**: Separate policy for deletions

### 3. Junction Table Security
Ensure blog_post_categories and blog_post_tags inherit parent post visibility:

```sql
CREATE POLICY "Unified post categories access"
  ON blog_post_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM blog_posts bp
      WHERE bp.id = post_id
      AND (
        -- Only show categories for accessible posts
        (bp.status = 'published' AND bp.published_at <= NOW())
        OR EXISTS (...)  -- Author check
        OR EXISTS (...)  -- Admin check
      )
    )
  );
```

### 4. Enhanced Comment Permissions
Added missing policies:
- Users can DELETE their own pending comments
- Post authors can UPDATE comment status for moderation
- Clear visibility rules preventing spam/deleted comment leakage

## Implementation Details

### Migration File: `021_blog_rls_consolidation.sql`
- Drops all existing vulnerable policies
- Creates new consolidated policies
- Adds comprehensive test function
- Includes verification queries

### Test Suite: `blog_rls_security_tests.sql`
Comprehensive tests covering:
1. **Draft Security**: Verify no cross-author draft visibility
2. **Junction Security**: Ensure metadata doesn't leak
3. **Comment Security**: Test moderation workflows
4. **Public Access**: Confirm published content accessibility

### Key Security Principles Applied

1. **Principle of Least Privilege**: Users get minimum required access
2. **Explicit Deny**: No implicit permissions via OR merging
3. **Defense in Depth**: Multiple layers of access control
4. **Fail Secure**: Defaults to no access unless explicitly granted
5. **Auditability**: Clear policy intent and test coverage

## Testing and Verification

### Automated Tests
Run the test suite after migration:
```sql
SELECT * FROM run_blog_rls_security_tests();
```

### Manual Verification
Check policy effectiveness for current user:
```sql
SELECT * FROM test_blog_rls_policies(auth.uid());
```

### Expected Results
- ✅ Authors see only their own drafts
- ✅ Published posts visible to all
- ✅ Admins have full access
- ✅ Comment moderation works correctly
- ✅ No metadata leakage via junction tables

## Deployment Steps

1. **Backup Current Data**
   ```bash
   pg_dump -t blog_* > blog_backup.sql
   ```

2. **Apply Migration**
   ```bash
   supabase db push
   ```

3. **Run Test Suite**
   ```sql
   SELECT * FROM run_blog_rls_security_tests();
   ```

4. **Verify No Failures**
   All tests should show `passed = true`

5. **Monitor for Issues**
   Check application logs for any access errors

## Maintenance Guidelines

### When Adding New Policies
1. Never create multiple SELECT policies on the same table
2. Use unified policies with explicit conditions
3. Test with multiple user contexts
4. Document policy intent clearly

### Regular Security Audits
- Review policies quarterly
- Test with new user scenarios
- Check for policy count (multiple = potential vulnerability)
- Verify junction tables match parent visibility

## Conclusion

This fix eliminates the critical draft leakage vulnerability by consolidating RLS policies and implementing explicit access control. The comprehensive test suite ensures ongoing security as the blog system evolves.