# Unit Test Patterns

# Test File Organization
```
unit/
├── components/     # React component tests
├── hooks/         # Custom hook tests
├── stores/        # Zustand store tests
├── utils/         # Utility function tests
├── services/      # Service layer tests
└── lib/           # Library function tests
```

# Component Testing Template
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, describe, it, vi } from 'vitest';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  const defaultProps = {
    title: 'Test Title',
    onAction: vi.fn(),
  };

  it('should render with correct title', () => {
    render(<ComponentName {...defaultProps} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should call onAction when button clicked', () => {
    render(<ComponentName {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(defaultProps.onAction).toHaveBeenCalledTimes(1);
  });
});
```

# Hook Testing Pattern
```tsx
import { renderHook, act } from '@testing-library/react';
import { expect, describe, it } from 'vitest';
import { useCustomHook } from './useCustomHook';

describe('useCustomHook', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => useCustomHook());
    
    expect(result.current.data).toBe(null);
    expect(result.current.loading).toBe(false);
  });

  it('should handle state updates', () => {
    const { result } = renderHook(() => useCustomHook());
    
    act(() => {
      result.current.updateData('new data');
    });
    
    expect(result.current.data).toBe('new data');
  });
});
```

# Store Testing Pattern
```tsx
import { describe, it, beforeEach, expect } from 'vitest';
import { useAuthStore } from '@/store/authStore';

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useAuthStore.getState().reset();
  });

  it('should have initial state', () => {
    const state = useAuthStore.getState();
    
    expect(state.user).toBe(null);
    expect(state.isAuthenticated).toBe(false);
  });

  it('should login user correctly', async () => {
    const { login } = useAuthStore.getState();
    
    await login('test@example.com', 'password');
    
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('test@example.com');
  });
});
```

# Utility Function Testing
```tsx
import { describe, it, expect } from 'vitest';
import { formatCurrency, validateEmail } from '@/lib/utils';

describe('formatCurrency', () => {
  it('should format USD correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should handle zero amount', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

describe('validateEmail', () => {
  it('should validate correct email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(validateEmail('invalid-email')).toBe(false);
  });
});
```

# Async Function Testing
```tsx
import { describe, it, expect, vi } from 'vitest';
import { fetchUser } from '@/lib/api';

// Mock external dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: '1', email: 'test@example.com' },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

describe('fetchUser', () => {
  it('should fetch user successfully', async () => {
    const user = await fetchUser('1');
    
    expect(user).toEqual({
      id: '1',
      email: 'test@example.com',
    });
  });
});
```

# Form Validation Testing
```tsx
import { describe, it, expect } from 'vitest';
import { loginSchema } from '@/types/auth';

describe('loginSchema', () => {
  it('should validate correct login data', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
    };
    
    const result = loginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'password123',
    };
    
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['email']);
  });
});
```

# Error Handling Tests
```tsx
describe('error handling', () => {
  it('should handle API errors gracefully', async () => {
    // Mock API to throw error
    vi.mocked(apiCall).mockRejectedValue(new Error('API Error'));
    
    const { result } = renderHook(() => useApiHook());
    
    await act(async () => {
      await result.current.fetchData();
    });
    
    expect(result.current.error).toBe('API Error');
    expect(result.current.loading).toBe(false);
  });
});
```

# Test Setup & Teardown
```tsx
import { beforeEach, afterEach } from 'vitest';

describe('Component with cleanup', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    vi.resetAllMocks();
  });
});
```

# Mocking External Dependencies
```tsx
// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signIn: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock React Router
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/dashboard' }),
}));

// Mock environment variables
vi.mock('@/lib/env', () => ({
  env: {
    SUPABASE_URL: 'http://localhost:54321',
    STRIPE_PUBLIC_KEY: 'pk_test_123',
  },
}));
```

# DCE-Specific Unit Tests
- Campaign validation logic
- Call duration calculations
- Commission rate computations
- Fraud detection algorithms
- Real-time data transformations
- User permission checks

# Accessibility Testing
```tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<Component />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

# Performance Testing
```tsx
import { performance } from 'perf_hooks';

describe('performance', () => {
  it('should render within acceptable time', () => {
    const start = performance.now();
    render(<ExpensiveComponent />);
    const end = performance.now();
    
    expect(end - start).toBeLessThan(100); // 100ms threshold
  });
});
```

# CRITICAL RULES
- NO regex in test code
- NO any types in assertions
- ALWAYS mock external dependencies
- ALWAYS test error conditions
- ALWAYS clean up after tests
- TEST accessibility compliance
- TEST performance requirements
- USE proper TypeScript typing
- WRITE descriptive test names
- COVER edge cases and error paths