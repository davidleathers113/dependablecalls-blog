# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack
- **Frontend**: Vite 7.0, React 19.1, TypeScript 5.8
- **UI**: Tailwind CSS 4.1, Headless UI 2.2, Heroicons 2.2
- **Backend**: Supabase 2.52 (PostgreSQL + Auth + Realtime)
- **State**: Zustand 5.0, React Query 5.83, React Hook Form 7.60
- **Payments**: Stripe 18.3
- **HTTP**: Axios 1.10
- **Testing**: Vitest 3.2, Playwright 1.54, Testing Library
- **Monitoring**: Sentry 8.52

## Essential Commands

### Development
```bash
npm run dev                    # Start dev server (localhost:5173)
npm run build                  # Production build (TypeScript check + Vite build)
npm run preview                # Preview production build
npm run lint                   # ESLint check
npm run lint:fix               # Fix ESLint issues
npm run type-check             # TypeScript type checking
npm run type-check:comprehensive # Comprehensive type check with coverage
```

### Testing
```bash
npm test                       # Run Vitest tests
npm run test:ci               # Run tests with coverage
npm run test:ui               # Open Vitest UI
npm run test:coverage         # Run tests with verbose coverage report
npm run test:e2e              # Run Playwright E2E tests
npm run test:e2e:ui           # Open Playwright UI

# Specific test suites
npm run test:blog             # Test blog-related features
npm run test:call-tracking    # Test call tracking service
npm run test:encryption       # Test encryption functionality
npm run security:test         # Run security-focused tests
```

### Security
```bash
npm run security:full         # Complete security check suite
npm run security:audit        # npm audit with moderate threshold
npm run security:scan         # Snyk vulnerability scan
npm run security:licenses     # License compliance check
npm run security:sbom         # Generate Software Bill of Materials
npm run security:zap:quick    # Quick ZAP security scan
```

### Database & Setup
```bash
npm run setup:test-accounts   # Create test accounts
npm run setup:blog           # Set up blog database
npm run seed:blog-content    # Seed blog with test content
npm run verify:blog          # Verify blog setup
npm run migrate:encryption   # Run encryption migrations
```

## Code Rules (CRITICAL)
1. **NEVER use regex** - Use validator.js or zod for ALL validation
2. **NEVER use 'any' type** - Use 'unknown' or proper types
3. **ALWAYS use flat ESLint config** (eslint.config.js)
4. **ALWAYS fix TypeScript/ESLint errors immediately**
5. **ALWAYS commit every 30 minutes** during active development
6. **90% test coverage minimum** for all new code

## Specialized AI Agents

This project includes specialized Claude Code agents in `.claude/agents/` that understand the DCE platform architecture, enforce code rules, and accelerate development. Each agent is an expert in specific aspects of the codebase.

### Available Agents

#### Core Development
- **`react-optimization-specialist`** - React 19.1 performance optimization, component architecture, Tailwind/Headless UI patterns
- **`typescript-expert`** - TypeScript 5.8 strict typing, Zod schemas, type definitions (enforces NO 'any' types)
- **`javascript-expert`** - Vite optimization, utilities, real-time features (enforces NO regex patterns)
- **`vitest-test-writer`** - Comprehensive testing to achieve 90% coverage requirement

#### Infrastructure & State
- **`supabase-specialist`** - Database operations, auth, real-time channels, RLS policies, Edge Functions
- **`zustand-architect`** - State management patterns, store optimization, middleware configuration
- **`netlify-deployment-specialist`** - Deployment configuration, CI/CD, edge functions

#### Quality & Security
- **`dce-production-analyzer`** - Pre-deployment analysis for production breakers, memory leaks, security vulnerabilities
- **`dce-orchestrator`** - Master coordinator that routes tasks to appropriate specialist agents

### Using Agents

#### Automatic Routing
Claude Code automatically selects appropriate agents based on context:
```bash
"Optimize the buyer dashboard" → react-optimization-specialist
"Create type definitions for calls" → typescript-expert
"Add tests for the campaign service" → vitest-test-writer
```

#### Explicit Agent Requests
You can directly request specific agents:
```bash
"Use the typescript-expert to review these types"
"Have the dce-production-analyzer scan before deployment"
"Deploy the zustand-architect to optimize our stores"
```

#### Multi-Agent Coordination
The orchestrator can coordinate multiple agents:
```bash
"Use dce-orchestrator to build a complete campaign feature"
→ Coordinates: typescript-expert → supabase-specialist → react-optimization-specialist → vitest-test-writer
```

### Agent Enforcement
All agents enforce DCE critical rules:
- ✅ NO regex patterns (use validator.js/Zod)
- ✅ NO 'any' types (use 'unknown' or proper types)
- ✅ 90% test coverage minimum
- ✅ Zustand for state (never Redux)
- ✅ Tailwind CSS classes (no inline styles)
- ✅ Proper Supabase cleanup (no memory leaks)

### Pre-Deployment Workflow
Always use before production deployment:
```bash
"Run dce-production-analyzer on the entire codebase"
```
This will identify:
- 🔴 Production breakers (event loop blocking, memory leaks)
- ⚡ Performance issues (bundle size, re-renders)
- 🔒 Security vulnerabilities (XSS, SQL injection)
- 📚 Deprecated APIs requiring updates

## Architecture Overview

### Frontend Structure
```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── blog/           # Blog-specific components
│   ├── campaigns/      # Campaign management
│   ├── dashboard/      # Role-based dashboards
│   │   ├── admin/
│   │   ├── buyer/
│   │   ├── network/
│   │   └── supplier/
│   ├── forms/          # Form components
│   ├── layout/         # Layout wrappers
│   ├── realtime/       # Real-time updates
│   └── ui/             # Base UI components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and shared logic
│   ├── encryption/     # Data encryption utilities
│   ├── security/       # Security utilities
│   └── validation/     # Validation schemas (Zod)
├── pages/              # Route-based pages
├── services/           # Business logic layer
│   ├── call-tracking/  # Call tracking service
│   └── api/           # API service layer
├── store/              # Zustand stores
│   ├── middleware/     # Store middleware
│   └── slices/        # Store slices
├── types/              # TypeScript definitions
└── utils/              # Helper functions
```

### State Management Pattern
The project uses Zustand with a consistent pattern:
- Each domain has its own store (authStore, buyerStore, supplierStore, etc.)
- Stores use immer for immutable updates
- Middleware for error handling and persistence
- Actions follow naming convention: `setX`, `fetchX`, `updateX`, `deleteX`

### Authentication Flow
- Magic Link authentication (passwordless) via Supabase
- Role-based access: Supplier, Buyer, Admin, Network
- Auth state managed in authStore
- Protected routes wrap components with authentication checks

### Real-time Features
- Supabase Realtime for live updates
- Custom hook: `useRealtimeChannel` for subscriptions
- Real-time call status tracking
- Live dashboard updates

### Testing Strategy
- **Unit Tests**: Component logic, hooks, utilities
- **Integration Tests**: Store interactions, API calls
- **E2E Tests**: Critical user journeys with Playwright
- **Security Tests**: CSRF, XSS, authentication flows
- Test files located alongside source files or in `/tests`

## Development Workflow

### Pre-commit Checklist
1. Run `npm run lint:fix` to fix formatting
2. Run `npm run type-check` to verify types
3. Run `npm test` to ensure tests pass
4. Check coverage meets 90% threshold
5. Verify no secrets in code

### Working with Supabase
- Local development uses Supabase CLI
- Migrations in `/supabase/migrations`
- Edge functions in `/supabase/functions`
- RLS policies enforced for all tables

### Performance Considerations
- Bundle size limits enforced via size-limit
- Code splitting for routes and large components
- Lazy loading for non-critical features
- React Query for efficient data fetching and caching

## Common Patterns

### Form Handling
```typescript
// Always use React Hook Form with Zod validation
const schema = z.object({
  email: z.string().email(),
  // NEVER use regex patterns
})
```

### API Calls
```typescript
// Use service layer, not direct Supabase calls in components
import { campaignService } from '@/services/campaignService'
```

### Error Handling
```typescript
// Use error boundaries and consistent error states
<ErrorBoundary fallback={<ErrorFallback />}>
  <Component />
</ErrorBoundary>
```

## Serena MCP Integration
This project uses Serena MCP for semantic code navigation. Use these patterns:

```bash
# Find components/hooks/stores
find_symbol("DashboardLayout")
find_symbol("useAuth")
find_symbol("authStore")

# Explore directories
get_symbols_overview("src/components/dashboard")

# Track usage
find_referencing_symbols("useSupabase", "src/hooks/useSupabase.ts")
```

### Serena Best Practices
- Start with `list_memories()` to see project context
- Use `get_symbols_overview` before reading entire files
- Prefer `replace_symbol_body` over regex replacements
- Check memories: project_overview, code_style_conventions, etc.

## Platform Context
DCE (Dependable Calls Exchange) is a pay-per-call network platform:
- **Suppliers**: Traffic providers sending calls/leads
- **Buyers**: Advertisers paying for qualified leads
- **Focus**: Real-time tracking, fraud prevention, automated billing
- **Critical**: Call quality scoring, geographic targeting, budget management