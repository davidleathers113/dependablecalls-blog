# Tech Stack
- Vite 7.0, React 19.1, TypeScript 5.8
- Tailwind CSS 4.1, Headless UI 2.2, Heroicons 2.2
- Supabase 2.52 (PostgreSQL + Auth + Realtime)
- Zustand 5.0, React Query 5.83, React Hook Form 7.60
- Stripe 18.3 (payments), Axios 1.10 (HTTP)
- Vitest 3.2, Playwright 1.54, Testing Library

# Commands
- `npm run dev` - Start dev server (localhost:5173)
- `npm run build` - Production build
- `npm run lint` - ESLint + TypeScript check
- `npm run preview` - Preview production build
- `npm test` - Run Vitest tests (if configured)

# Code Rules
- NO regex - use validator.js or zod
- NO any types - use unknown or proper types
- NO deprecated ESLint configs - use flat config only
- ALWAYS fix TS/ESLint errors immediately
- ALWAYS commit every 30 minutes

# Project Structure
- `/src/components/` - Reusable React components
- `/src/pages/` - Route-based page components
- `/src/lib/` - Utility functions and shared logic
- `/src/store/` - Zustand state management
- `/src/integrations/` - External service integrations
- `/src/types/` - TypeScript definitions
- `/src/hooks/` - Custom React hooks

# Testing
- Unit: Vitest + Testing Library
- E2E: Playwright for critical flows
- Coverage: 90% minimum requirement
- Run before commit: `npm run lint && npm test`

# DCE Platform Context
Pay-per-call network with suppliers (traffic) and buyers (advertisers).
Focus: Real-time call tracking, fraud prevention, billing automation.

# Serena MCP Integration
This project uses Serena MCP for semantic code navigation and editing.

## Quick Symbol Navigation
```bash
# Find React components
find_symbol("DashboardLayout")
find_symbol("PaymentForm")

# Find custom hooks
find_symbol("useRealtimeSubscription")
find_symbol("useAuth")

# Find Zustand stores
find_symbol("authStore")

# Find methods in classes/objects
find_symbol("SupabaseClient/auth")
```

## DCE Project Navigation Patterns
```bash
# Explore component directories
get_symbols_overview("src/components/dashboard")
get_symbols_overview("src/components/realtime")

# Find all hooks (with pattern)
find_symbol("use", relative_path="src/hooks", substring_matching=true)

# Find store actions
find_symbol("authStore", depth=1)

# Track usage across codebase
find_referencing_symbols("useSupabase", "src/hooks/useSupabase.ts")
find_referencing_symbols("RealtimeChannel", "src/types/database.ts")
```

## Serena Workflow
1. Start with: `/mcp__serena__initial_instructions`
2. Check available memories: `list_memories()`
3. Navigate efficiently:
   - ❌ DON'T: Read entire files with `Read`
   - ✅ DO: Use `get_symbols_overview` → `find_symbol` → targeted edits

## Integration with Code Rules
- **NO regex**: Use `replace_symbol_body` for complete functions
- **Type safety**: Serena maintains TypeScript types when editing
- **Testing**: Find test files with `find_file("*.test.tsx", "src")`

## Available Serena Memories
Serena has created project memories during onboarding:
- `project_overview` - Tech stack and purpose
- `code_style_conventions` - Coding standards
- `task_completion_checklist` - Pre-commit workflow
- `suggested_commands` - Dev commands reference
- `project_structure` - Directory organization

Use `read_memory("memory_name")` to access these when needed.

## 🚨 Critical: Multi-Agent Orchestration via tmux

When being managed via tmux, remember that **tmux send-keys requires explicit Enter**:

```bash
# ❌ WRONG - Prompt appears but Claude never receives it:
tmux send-keys -t dce-impl:1 "You are the Frontend Lead..."

# ✅ CORRECT - Prompt is typed AND submitted to Claude:
tmux send-keys -t dce-impl:1 "You are the Frontend Lead..." Enter
```

If you appear stuck at the welcome screen with a typed prompt, the orchestrator forgot to send Enter. See `/Users/davidleathers/projects/dce-website-spec/ORCHESTRATION_BEST_PRACTICES.md` for full details.