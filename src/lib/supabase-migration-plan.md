# Supabase Import Migration Plan - Phase 3

## Analysis Summary

After analyzing all files that import from '@supabase/supabase-js', here are the findings:

### Files Already Migrated ✅
1. **src/hooks/useRealTimeCallUpdates.ts** - Uses optimized imports from lib/supabase-optimized
2. **src/hooks/useRealTimeStats.ts** - Uses optimized imports from lib/supabase-optimized
3. **src/store/authStore.ts** - Partially uses optimized imports (signInWithOtp, signUp)

### Files with Type-Only Imports (No Migration Needed) ✅
1. **src/hooks/useRealtimeSubscription.ts** - Only imports types (RealtimeChannel, RealtimePostgresChangesPayload)
2. **src/lib/auth-cookies.ts** - Only imports type (Session)
3. **src/types/auth.ts** - Only imports type (User as SupabaseUser)
4. **src/services/websocket/WebSocketService.ts** - Only imports type (RealtimeChannel)

### Files That Need Migration ❌
1. **src/lib/auth-middleware.ts**
   - Direct import: `createClient, type SupabaseClient`
   - Creates its own client instance
   - Needs: Use the singleton client from lib/supabase-optimized

2. **src/api/routes/admin.ts**
   - Direct import: `createClient`
   - Creates its own client instance
   - Needs: Use the singleton client from lib/supabase-optimized

3. **src/api/routes/network.ts**
   - Direct import: `createClient`
   - Creates its own client instance
   - Needs: Use the singleton client from lib/supabase-optimized

4. **src/api/routes/supplier.ts**
   - Direct import: `createClient`
   - Creates its own client instance
   - Needs: Use the singleton client from lib/supabase-optimized

5. **src/api/routes/buyer.ts**
   - Direct import: `createClient`
   - Creates its own client instance
   - Needs: Use the singleton client from lib/supabase-optimized

## Migration Strategy

### High Priority (Multiple Client Instances)
All API route files are creating their own Supabase client instances, which is inefficient and increases bundle size. They should use the singleton client from our optimized module.

### Migration Steps

1. **Update API Route Files** (admin.ts, network.ts, supplier.ts, buyer.ts)
   ```typescript
   // Before:
   import { createClient } from '@supabase/supabase-js';
   const supabase = createClient<Database>(url, key);
   
   // After:
   import { supabase } from '../../lib/supabase-optimized';
   ```

2. **Update auth-middleware.ts**
   ```typescript
   // Before:
   import { createClient, type SupabaseClient } from '@supabase/supabase-js'
   const supabase = createClient<Database>(url, key)
   
   // After:
   import { supabase } from '../lib/supabase-optimized'
   import type { SupabaseClient } from '@supabase/supabase-js' // Keep type import
   ```

### Files That Can Stay As-Is
- All files that only import types don't need changes
- Files already using optimized imports are good

### Expected Benefits
- Eliminate 5 duplicate Supabase client instances
- Reduce bundle size by ~200KB (estimated)
- Improve initialization performance
- Centralized client configuration

### Risk Assessment
- **Low Risk**: All changes involve replacing client creation with singleton usage
- **Testing Required**: Ensure API routes still function correctly with shared client
- **No Breaking Changes**: The client interface remains the same

## Next Steps
1. Migrate auth-middleware.ts first (core functionality)
2. Migrate API route files one by one
3. Test each migration thoroughly
4. Monitor bundle size reduction