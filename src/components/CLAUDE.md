# Component Patterns

# Naming Conventions
- PascalCase for components: `UserProfile`, `CallTracker`
- camelCase for props: `isLoading`, `onCallEnd`
- kebab-case for CSS classes: `call-status`, `user-card`

# File Structure
```
ComponentName/
├── index.tsx          # Main component
├── ComponentName.tsx  # Alternative: direct export
├── types.ts          # Component-specific types
└── __tests__/        # Component tests
```

# TypeScript Requirements
- ALL props interfaces: `interface ComponentNameProps {}`
- NO any types - use proper typing
- Export prop types for reuse
- Use generic types for flexible components

# Component Template
```tsx
interface ComponentProps {
  title: string;
  isActive?: boolean;
  onAction: (id: string) => void;
}

export function ComponentName({ 
  title, 
  isActive = false, 
  onAction 
}: ComponentProps) {
  return (
    <div className="component-wrapper">
      {/* Component content */}
    </div>
  );
}
```

# Styling Guidelines
- Tailwind CSS classes only
- Use Headless UI for complex interactions
- Heroicons for all icons
- Mobile-first responsive design
- Dark mode support via CSS variables

# State Management
- Local state: `useState` for component-only data
- Global state: Zustand stores for shared data
- Server state: React Query for API data
- Forms: React Hook Form + Zod validation

# Accessibility Requirements
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Focus management for modals/dropdowns

# Testing Requirements
- Unit tests for all logic
- Component tests with Testing Library
- Snapshot tests for UI stability
- Accessibility tests with axe

# Performance Patterns
- React.memo for expensive renders
- useMemo for calculated values
- useCallback for event handlers
- Lazy loading for large components

# DCE-Specific Patterns
- Call status indicators with real-time updates
- Fraud detection UI components
- Supplier/Buyer role-based rendering
- Campaign management interfaces

# CRITICAL RULES
- NO regex in components
- NO any types allowed
- ALWAYS handle loading/error states
- ALWAYS validate props with TypeScript