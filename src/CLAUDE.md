# CRITICAL RULES (NON-NEGOTIABLE)
- **NEVER** use regex (no /pattern/, no new RegExp) - use validator.js or zod
- **NEVER** use 'any' type - always specify proper types  
- **ALWAYS** use flat ESLint config (eslint.config.js)
- **ALWAYS** fix TypeScript/ESLint errors immediately
- **ALWAYS** commit work every 30 minutes

## Source Code Directory

This directory contains the main application source code for the DCE platform.

### Key Subdirectories
- `components/` - React components organized by feature
- `pages/` - Page components for routing
- `hooks/` - Custom React hooks
- `lib/` - Shared utilities and Supabase client
- `integrations/` - Third-party service integrations
- `store/` - Zustand state management
- `types/` - TypeScript type definitions
- `utils/` - Utility functions

### Code Standards
- Use TypeScript strict mode
- Follow existing patterns in each directory
- Implement proper error boundaries
- Use Zod for all validation (NO REGEX)
- Replace all 'any' with proper types or 'unknown'