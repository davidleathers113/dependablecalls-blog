# Zustand State Management Patterns

# Store File Structure
```
store/
├── authStore.ts        # Authentication state
├── campaignStore.ts    # Campaign management
├── callStore.ts        # Call tracking state
├── billingStore.ts     # Billing/payment state
├── uiStore.ts          # UI state (modals, etc.)
└── index.ts            # Store exports
```

# Basic Store Pattern
```tsx
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface StoreState {
  // State properties
  data: DataType[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setData: (data: DataType[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useStore = create<StoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    data: [],
    isLoading: false,
    error: null,
    
    // Actions
    setData: (data) => set({ data }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    reset: () => set({ data: [], isLoading: false, error: null }),
  }))
);
```

# TypeScript Requirements
- ALL stores must have proper interfaces
- NO any types in state or actions
- Use proper generic types for flexible stores
- Export store types for component usage

# Async Actions Pattern
```tsx
// Async actions with proper error handling
const useDataStore = create<DataStore>((set, get) => ({
  data: [],
  isLoading: false,
  error: null,
  
  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.getData();
      set({ data, isLoading: false });
    } catch (error) {
      set({ 
        error: handleApiError(error), 
        isLoading: false 
      });
    }
  },
}));
```

# Computed Values
```tsx
// Use selectors for computed values
export const useUserStats = () => {
  return useAuthStore((state) => ({
    totalCalls: state.calls.length,
    activeCallsCount: state.calls.filter(c => c.status === 'active').length,
    conversionRate: state.calls.length > 0 
      ? (state.conversions / state.calls.length) * 100 
      : 0,
  }));
};
```

# Persistence Patterns
```tsx
import { persist } from 'zustand/middleware';

// Persist auth state
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      // ... other state and actions
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
);
```

# Subscriptions for Real-time
```tsx
// Subscribe to Supabase real-time changes
export const useCallStore = create<CallState>((set, get) => ({
  calls: [],
  
  subscribeToRealTimeUpdates: () => {
    return supabase
      .channel('calls')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'calls' },
        (payload) => {
          // Update store based on real-time changes
          set((state) => ({
            calls: updateCallsArray(state.calls, payload)
          }));
        }
      )
      .subscribe();
  },
}));
```

# Performance Optimization
```tsx
// Use shallow equality for object selections
import { shallow } from 'zustand/shallow';

const Component = () => {
  const { user, isLoading } = useAuthStore(
    (state) => ({ user: state.user, isLoading: state.isLoading }),
    shallow
  );
};

// Or use specific selectors
const user = useAuthStore(state => state.user);
const isLoading = useAuthStore(state => state.isLoading);
```

# DCE-Specific Stores

## Auth Store
- User authentication state
- Role-based permissions (Supplier/Buyer/Admin)
- Session management

## Campaign Store
- Campaign CRUD operations
- Real-time campaign status
- Performance metrics

## Call Store
- Live call tracking
- Call history and analytics
- Real-time status updates

## Billing Store
- Payment processing state
- Payout calculations
- Transaction history

# Store Testing
```tsx
// Test stores in isolation
describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });
  
  it('should login user correctly', async () => {
    const { login } = useAuthStore.getState();
    await login('user@test.com', 'password');
    
    expect(useAuthStore.getState().user).toBeDefined();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
```

# CRITICAL RULES
- NO regex in store logic
- NO any types in store interfaces
- ALWAYS handle async errors properly
- ALWAYS reset state when needed
- ALWAYS use TypeScript strictly
- ALWAYS test store actions
- NO direct state mutations (use set function)