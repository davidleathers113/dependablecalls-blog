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

## 🚨 Critical: Multi-Agent Orchestration via tmux

When being managed via tmux, remember that **tmux send-keys requires explicit Enter**:

```bash
# ❌ WRONG - Prompt appears but Claude never receives it:
tmux send-keys -t dce-impl:1 "You are the Frontend Lead..."

# ✅ CORRECT - Prompt is typed AND submitted to Claude:
tmux send-keys -t dce-impl:1 "You are the Frontend Lead..." Enter
```

If you appear stuck at the welcome screen with a typed prompt, the orchestrator forgot to send Enter. See `/Users/davidleathers/projects/dce-website-spec/ORCHESTRATION_BEST_PRACTICES.md` for full details.