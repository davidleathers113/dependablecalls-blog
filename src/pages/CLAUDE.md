# Page Structure Patterns

# File Naming
- PascalCase with "Page" suffix: `DashboardPage.tsx`
- Group by feature: `/auth/LoginPage.tsx`
- One page component per file

# Page Component Template
```tsx
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface PageNamePageProps {
  // Props if needed
}

export function PageNamePage({ }: PageNamePageProps) {
  // Page-specific logic
  
  return (
    <div className="page-container">
      {/* Page content */}
    </div>
  );
}
```

# Data Fetching Patterns
- React Query for server state
- Zustand for global client state
- Local useState for page-only state
- Supabase real-time subscriptions for live data

# Route Organization
```
/auth/           # Authentication pages
/dashboard/      # User dashboards
/campaigns/      # Campaign management
/calls/          # Call tracking
/reports/        # Analytics/reporting
/billing/        # Payment/billing
/settings/       # User settings
/public/         # Public landing pages
```

# Page Layout Structure
```tsx
<PageLayout>
  <PageHeader title="Page Title" />
  <PageContent>
    {/* Main content */}
  </PageContent>
  <PageFooter />
</PageLayout>
```

# SEO Considerations
- Document title updates with `useEffect`
- Meta descriptions for public pages
- OpenGraph tags for social sharing
- Structured data where applicable

# Error Handling
- Error boundaries for page-level errors
- Loading states during data fetching
- Empty states for no data
- User-friendly error messages

# Authentication Patterns
- Protected routes with auth checks
- Role-based access control (Supplier/Buyer/Admin)
- Redirect to login for unauthenticated users
- Session management with Supabase Auth

# Performance Optimization
- Lazy load pages with React.lazy
- Preload critical data on route enter
- Optimize images with proper sizing
- Minimize bundle size per route

# DCE-Specific Pages
- Supplier Dashboard: Traffic overview, campaign selection
- Buyer Dashboard: Campaign management, lead quality
- Call Tracking: Real-time call monitoring
- Billing: Payment processing, payout management
- Reports: Analytics and performance metrics

# Form Pages
- React Hook Form for all forms
- Zod validation schemas
- Optimistic updates where appropriate
- Proper error handling and user feedback

# Real-time Features
- Supabase subscriptions for live updates
- Call status indicators
- Campaign performance metrics
- Fraud detection alerts

# CRITICAL RULES
- NO regex in page components
- NO any types in page props
- ALWAYS handle auth states
- ALWAYS implement loading/error states
- ALWAYS optimize for mobile-first design