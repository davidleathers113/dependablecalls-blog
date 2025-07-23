# Authentication Pages

# Page Structure
- `LoginPage.tsx` - User login interface
- `RegisterPage.tsx` - User registration
- `ForgotPasswordPage.tsx` - Password reset
- `VerifyEmailPage.tsx` - Email verification
- `ResetPasswordPage.tsx` - Password reset completion

# Login Page Implementation
```tsx
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const redirectTo = location.state?.from?.pathname || '/dashboard';
  
  useEffect(() => {
    if (user) {
      navigate(redirectTo);
    }
  }, [user, navigate, redirectTo]);
  
  const handleLoginSuccess = (user: User) => {
    // Track login event
    analytics.track('user_login', {
      user_id: user.id,
      role: user.role,
      method: 'email',
    });
    
    navigate(redirectTo);
  };
  
  return (
    <PublicLayout>
      <div className="auth-page">
        <div className="auth-container">
          <h1>Sign In to DCE Platform</h1>
          <LoginForm onSuccess={handleLoginSuccess} />
          <div className="auth-links">
            <Link to="/auth/forgot-password">Forgot password?</Link>
            <Link to="/auth/register">Create account</Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
```

# Registration Flow
```tsx
export function RegisterPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationData>({});
  
  const handleStepComplete = (stepData: Partial<RegistrationData>) => {
    setFormData(prev => ({ ...prev, ...stepData }));
    setStep(prev => prev + 1);
  };
  
  const handleRegistrationComplete = async (finalData: RegistrationData) => {
    try {
      await authService.register(finalData);
      navigate('/auth/verify-email');
    } catch (error) {
      // Handle registration error
    }
  };
  
  return (
    <PublicLayout>
      <div className="registration-page">
        <RegistrationStepper currentStep={step} totalSteps={3} />
        
        {step === 1 && (
          <BasicInfoStep onComplete={handleStepComplete} />
        )}
        {step === 2 && (
          <CompanyInfoStep 
            data={formData}
            onComplete={handleStepComplete}
          />
        )}
        {step === 3 && (
          <VerificationStep
            data={formData}
            onComplete={handleRegistrationComplete}
          />
        )}
      </div>
    </PublicLayout>
  );
}
```

# Role-Specific Registration
```tsx
interface RegistrationStepProps {
  userType: 'supplier' | 'buyer';
  onComplete: (data: Partial<RegistrationData>) => void;
}

export function CompanyInfoStep({ userType, onComplete }: RegistrationStepProps) {
  const form = useForm({
    resolver: zodResolver(getRegistrationSchema(userType)),
  });
  
  const fields = useMemo(() => {
    const baseFields = [
      { name: 'company_name', label: 'Company Name', required: true },
      { name: 'phone', label: 'Phone Number', required: true },
      { name: 'website', label: 'Website', required: false },
    ];
    
    if (userType === 'supplier') {
      return [
        ...baseFields,
        { name: 'traffic_sources', label: 'Traffic Sources', type: 'multiselect' },
        { name: 'monthly_volume', label: 'Monthly Call Volume', type: 'number' },
      ];
    } else {
      return [
        ...baseFields,
        { name: 'industry', label: 'Industry', type: 'select' },
        { name: 'monthly_budget', label: 'Monthly Budget', type: 'currency' },
      ];
    }
  }, [userType]);
  
  return (
    <form onSubmit={form.handleSubmit(onComplete)}>
      {fields.map(field => (
        <FormField
          key={field.name}
          {...field}
          {...form.register(field.name)}
          error={form.formState.errors[field.name]?.message}
        />
      ))}
      <Button type="submit">Continue</Button>
    </form>
  );
}
```

# Email Verification
```tsx
export function VerifyEmailPage() {
  const [verificationSent, setVerificationSent] = useState(false);
  const { user } = useAuth();
  
  const resendVerification = async () => {
    try {
      await authService.resendVerification();
      setVerificationSent(true);
      toast.success('Verification email sent!');
    } catch (error) {
      toast.error('Failed to send verification email');
    }
  };
  
  return (
    <PublicLayout>
      <div className="verify-email-page">
        <div className="verification-container">
          <CheckCircleIcon className="verification-icon" />
          <h1>Check Your Email</h1>
          <p>
            We've sent a verification link to <strong>{user?.email}</strong>
          </p>
          <p>Click the link in the email to verify your account.</p>
          
          <div className="verification-actions">
            <Button 
              onClick={resendVerification}
              disabled={verificationSent}
              variant="outline"
            >
              {verificationSent ? 'Email Sent' : 'Resend Email'}
            </Button>
            <Link to="/auth/login">Back to Login</Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
```

# Password Reset Flow
```tsx
export function ForgotPasswordPage() {
  const [emailSent, setEmailSent] = useState(false);
  const form = useForm<{ email: string }>({
    resolver: zodResolver(z.object({
      email: z.string().email('Invalid email address'),
    })),
  });
  
  const handleSubmit = async (data: { email: string }) => {
    try {
      await authService.requestPasswordReset(data.email);
      setEmailSent(true);
    } catch (error) {
      form.setError('email', {
        message: 'Failed to send reset email',
      });
    }
  };
  
  if (emailSent) {
    return (
      <PublicLayout>
        <div className="password-reset-sent">
          <h1>Reset Link Sent</h1>
          <p>Check your email for password reset instructions.</p>
          <Link to="/auth/login">Back to Login</Link>
        </div>
      </PublicLayout>
    );
  }
  
  return (
    <PublicLayout>
      <div className="forgot-password-page">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <h1>Reset Password</h1>
          <Input
            {...form.register('email')}
            type="email"
            label="Email Address"
            error={form.formState.errors.email?.message}
          />
          <Button 
            type="submit" 
            loading={form.formState.isSubmitting}
          >
            Send Reset Link
          </Button>
          <Link to="/auth/login">Back to Login</Link>
        </form>
      </div>
    </PublicLayout>
  );
}
```

# Security Features
- Rate limiting on auth attempts
- CAPTCHA for suspicious activity
- Session management
- Password strength validation
- Account lockout protection

# SEO and Meta Tags
```tsx
export function LoginPage() {
  useEffect(() => {
    document.title = 'Sign In - DCE Platform';
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      'Sign in to your DCE Platform account to manage campaigns and track performance.'
    );
  }, []);
  
  // Rest of component...
}
```

# Analytics Integration
- Track authentication events
- Monitor conversion rates
- A/B test registration flows
- User journey analysis

# Error Handling
- Network error recovery
- Invalid credential feedback
- Account status notifications
- Clear error messages

# Accessibility Features
- Proper form labels
- Screen reader support
- Keyboard navigation
- Focus management
- Error announcements

# CRITICAL RULES
- NO regex for form validation - use Zod
- NO any types in form interfaces
- ALWAYS handle authentication errors gracefully
- ALWAYS provide clear user feedback
- IMPLEMENT proper security measures
- TEST all authentication flows
- ENSURE accessibility compliance
- TRACK user behavior analytically