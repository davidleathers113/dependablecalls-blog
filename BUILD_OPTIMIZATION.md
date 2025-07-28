# Build Optimization Guide

This document explains the advanced build optimizations implemented in the DCE website project to improve performance, reduce bundle sizes, and enhance caching strategies.

## Overview

The build configuration has been optimized with:
- Advanced code splitting for better caching
- React 19 optimizations
- Performance budgets with size-limit
- Terser minification with aggressive settings
- Module preloading and asset optimization

## Code Splitting Strategy

### Chunk Organization

The application is split into multiple chunks based on update frequency and functionality:

1. **react-core** (~150KB gzipped)
   - `react` and `react-dom` libraries
   - Rarely changes, perfect for long-term caching

2. **react-ecosystem** (~120KB gzipped)
   - `react-router-dom` - Routing
   - `@tanstack/react-query` - Server state management
   - `react-hook-form` - Form handling
   - `react-error-boundary` - Error handling

3. **ui-headless** (~40KB gzipped)
   - `@headlessui/react` - Unstyled UI components

4. **ui-icons** (~30KB gzipped)
   - `@heroicons/react` - Icon library
   - Separated due to size and infrequent updates

5. **supabase** (~120KB gzipped)
   - All `@supabase/*` packages
   - Backend SDK, changes with API updates

6. **stripe** (~80KB gzipped)
   - `@stripe/stripe-js` and `stripe` packages
   - Payment processing SDK

7. **state** (~15KB gzipped)
   - `zustand` - State management

8. **http** (~20KB gzipped)
   - `axios` - HTTP client

9. **validation** (~25KB gzipped)
   - `zod` - Schema validation
   - `@hookform/resolvers` - Form validation bridges

10. **utils** (~50KB gzipped)
    - `lodash` - Utility functions
    - `uuid` - UUID generation

11. **monitoring** (~60KB gzipped)
    - `@sentry/*` - Error tracking and monitoring

12. **vendor** (~100KB gzipped)
    - Everything else not categorized above

### Benefits of This Strategy

- **Better Caching**: Core libraries change rarely, so they can be cached for weeks
- **Parallel Loading**: Smaller chunks can be loaded in parallel
- **Selective Loading**: Features like Stripe/Sentry can be loaded on-demand
- **Update Efficiency**: When you update your app code, users only download changed chunks

## React 19 Optimizations

### Automatic JSX Runtime
- Uses the new JSX transform for smaller bundles
- No need to import React in every file
- Reduces bundle size by ~8-10KB

### Fast Refresh
- Enabled for better development experience
- Preserves component state during hot reloads

### Future: React Compiler
- Configuration prepared for React Compiler when it becomes stable
- Will enable automatic memoization and optimization

## Build Optimizations

### Terser Configuration

```javascript
terserOptions: {
  compress: {
    drop_console: true,      // Remove console.log in production
    drop_debugger: true,     // Remove debugger statements
    pure_funcs: ['console.log', 'console.info', 'console.debug'],
    passes: 2,               // Two compression passes for better results
  },
  mangle: {
    toplevel: true,          // Mangle top-level variable names
    properties: {
      regex: /^_/,          // Mangle private properties (starting with _)
    },
  },
}
```

### Asset Optimization

1. **CSS Code Splitting**: Each route gets its own CSS file
2. **Asset Inlining**: Files < 4KB are inlined as base64
3. **Compression**: Both gzip and Brotli compression enabled
4. **Source Maps**: Enabled for debugging production issues

### Module Preloading

- Critical modules are preloaded for faster initial render
- Polyfill included for older browsers
- Warm-up configuration for faster development

## Performance Budgets

Performance budgets are configured using `size-limit`:

### Critical Path Budget
- **Initial Load**: 270KB (gzipped)
  - Main app entry: 100KB
  - React core: 150KB
  - Main CSS: 20KB

### Individual Chunk Budgets
- Each chunk has a specific size limit
- Prevents accidental size increases
- CI/CD can fail builds that exceed budgets

### Running Size Checks

```bash
# Check current sizes against budgets
npm run size

# Analyze why a bundle is large
npm run analyze
```

## Bundle Analysis

### Visualizer Plugin
- Generates interactive treemap at `dist/stats.html`
- Shows both raw and compressed sizes
- Helps identify large dependencies

### Using the Analyzer

1. Build the project: `npm run build`
2. Open `dist/stats.html` in a browser
3. Analyze chunk composition and sizes
4. Look for optimization opportunities

## Development Optimizations

### Dependency Pre-bundling
Key dependencies are pre-bundled for faster dev server startup:
- React ecosystem
- Supabase SDK
- State management
- HTTP clients

### Excluded from Pre-bundling
Large SDKs loaded on-demand:
- Stripe (only on payment pages)
- Sentry (only in production)

### Server Warm-up
Critical files are pre-transformed on server start:
- App entry points
- Common components
- Page components

## Best Practices for Developers

### Dynamic Imports
Use dynamic imports with magic comments for better control:

```javascript
// Prefetch: High priority, load when browser is idle
const StripeForm = lazy(() => 
  import(/* webpackPrefetch: true */ './components/StripeForm')
);

// Preload: Critical resource, load immediately
const Dashboard = lazy(() => 
  import(/* webpackPreload: true */ './pages/Dashboard')
);

// Chunk naming for better debugging
const AdminPanel = lazy(() => 
  import(
    /* webpackChunkName: "admin" */
    './pages/AdminPanel'
  )
);
```

### Component Code Splitting
Split at the route level for best results:

```javascript
// Routes.tsx
import { lazy, Suspense } from 'react';

const HomePage = lazy(() => import('./pages/HomePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Wrap with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/settings" element={<SettingsPage />} />
  </Routes>
</Suspense>
```

### Monitoring Bundle Size

1. **Before commits**: Run `npm run size` to check budgets
2. **In CI/CD**: Size checks should be part of the pipeline
3. **Regular audits**: Use `npm run analyze` monthly

## Future Optimizations

### React Compiler (Coming Soon)
When React Compiler becomes stable:
- Automatic component memoization
- Optimal re-render prevention
- Dead code elimination
- No manual memo/useCallback needed

### HTTP/3 and Early Hints
When deployed to production:
- Configure server for HTTP/3
- Use 103 Early Hints for critical resources
- Implement resource hints (`<link rel="preload">`)

### Edge Optimization
With Netlify Edge Functions:
- Move heavy computations to edge
- Implement edge-side includes (ESI)
- Geographic code splitting

## Troubleshooting

### Bundle Too Large
1. Run `npm run analyze`
2. Identify large dependencies
3. Consider dynamic imports
4. Check for duplicate dependencies

### Slow Build Times
1. Check Vite cache is working
2. Reduce transformation plugins
3. Use `vite build --debug` for timing

### Memory Issues
1. Increase Node memory: `NODE_OPTIONS="--max-old-space-size=4096"`
2. Reduce parallel operations
3. Clear Vite cache: `rm -rf node_modules/.vite`

## Metrics to Monitor

1. **Core Web Vitals**
   - LCP < 2.5s
   - FID < 100ms
   - CLS < 0.1

2. **Bundle Metrics**
   - Initial JS < 270KB (gzipped)
   - Total JS < 900KB (gzipped)
   - CSS < 20KB (gzipped)

3. **Network Metrics**
   - HTTP requests < 30
   - Total transfer < 1MB
   - Cache hit rate > 80%

Remember: Performance is a feature. Every KB matters!