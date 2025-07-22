# Custom Hook Patterns

# Naming Conventions
- ALL hooks start with "use": `useAuth`, `useApi`, `useCampaign`
- Be descriptive: `useRealTimeCallTracking` vs `useRealTime`
- Group related hooks: `useAuth`, `useAuthActions`, `useAuthState`

# File Structure
```
hooks/
├── useAuth.ts          # Authentication hooks
├── useApi.ts           # API data fetching
├── useLocalStorage.ts  # Browser storage
├── useRealtime.ts      # Supabase real-time
├── useForm.ts          # Form management
├── useStripe.ts        # Payment processing
├── useCampaign.ts      # Campaign management
├── useCall.ts          # Call tracking
└── index.ts            # Hook exports
```

# Basic Hook Template
```tsx
import { useState, useEffect } from 'react';

interface UseHookResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useHookName<T>(params: HookParams): UseHookResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Hook logic here
  }, [/* dependencies */]);
  
  return { data, loading, error };
}
```

# API Data Fetching Hooks
```tsx
import { useQuery } from '@tanstack/react-query';
import { fetchUser } from '@/lib/api';

export function useUser(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    enabled: !!userId,
  });
}

// Mutation hook
export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateUser,
    onSuccess: (user) => {
      queryClient.setQueryData(['user', user.id], user);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

# Authentication Hooks
```tsx
export function useAuth() {
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const login = useAuthStore(state => state.login);
  const logout = useAuthStore(state => state.logout);
  
  return {
    user,
    isAuthenticated,
    login,
    logout,
    isSupplier: user?.role === 'supplier',
    isBuyer: user?.role === 'buyer',
    isAdmin: user?.role === 'admin',
  };
}
```

# Real-time Data Hooks
```tsx
export function useRealTimeCall(callId: string) {
  const [call, setCall] = useState<Call | null>(null);
  
  useEffect(() => {
    if (!callId) return;
    
    const channel = supabase
      .channel(`call-${callId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `id=eq.${callId}`,
      }, (payload) => {
        setCall(payload.new as Call);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId]);
  
  return call;
}
```

# Form Hooks
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/types/auth';

export function useLoginForm() {
  const { login } = useAuth();
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });
  
  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
    } catch (error) {
      form.setError('root', {
        message: handleApiError(error),
      });
    }
  };
  
  return {
    ...form,
    onSubmit: form.handleSubmit(onSubmit),
  };
}
```

# Local Storage Hooks
```tsx
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });
  
  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function 
        ? value(storedValue) 
        : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };
  
  return [storedValue, setValue];
}
```

# Performance Optimization Hooks
```tsx
import { useMemo, useCallback } from 'react';

export function useOptimizedData<T>(
  data: T[],
  filterFn: (item: T) => boolean,
  sortFn: (a: T, b: T) => number
) {
  const filteredAndSorted = useMemo(() => {
    return data.filter(filterFn).sort(sortFn);
  }, [data, filterFn, sortFn]);
  
  return filteredAndSorted;
}

// Debounced value hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}
```

# DCE-Specific Hooks

## Campaign Management
```tsx
export function useCampaignStats(campaignId: string) {
  return useQuery({
    queryKey: ['campaign-stats', campaignId],
    queryFn: () => fetchCampaignStats(campaignId),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
```

## Call Tracking
```tsx
export function useActiveCallCount() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const channel = supabase
      .channel('active-calls')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calls',
        filter: 'status=eq.active',
      }, () => {
        // Refetch active call count
        fetchActiveCallCount().then(setCount);
      })
      .subscribe();
    
    return () => supabase.removeChannel(channel);
  }, []);
  
  return count;
}
```

# Error Handling in Hooks
```tsx
export function useApiWithErrorHandling<T>(
  fetcher: () => Promise<T>
) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });
  
  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: handleApiError(error),
      }));
    }
  }, [fetcher]);
  
  return { ...state, execute };
}
```

# Testing Custom Hooks
```tsx
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('should return initial value', () => {
    const { result } = renderHook(() => 
      useLocalStorage('test-key', 'initial')
    );
    
    expect(result.current[0]).toBe('initial');
  });
  
  it('should update value', () => {
    const { result } = renderHook(() => 
      useLocalStorage('test-key', 'initial')
    );
    
    act(() => {
      result.current[1]('updated');
    });
    
    expect(result.current[0]).toBe('updated');
  });
});
```

# CRITICAL RULES
- NO regex in custom hooks
- NO any types in hook parameters or returns
- ALWAYS handle cleanup in useEffect
- ALWAYS provide proper TypeScript types
- ALWAYS handle error states explicitly
- USE useCallback for functions returned from hooks
- USE useMemo for expensive calculations
- TEST all custom hooks thoroughly
- FOLLOW React hooks rules (no conditional hooks)