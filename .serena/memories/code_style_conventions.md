# Code Style and Conventions

## Critical Rules
- **NO regex** - Use validator.js or zod for validation
- **NO any types** - Use unknown or proper types
- **NO deprecated ESLint configs** - Use flat config only
- **ALWAYS fix TypeScript/ESLint errors immediately**
- **ALWAYS commit every 30 minutes**

## TypeScript Configuration
- Target: ES2022
- Module: ESNext with bundler module resolution
- Strict mode enabled
- No unused locals/parameters
- No fallthrough cases in switch
- JSX: react-jsx
- Path alias: `@/*` maps to `./src/*`

## ESLint Configuration
- Uses flat config format (eslint.config.js)
- TypeScript ESLint recommended rules
- React Hooks recommended rules
- React Refresh for Vite
- Global ignores: dist directory

## Testing Requirements
- Unit tests: Vitest + Testing Library
- E2E tests: Playwright for critical flows
- Coverage: 90% minimum requirement
- Run before commit: `npm run lint && npm test`

## Code Organization
- Components should be reusable and in `/src/components/`
- Page components in `/src/pages/`
- Custom hooks in `/src/hooks/`
- TypeScript types in `/src/types/`
- Utilities in `/src/utils/` or `/src/lib/`
- External integrations in `/src/integrations/`
- State management with Zustand in `/src/store/`