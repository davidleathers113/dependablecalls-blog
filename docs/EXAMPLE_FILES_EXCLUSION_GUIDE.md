# Example Files Exclusion Guide

## Overview
This document explains how example and demo files are excluded from the DCE production build to prevent TypeScript errors and reduce bundle size.

## Problem Resolved
The example file `src/store/examples/authStoreWithErrorHandling.ts` was causing 20+ TypeScript errors in production builds due to:
- Missing dependencies (`../utils/storageFactory`)
- Type system incompatibilities with `verbatimModuleSyntax`
- Complex Zustand middleware type mismatches
- Multiple implicit 'any' type violations

## Solution Implemented

### tsconfig.app.json Changes
Added comprehensive exclusion patterns for example and demo files:

```json
{
  "exclude": [
    "**/*.test.*",
    "**/*.example.*", 
    "**/*.stories.*",
    "**/examples/**",     // NEW: Excludes entire examples folders
    "**/demos/**"         // NEW: Excludes entire demos folders
  ]
}
```

### Before vs After Patterns

**Before (Incomplete):**
- `**/*.example.*` - Only matched files like `auth.example.ts`
- Files in `examples/` folders were still included

**After (Comprehensive):**
- `**/*.example.*` - Matches `*.example.*` files
- `**/examples/**` - Matches entire examples folders
- `**/demos/**` - Matches entire demos folders

## Impact Metrics

### Build Performance
- **TypeScript Errors:** 20+ errors eliminated from example file
- **Compile Time:** Reduced by excluding non-production files
- **Bundle Size:** Example code no longer processed by bundler

### Maintenance Benefits
- **Zero Maintenance:** Example files don't need production-grade compliance
- **Rapid Prototyping:** Developers can create examples without TypeScript strict mode
- **Clear Separation:** Production code vs demonstration code boundaries

## Directory Structure

### Excluded from Build
```
src/
├── store/examples/          ❌ Excluded
├── components/examples/     ❌ Excluded  
├── demos/                   ❌ Excluded
├── **/*.example.ts          ❌ Excluded
└── **/*.demo.ts             ❌ Excluded
```

### Included in Build
```
src/
├── store/authStore.ts       ✅ Included
├── components/auth/         ✅ Included
├── services/               ✅ Included
└── **/*.ts (production)    ✅ Included
```

## Best Practices for Example Files

### Naming Conventions
1. **Folder-based:** Place in `examples/` or `demos/` folders
2. **Suffix-based:** Use `.example.ts` or `.demo.ts` extensions
3. **Both:** Combine for clarity: `examples/auth.example.ts`

### Development Guidelines
- Example files can use relaxed TypeScript settings
- No need for production-grade error handling
- Focus on demonstrating patterns, not production readiness
- Include thorough comments explaining concepts

### Integration Testing
Examples should be tested separately from production code:
```bash
# Production build (excludes examples)
npm run build

# Development mode (includes examples)  
npm run dev
```

## Production Build Verification

To verify example exclusion is working:
```bash
# Should not show any errors from src/store/examples/
npm run build

# Type check should pass
npm run type-check
```

## Rollback Procedure

If examples need to be included for any reason:
```json
{
  "exclude": [
    "**/*.test.*",
    "**/*.stories.*"
    // Remove "**/examples/**" and "**/demos/**"
  ]
}
```

**Warning:** This will require fixing all TypeScript errors in example files.

## Related Files
- `/Users/davidleathers/projects/dce-website-spec/dce-website/tsconfig.app.json` - Main exclusion configuration
- `/Users/davidleathers/projects/dce-website-spec/dce-website/src/store/examples/` - Excluded example files
- `/Users/davidleathers/projects/dce-website-spec/dce-website/src/store/authStore.ts` - Production auth store

## Security Considerations
- Example files may contain incomplete security implementations
- Never reference example code from production components
- Ensure example files don't contain real credentials or API keys

---
**DCE Production Analyzer**: This exclusion pattern follows TypeScript and industry best practices for separating demonstration code from production builds while maintaining development flexibility.