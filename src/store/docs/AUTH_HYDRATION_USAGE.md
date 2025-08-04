# AuthHydrationGate Usage Guide

This document explains how to use the AuthHydrationGate component to fix auth UI flicker issues.

## The Problem

Without AuthHydrationGate, your app experiences a flicker pattern:

1. App loads with `loading: true`
2. Store hydrates with `skipHydration: true` (for security)
3. User briefly sees "not authenticated" UI
4. Auth state loads and UI updates to correct state

This creates a jarring user experience.

## The Solution

AuthHydrationGate prevents this flicker by showing a loading state until the auth store has fully hydrated.

## Basic Usage

### 1. Wrap Your App

```typescript
// src/App.tsx
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthHydrationGate } from './components/auth'
import AppLayout from './components/layout/AppLayout'
import Routes from './Routes'

function App() {
  return (
    <BrowserRouter>
      <AuthHydrationGate>
        <AppLayout>
          <Routes />
        </AppLayout>
      </AuthHydrationGate>
    </BrowserRouter>
  )
}

export default App
```

### 2. Custom Loading UI

```typescript
// src/App.tsx with custom loading
import { AuthHydrationGate } from './components/auth'
import { AppSkeleton } from './components/common/AppSkeleton'

function App() {
  return (
    <BrowserRouter>
      <AuthHydrationGate fallback={<AppSkeleton />}>
        <AppLayout>
          <Routes />
        </AppLayout>
      </AuthHydrationGate>
    </BrowserRouter>
  )
}
```

### 3. Custom Skeleton Component

```typescript
// src/components/common/AppSkeleton.tsx
import React from 'react'

export function AppSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
      
      {/* Main content skeleton */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="space-y-4">
            <div className="h-6 w-64 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-32 w-full bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

## Advanced Usage

### 1. Conditional Rendering Based on Hydration

```typescript
import { useAuthHydrated, useAuthReady } from './components/auth'

function ConditionalComponent() {
  const hasHydrated = useAuthHydrated()
  const isReady = useAuthReady()
  
  if (!hasHydrated) {
    return <div>Store is hydrating...</div>
  }
  
  if (!isReady) {
    return <div>Checking authentication...</div>
  }
  
  return <div>App is ready!</div>
}
```

### 2. Multiple Hydration Gates

```typescript
// For complex apps with multiple stores
function App() {
  return (
    <BrowserRouter>
      <AuthHydrationGate>
        <SettingsHydrationGate>
          <BlogHydrationGate>
            <AppLayout>
              <Routes />
            </AppLayout>
          </BlogHydrationGate>
        </SettingsHydrationGate>
      </AuthHydrationGate>
    </BrowserRouter>
  )
}
```

### 3. Progressive Loading

```typescript
function ProgressiveApp() {
  const hasHydrated = useAuthHydrated()
  const isReady = useAuthReady()
  
  return (
    <div>
      {/* Always show header */}
      <Header />
      
      {/* Progressive content loading */}
      {!hasHydrated && <HydrationSkeleton />}
      {hasHydrated && !isReady && <AuthCheckingSkeleton />}
      {isReady && <MainContent />}
    </div>
  )
}
```

## Implementation Details

### How It Works

1. **Initial State**: `_hasHydrated: false`, `loading: true`
2. **Store Hydration**: Zustand rehydrates from localStorage
3. **Hydration Flag**: `onRehydrateStorage` sets `_hasHydrated: true`
4. **Auth Check**: App performs initial auth validation
5. **Ready State**: `loading: false` when auth check complete

### State Transitions

```
Initial:     { _hasHydrated: false, loading: true }  → Show loading
Hydrated:    { _hasHydrated: true,  loading: true }  → Show loading  
Ready:       { _hasHydrated: true,  loading: false } → Show app
```

### Performance Optimization

The component uses a composed selector to prevent over-rendering:

```typescript
const { _hasHydrated, loading } = useAuthStore(
  (state) => ({
    _hasHydrated: state._hasHydrated,
    loading: state.loading,
  })
)
```

This ensures the component only re-renders when hydration or loading state changes, not when other auth state changes.

## Testing

### Unit Tests

```typescript
import { render, screen } from '@testing-library/react'
import { AuthHydrationGate } from '../AuthHydrationGate'

test('shows loading when not hydrated', () => {
  // Mock store state
  mockAuthStore.setState({
    _hasHydrated: false,
    loading: false,
  })
  
  render(
    <AuthHydrationGate>
      <div data-testid="app">App</div>
    </AuthHydrationGate>
  )
  
  expect(screen.getByText('Authenticating...')).toBeInTheDocument()
  expect(screen.queryByTestId('app')).not.toBeInTheDocument()
})
```

### Integration Tests

```typescript
test('auth flow with hydration gate', async () => {
  render(<App />)
  
  // Should show loading initially
  expect(screen.getByText('Authenticating...')).toBeInTheDocument()
  
  // Simulate store hydration
  act(() => {
    authStore.getState()._hasHydrated = true
  })
  
  // Should still show loading during auth check
  expect(screen.getByText('Authenticating...')).toBeInTheDocument()
  
  // Simulate auth check completion
  act(() => {
    authStore.getState().loading = false
  })
  
  // Should now show app
  await waitFor(() => {
    expect(screen.getByTestId('app-content')).toBeInTheDocument()
  })
})
```

## Troubleshooting

### Common Issues

1. **Still seeing flicker**: Ensure `skipHydration: true` in store config
2. **Loading state never ends**: Check `onRehydrateStorage` callback
3. **Hydration flag not set**: Verify `_hasHydrated` is in AuthState interface

### Debug Helpers

```typescript
// Add to AuthHydrationGate for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('[AuthHydrationGate]', { _hasHydrated, loading })
}
```

### Performance Monitoring

```typescript
// Monitor hydration performance
useEffect(() => {
  if (_hasHydrated && !loading) {
    console.log('[AuthHydrationGate] App ready in', performance.now(), 'ms')
  }
}, [_hasHydrated, loading])
```

## Best Practices

### ✅ Do

- Wrap your entire app with AuthHydrationGate
- Use custom fallback UI that matches your design
- Test the loading → ready transition
- Keep fallback UI lightweight
- Use composed selectors for performance

### ❌ Don't

- Don't nest multiple AuthHydrationGates for the same store
- Don't put heavy computations in fallback UI
- Don't skip the hydration flag setup
- Don't ignore the loading state
- Don't forget to handle auth failures

## Related Components

- `ProtectedRoute`: For route-level authentication
- `AuthErrorBoundary`: For auth error handling  
- `LoginForm`: For user authentication
- `AuthProvider`: For auth context (if using React Context)

## Migration from Existing Auth

If you already have auth handling:

1. **Add hydration flag** to your auth store
2. **Set up onRehydrateStorage** callback
3. **Wrap app** with AuthHydrationGate
4. **Test the transition** thoroughly  
5. **Remove old loading logic** that's now redundant