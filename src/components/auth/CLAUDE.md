# Authentication Components

# Component Structure
- `LoginForm.tsx` - User login form
- `RegisterForm.tsx` - User registration form  
- `ForgotPasswordForm.tsx` - Password reset form
- `AuthGuard.tsx` - Route protection component
- `RoleGuard.tsx` - Role-based access control

# Authentication Flow Components
```tsx
// LoginForm.tsx
interface LoginFormProps {
  onSuccess?: (user: User) => void;
  redirectTo?: string;
}

export function LoginForm({ onSuccess, redirectTo = '/dashboard' }: LoginFormProps) {
  const form = useLoginForm();
  const navigate = useNavigate();
  
  const handleSubmit = async (data: LoginFormData) => {
    const user = await authService.login(data);
    onSuccess?.(user);
    navigate(redirectTo);
  };
  
  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      <Input {...form.register('email')} type="email" />
      <Input {...form.register('password')} type="password" />
      <Button type="submit" loading={form.formState.isSubmitting}>
        Sign In
      </Button>
    </form>
  );
}
```

# Form Validation
- Use React Hook Form + Zod schemas
- Real-time validation feedback
- Password strength indicators
- Email format validation (NO regex - use Zod)

# Role-Based Components
```tsx
// RoleGuard.tsx
interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
  const { user } = useAuth();
  
  if (!user || !allowedRoles.includes(user.role)) {
    return fallback || <Navigate to="/unauthorized" />;
  }
  
  return <>{children}</>;
}
```

# Supabase Auth Integration
- Use Supabase Auth hooks
- Handle session management
- Email verification flows
- Password reset with magic links

# Authentication States
```tsx
// AuthProvider context
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
```

# Error Handling
- Network error recovery
- Invalid credential messages
- Rate limiting feedback
- Session expiry handling

# DCE-Specific Auth Features
- Supplier vs Buyer registration flows
- Company information collection
- Identity verification status
- Terms of service acceptance

# Security Patterns
- Password complexity requirements
- Session timeout handling
- CSRF protection
- Secure token storage

# Mobile Responsiveness
- Touch-friendly form inputs
- Responsive layout design
- Keyboard navigation support
- Accessibility compliance

# Testing Patterns
```tsx
// Test authentication components
describe('LoginForm', () => {
  it('should submit valid credentials', async () => {
    render(<LoginForm />);
    
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    
    await waitFor(() => {
      expect(mockAuthService.login).toHaveBeenCalled();
    });
  });
});
```

# CRITICAL RULES
- NO regex for email validation - use Zod
- NO any types in auth interfaces
- ALWAYS validate on both client and server
- ALWAYS handle loading states
- ALWAYS provide clear error messages
- SECURE password handling (no plain text)
- IMPLEMENT proper session management
- TEST all authentication flows