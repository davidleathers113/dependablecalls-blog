# DCE Website Project Overview

## Purpose
DCE (Dependable Calls E-commerce) is a pay-per-call network platform designed for:
- **Suppliers**: Traffic providers sending calls/clicks/leads
- **Buyers**: Advertisers paying for qualified leads
- **Admin**: Platform administrators

Focus areas include real-time call tracking, fraud prevention, and billing automation.

## Tech Stack
- **Build Tool**: Vite 7.0
- **Frontend Framework**: React 19.1 with TypeScript 5.8
- **Styling**: Tailwind CSS 4.1, Headless UI 2.2, Heroicons 2.2
- **Backend**: Supabase 2.52 (PostgreSQL + Auth + Realtime)
- **State Management**: Zustand 5.0
- **Data Fetching**: React Query 5.83
- **Forms**: React Hook Form 7.60
- **Payments**: Stripe 18.3
- **HTTP Client**: Axios 1.10
- **Testing**: Vitest 3.2, Playwright 1.54, Testing Library
- **Linting**: ESLint with TypeScript ESLint (flat config)

## Entry Points
- Main entry: `src/main.tsx` (creates React root and renders App)
- HTML template: `index.html`
- App component: `src/App.tsx`